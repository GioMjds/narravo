import { resolveSource } from './review-source-resolver';
import { routeTemplate } from './review-template-router';
import { assembleContext } from './review-context-assembler';
import { buildReviewerSynthesisPrompt } from './review-prompt-builder';
import { streamFromGemini } from './gemini-review-client';
import { parseGeminiOutput } from './review-output-parser';
import type {
  NarravoReviewStreamEvent,
  NarravoRecoverableError,
} from '@/lib/narravo-review';
import { backfillLineText } from './review-output-parser';
import { buildRankedEvidencePacket } from './evidence-ranker';
import { runSpecialists } from './specialist-orchestrator';
import { requireModelAdapter, type StreamResult } from './model-registry';
import { registerDefaultGeminiAdapters } from './gemini-provider';

// Side-effect: register Gemini-backed adapters for all model roles once
// the orchestrator module is imported. The first call to runReviewPipeline
// will use these adapters; tests can override via the model registry.
registerDefaultGeminiAdapters();

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
    specialist_failure: {
      code: 'resolve_failure',
      status: 422,
      title: 'Specialist analysis failed',
      message,
      hint: 'Retry the request — this is usually transient.',
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

type PipelineRunResult =
  | { ok: true }
  | { ok: false; error: NarravoRecoverableError };

export async function runReviewPipeline(
  url: string,
  emit: (event: NarravoReviewStreamEvent) => void,
  userLyrics?: string,
): Promise<PipelineRunResult> {
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
    userLyricsActive: !!userLyrics,
  });

  // ── Stage 2: Route template ────────────────────────────────────────────────
  console.log('[pipeline] Stage 2: Routing template...');
  const templateKey = routeTemplate(resolved.metadata);
  console.log('[pipeline] ✓ Template key:', templateKey);

  // ── Stage 3: Assemble context ─────────────────────────────────────────────
  console.log('[pipeline] Stage 3: Assembling context...');
  const context = await assembleContext(resolved.metadata, userLyrics);
  console.log('[pipeline] ✓ Context assembled:', {
    coverage: context.coverage,
    evidenceKinds: context.evidenceBlocks.map((b) => b.kind),
    missingSignals: context.missingSignals,
  });

  // ── Stage 3b: Per-request evidence ranking ─────────────────────────────────
  console.log('[pipeline] Stage 3b: Ranking evidence for specialists...');
  const ranked = buildRankedEvidencePacket(context);

  // ── Stage 4: Parallel specialist analysis ─────────────────────────────────
  console.log('[pipeline] Stage 4: Running parallel specialists...');
  const specialistResult = await runSpecialists(ranked);
  if (!specialistResult.ok) {
    console.error('[pipeline] ✗ Stage 4 failed:', specialistResult.reason);
    return {
      ok: false,
      error: pipelineErrorToRecoverable(
        'specialist_failure',
        specialistResult.reason,
      ),
    };
  }
  console.log('[pipeline] ✓ Stage 4 complete | specialists validated');

  // ── Stage 5: Build reviewer synthesis prompt ──────────────────────────────
  console.log('[pipeline] Stage 5: Building reviewer synthesis prompt...');
  const plan = buildReviewerSynthesisPrompt(
    templateKey,
    context,
    ranked,
    specialistResult.packet,
  );
  console.log(
    '[pipeline] ✓ Prompt built | system:',
    plan.systemInstruction.length,
    'chars | user:',
    plan.userPrompt.length,
    'chars',
  );

  // ── Stage 6: Stream from reviewer model ───────────────────────────────────
  console.log('[pipeline] Stage 6: Streaming from reviewer model...');
  let reviewText = '';
  let geminiResult:
    | { ok: true; fullText: string }
    | { ok: false; error: { code: string; message: string } };

  // Prefer the model-registry streaming adapter for the reviewer role. This
  // keeps the streaming boundary aligned with the rest of the registry; the
  // historical `streamFromGemini` helper remains for any other caller.
  try {
    const reviewer = requireModelAdapter('reviewer');
    const stream = await reviewer.stream({
      systemInstruction: plan.systemInstruction,
      userPrompt: plan.userPrompt,
    });
    geminiResult = await consumeReviewerStream(stream, (chunk) => {
      reviewText += chunk;
      emit({ type: 'chunk', chunk });
    });
  } catch (err) {
    // Fall back to the direct Gemini helper if the registry has no
    // reviewer adapter (e.g. during partial test setups). The helper
    // is provider-specific but is the v1 default.
    console.warn('[pipeline] Falling back to direct Gemini client:', err);
    geminiResult = await streamFromGemini(plan, (chunk) => {
      reviewText += chunk;
      emit({ type: 'chunk', chunk });
    });
  }

  if (!geminiResult.ok) {
    console.error('[pipeline] ✗ Stage 6 failed:', geminiResult.error);
    return {
      ok: false,
      error: pipelineErrorToRecoverable(
        geminiResult.error.code,
        geminiResult.error.message,
      ),
    };
  }

  console.log(
    '[pipeline] ✓ Stage 6 complete | reviewText accumulated:',
    reviewText.trim().length,
    'chars',
  );

  // ── Stage 7: Parse output ─────────────────────────────────────────────────
  console.log('[pipeline] Stage 7: Parsing reviewer output...');

  const parsed = parseGeminiOutput(geminiResult.fullText, reviewText.trim());

  if (!parsed.ok) {
    console.error('[pipeline] ✗ Stage 7 failed:', parsed.error);
    return {
      ok: false,
      error: pipelineErrorToRecoverable(
        'resolve_failure',
        'Could not parse the review output.',
      ),
    };
  }

  console.log(
    '[pipeline] ✓ Stage 7 complete | evidence sections:',
    parsed.result.evidence.length,
    '| scores:',
    parsed.result.scores.length,
  );
  console.log('[pipeline] ══════════════════════════════════════');
  console.log('[pipeline] Pipeline complete for:', resolved.metadata.title);
  console.log('[pipeline] ══════════════════════════════════════\n');

  let finalResult = parsed.result;

  if (finalResult.lyricsIntelligence && context.normalizedLyricSections) {
    finalResult = {
      ...finalResult,
      lyricsIntelligence: backfillLineText(
        finalResult.lyricsIntelligence,
        context.normalizedLyricSections,
      ),
    };
  }

  emit({ type: 'complete', result: finalResult });
  return { ok: true };
}

// Consume the model-registry stream and split out the prose parts. Mirrors
// the XML-tail detection behavior of the existing gemini-review-client so
// chunk events never leak XML or specialist output.
async function consumeReviewerStream(
  stream: StreamResult,
  onProseChunk: (text: string) => void,
): Promise<
  | { ok: true; fullText: string }
  | { ok: false; error: { code: string; message: string } }
> {
  let fullText = '';
  let emittedLength = 0;
  let xmlStarted = false;
  try {
    for await (const text of stream.iterator) {
      fullText += text;
      if (!xmlStarted) {
        const xmlIndex = fullText.indexOf('<ReviewResult>');
        if (xmlIndex !== -1) {
          xmlStarted = true;
          const proseChunk = fullText.slice(emittedLength, xmlIndex);
          if (proseChunk.trim()) onProseChunk(proseChunk);
        } else {
          const proseChunk = fullText.slice(emittedLength);
          if (proseChunk) onProseChunk(proseChunk);
          emittedLength = fullText.length;
        }
      }
    }
    return { ok: true, fullText };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'resolve_failure',
        message: err instanceof Error ? err.message : 'Reviewer stream failed',
      },
    };
  }
}
