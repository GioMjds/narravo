import type { NarravoReviewComplete } from '@/lib/narravo-review';
import { PipelineError } from './types';

type ParseResult =
  | { ok: true; result: NarravoReviewComplete }
  | { ok: false; error: PipelineError };

export function parseGeminiOutput(
  fullText: string,
  reviewText: string,
): ParseResult {
  console.log('[parser] Attempting to parse Gemini output');
  console.log('[parser] fullText length:', fullText.length);
  console.log('[parser] reviewText length:', reviewText.length);

  const xmlMatch = fullText.match(/<ReviewResult>[\s\S]*<\/ReviewResult>/);

  if (!xmlMatch) {
    console.error('[parser] ✗ No <ReviewResult> block found');
    console.log('[parser] fullText tail (last 500 chars):');
    console.log(fullText.slice(-500));
    return {
      ok: false,
      error: { code: 'parse_failure', message: 'No XML tail found' },
    };
  }

  console.log(
    '[parser] ✓ Found <ReviewResult> block, length:',
    xmlMatch[0].length,
  );

  try {
    const xml = xmlMatch[0];

    // Evidence sections
    const evidenceMatches = [
      ...xml.matchAll(/<Section title="([^"]+)">([\s\S]*?)<\/Section>/g),
    ];
    console.log('[parser] Evidence sections found:', evidenceMatches.length);

    const evidence = evidenceMatches.map((m) => ({
      title: m[1],
      items: [...m[2].matchAll(/<Item>([\s\S]*?)<\/Item>/g)].map((i) =>
        i[1].trim(),
      ),
    }));

    // Scores
    const scoreMatches = [
      ...xml.matchAll(/<Score label="([^"]+)" score="(\d+)" note="([^"]+)"/g),
    ];
    console.log('[parser] Scores found:', scoreMatches.length, '(expected 5)');

    const scores = scoreMatches.map((m) => ({
      label: m[1],
      score: parseInt(m[2], 10),
      note: m[3],
    }));

    const tagsMatch = xml.match(/<Tags>(.*?)<\/Tags>/s);
    const tags = tagsMatch
      ? tagsMatch[1]
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    console.log('[parser] Tags found:', tags.length);

    const takeawayMatch = xml.match(/<Takeaway>([\s\S]*?)<\/Takeaway>/);
    const takeaway = takeawayMatch?.[1]?.trim() ?? '';
    console.log('[parser] Takeaway present:', !!takeaway);

    const confidenceMatch = xml.match(
      /<Confidence label="([^"]+)" note="([^"]+)"/,
    );
    const confidence = {
      label: confidenceMatch?.[1] ?? 'Low confidence',
      note:
        confidenceMatch?.[2] ??
        'Insufficient evidence to determine confidence.',
    };
    console.log('[parser] Confidence label:', confidence.label);

    // Validate required fields
    if (
      !evidence.length ||
      scores.length !== 5 ||
      !takeaway ||
      !confidence.label
    ) {
      console.error('[parser] ✗ Incomplete XML structure:', {
        evidenceSections: evidence.length,
        scores: scores.length,
        hasTakeaway: !!takeaway,
        hasConfidence: !!confidence.label,
      });
      return {
        ok: false,
        error: { code: 'parse_failure', message: 'Incomplete XML structure' },
      };
    }

    console.log('[parser] ✓ Parse successful');
    return {
      ok: true,
      result: { reviewText, evidence, scores, tags, takeaway, confidence },
    };
  } catch (err) {
    console.error('[parser] ✗ Exception during parse:', err);
    return {
      ok: false,
      error: {
        code: 'parse_failure',
        message: 'XML parse threw: ' + String(err),
      },
    };
  }
}
