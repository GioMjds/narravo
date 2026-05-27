import type { NarravoReviewComplete } from '@/lib/narravo-review';
import { PipelineError } from './types';

type ParseResult =
  | { ok: true; result: NarravoReviewComplete }
  | { ok: false; error: PipelineError };

export function parseGeminiOutput(
  fullText: string,
  reviewText: string,
): ParseResult {
  const xmlMatch = fullText.match(/<ReviewResult>[\s\S]*<\/ReviewResult>/);
  if (!xmlMatch) {
    return {
      ok: false,
      error: { code: 'parse_failure', message: 'No XML tail found' },
    };
  }

  try {
    const xml = xmlMatch[0];

    // Evidence sections
    const evidence = [
      ...xml.matchAll(/<Section title="([^"]+)">([\s\S]*?)<\/Section>/g),
    ].map((m) => ({
      title: m[1],
      items: [...m[2].matchAll(/<Item>([\s\S]*?)<\/Item>/g)].map((i) =>
        i[1].trim(),
      ),
    }));

    // Scores
    const scores = [
      ...xml.matchAll(/<Score label="([^"]+)" score="(\d+)" note="([^"]+)"/g),
    ].map((m) => ({
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

    const takeawayMatch = xml.match(/<Takeaway>([\s\S]*?)<\/Takeaway>/);
    const takeaway = takeawayMatch?.[1]?.trim() ?? '';

    const confidenceMatch = xml.match(
      /<Confidence label="([^"]+)" note="([^"]+)"/,
    );
    const confidence = {
      label: confidenceMatch?.[1] ?? 'Low confidence',
      note:
        confidenceMatch?.[2] ??
        'Insufficient evidence to determine confidence.',
    };

    // Validate required fields
    if (
      !evidence.length ||
      scores.length !== 5 ||
      !takeaway ||
      !confidence.label
    ) {
      return {
        ok: false,
        error: { code: 'parse_failure', message: 'Incomplete XML structure' },
      };
    }

    return {
      ok: true,
      result: { reviewText, evidence, scores, tags, takeaway, confidence },
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'parse_failure',
        message: 'XML parse threw: ' + String(err),
      },
    };
  }
}
