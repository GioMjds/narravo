import { resolveSource } from './review-source-resolver';
import { routeTemplate } from './review-template-router';
import { assembleContext } from './review-context-assembler';
import { buildPrompt } from './review-prompt-builder';
import { streamFromGemini } from './gemini-review-client';
import { parseGeminiOutput } from './review-output-parser';
import type {
  NarravoReviewStreamEvent,
  NarravoRecoverableError,
} from '@/lib/narravo-review';

function pipelineErrorToRecoverable(
  code: string,
  message: string,
): NarravoRecoverableError {
  const map: Record<string, NarravoRecoverableError> = {
    unsupported_platform: {
      code: 'unsupported_platform',
      status: 400,
      title: 'Unsupported link',
      message,
      hint: 'Use a Spotify or YouTube Music URL.',
    },
    private_track: {
      code: 'private_track',
      status: 403,
      title: 'Track unavailable',
      message,
      hint: 'Try a public track.',
    },
    missing_context: {
      code: 'missing_context',
      status: 422,
      title: 'Insufficient evidence',
      message,
      hint: 'Try a track with available lyrics or a curated demo.',
    },
    rate_limited: {
      code: 'rate_limited',
      status: 429,
      title: 'Rate limited',
      message,
      hint: 'Retry in a moment.',
    },
  };

  return (
    map[code] ?? {
      code: 'resolve_failure',
      status: 500,
      title: 'Review failed',
      message,
      hint: 'Retry the request.',
    }
  );
}

export async function runReviewPipeline(
  url: string,
  emit: (event: NarravoReviewStreamEvent) => void,
): Promise<{ ok: true } | { ok: false; error: NarravoRecoverableError }> {
  console.log('\n[pipeline] ══════════════════════════════════════');
  console.log('[pipeline] Starting review pipeline for:', url);
  console.log('[pipeline] ══════════════════════════════════════');

  // ── Stage 1: Resolve source ───────────────────────────────────────────────
  console.log('[pipeline] Stage 1: Resolving source...');
  const resolved = await resolveSource(url);

  if (!resolved.ok) {
    console.error('[pipeline] ✗ Stage 1 failed:', resolved.error);
    return {
      ok: false,
      error: pipelineErrorToRecoverable(
        resolved.error.code,
        resolved.error.message,
      ),
    };
  }

  console.log('[pipeline] ✓ Stage 1 resolved:', {
    title: resolved.metadata.title,
    artist: resolved.metadata.artistName,
    platform: resolved.metadata.platform,
    contentType: resolved.metadata.contentType,
    coverArtUrl: resolved.metadata.coverArtUrl.slice(0, 60) + '...',
  });

  // Emit metadata immediately so UI can render the hero
  emit({
    type: 'metadata',
    metadata: {
      title: resolved.metadata.title,
      artist: resolved.metadata.artistName,
      album: resolved.metadata.albumOrCollectionTitle,
      releaseLabel: resolved.metadata.releaseLabel,
      platform: resolved.metadata.platform,
      platformLabel:
        resolved.metadata.platform === 'spotify' ? 'Spotify' : 'YouTube Music',
      coverArtUrl: resolved.metadata.coverArtUrl,
    },
  });

  // ── Stage 2: Route template ────────────────────────────────────────────────
  console.log('[pipeline] Stage 2: Routing template...');
  const templateKey = routeTemplate(resolved.metadata);
  console.log('[pipeline] ✓ Template key:', templateKey);

  // ── Stage 3: Assemble context ─────────────────────────────────────────────
  console.log('[pipeline] Stage 3: Assembling context...');
  const context = await assembleContext(resolved.metadata, templateKey);
  console.log('[pipeline] ✓ Context assembled:', {
    coverage: context.coverage,
    evidenceKinds: context.evidenceBlocks.map((b) => b.kind),
    missingSignals: context.missingSignals,
  });

  // NOTE: We intentionally do NOT bail on 'sparse' coverage.
  // Gemini can produce a useful review from metadata alone and will
  // self-report low confidence in the output's <Confidence> block.

  // ── Stage 4: Build prompt ─────────────────────────────────────────────────
  console.log('[pipeline] Stage 4: Building prompt...');
  const plan = buildPrompt(templateKey, context);
  console.log(
    '[pipeline] ✓ Prompt built | system:',
    plan.systemInstruction.length,
    'chars | user:',
    plan.userPrompt.length,
    'chars',
  );

  // ── Stage 5: Stream from Gemini ───────────────────────────────────────────
  console.log('[pipeline] Stage 5: Streaming from Gemini...');
  let reviewText = '';
  const geminiResult = await streamFromGemini(plan, (chunk) => {
    reviewText += chunk;
    emit({ type: 'chunk', chunk });
  });

  if (!geminiResult.ok) {
    console.error('[pipeline] ✗ Stage 5 failed:', geminiResult.error);
    return {
      ok: false,
      error: pipelineErrorToRecoverable(
        geminiResult.error.code,
        geminiResult.error.message,
      ),
    };
  }

  console.log(
    '[pipeline] ✓ Stage 5 complete | reviewText accumulated:',
    reviewText.trim().length,
    'chars',
  );

  // ── Stage 6: Parse output ─────────────────────────────────────────────────
  console.log('[pipeline] Stage 6: Parsing Gemini output...');
  const parsed = parseGeminiOutput(geminiResult.fullText, reviewText.trim());

  if (!parsed.ok) {
    console.error('[pipeline] ✗ Stage 6 failed:', parsed.error);
    return {
      ok: false,
      error: pipelineErrorToRecoverable(
        'resolve_failure',
        'Could not parse the review output.',
      ),
    };
  }

  console.log(
    '[pipeline] ✓ Stage 6 complete | evidence sections:',
    parsed.result.evidence.length,
    '| scores:',
    parsed.result.scores.length,
  );
  console.log('[pipeline] ══════════════════════════════════════');
  console.log('[pipeline] Pipeline complete for:', resolved.metadata.title);
  console.log('[pipeline] ══════════════════════════════════════\n');

  emit({ type: 'complete', result: parsed.result });
  return { ok: true };
}
