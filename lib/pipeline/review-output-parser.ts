import type {
  NarravoReviewComplete,
  LyricsIntelligence,
  LyricsSection,
  AnnotatedLine,
  LyricsSectionType,
  LyricsConfidence,
  LyricsSpeakerTarget,
} from '@/lib/narravo-review';
import { PipelineError } from './types';
import type { RawSection } from './lyrics-normalizer';

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

    const lyricsIntelligence = parseLyricsIntelligence(fullText);

    console.log('[parser] LyricsIntelligence present:', !!lyricsIntelligence);
    console.log('[parser] ✓ Parse successful');
    return {
      ok: true,
      result: {
        reviewText,
        evidence,
        scores,
        tags,
        takeaway,
        confidence,
        lyricsIntelligence,
      },
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

export function backfillLineText(
  intelligence: LyricsIntelligence,
  normalizedSections: RawSection[],
): LyricsIntelligence {
  // Build lineId → text lookup
  const lineMap = new Map<string, string>();
  for (const s of normalizedSections) {
    for (const l of s.lines) {
      lineMap.set(l.lineId, l.text);
    }
  }

  return {
    ...intelligence,
    sections: intelligence.sections.map((s) => ({
      ...s,
      lines: s.lines.map((l) => ({
        ...l,
        text: lineMap.get(l.lineId) ?? l.text,
      })),
    })),
  };
}

function parseLyricsIntelligence(xml: string): LyricsIntelligence | null {
  const liMatch = xml.match(
    /<LyricsIntelligence>([\s\S]*?)<\/LyricsIntelligence>/,
  );
  if (!liMatch) return null;

  const liXml = liMatch[1];

  const overallThemesMatch = liXml.match(
    /<OverallThemes>(.*?)<\/OverallThemes>/s,
  );
  const overallThemes = overallThemesMatch
    ? overallThemesMatch[1]
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const sectionMatches = [
    ...liXml.matchAll(
      /<Section\s+id="([^"]+)"\s+type="([^"]+)"\s+label="([^"]+)"\s+confidence="([^"]+)">([\s\S]*?)<\/Section>/g,
    ),
  ];

  if (sectionMatches.length === 0) {
    console.warn('[parser] LyricsIntelligence: no sections found — rejecting');
    return null;
  }

  const sections: LyricsSection[] = [];

  for (const match of sectionMatches) {
    const [, sectionId, type, label, confidence, body] = match;

    const themesMatch = body.match(/<Themes>(.*?)<\/Themes>/s);
    const emotionMatch = body.match(/<Emotion>(.*?)<\/Emotion>/s);
    const figurativeMatch = body.match(
      /<FigurativeLanguage>(.*?)<\/FigurativeLanguage>/s,
    );
    const referencesMatch = body.match(/<References>(.*?)<\/References>/s);
    const speakerMatch = body.match(/<SpeakerTarget>(.*?)<\/SpeakerTarget>/s);
    const literalMatch = body.match(
      /<LiteralInterpretation>(.*?)<\/LiteralInterpretation>/s,
    );
    const symbolicMatch = body.match(
      /<SymbolicInterpretation>(.*?)<\/SymbolicInterpretation>/s,
    );

    const lineMatches = [
      ...body.matchAll(
        /<Line\s+id="([^"]+)"\s+confidence="([^"]+)">([\s\S]*?)<\/Line>/g,
      ),
    ];

    const lines: AnnotatedLine[] = lineMatches.map((lm) => ({
      lineId: lm[1],
      text: '', // filled in by the orchestrator via normalizedLyricSections lookup
      annotation: lm[3].trim(),
      confidence: (lm[2] as LyricsConfidence) ?? 'speculative',
    }));

    const figRaw = figurativeMatch?.[1]?.trim() ?? 'none';
    const refRaw = referencesMatch?.[1]?.trim() ?? 'none';

    sections.push({
      sectionId,
      type: (type as LyricsSectionType) ?? 'other',
      label,
      confidence: (confidence as LyricsConfidence) ?? 'speculative',
      themes: themesMatch
        ? themesMatch[1]
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      emotion: emotionMatch?.[1]?.trim() ?? 'unknown',
      figurativeLanguage: figRaw === 'none' ? null : figRaw,
      references: refRaw === 'none' ? null : refRaw,
      speakerTarget:
        (speakerMatch?.[1]?.trim() as LyricsSpeakerTarget) ?? 'unknown',
      literalInterpretation: literalMatch?.[1]?.trim() ?? '',
      symbolicInterpretation: symbolicMatch?.[1]?.trim() ?? '',
      lines,
    });
  }

  if (sections.length === 0) return null;

  return { overallThemes, sections };
}
