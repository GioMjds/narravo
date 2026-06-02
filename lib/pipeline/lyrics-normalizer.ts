export type NormalizedLine = {
  lineId: string; // "L001", "L002", ...
  text: string;
};

export type RawSection = {
  sectionId: string; // "S001", "S002", ...
  rawMarker: string | null; // explicit marker text if found, null if inferred
  lines: NormalizedLine[];
};

// Known explicit section markers, case-insensitive
const EXPLICIT_MARKERS = new Set([
  'verse',
  'chorus',
  'bridge',
  'intro',
  'outro',
  'pre-chorus',
  'prechorus',
  'hook',
  'refrain',
  'interlude',
  'outro',
  'coda',
]);

function isExplicitMarker(line: string): boolean {
  const stripped = line
    .replace(/[\[\]():]/g, '')
    .trim()
    .toLowerCase();
  // Accept "[Verse 1]", "(Chorus)", "Verse:", etc.
  const firstWord = stripped.split(/\s+/)[0];
  return EXPLICIT_MARKERS.has(firstWord ?? '');
}

function padId(n: number, prefix: string): string {
  return `${prefix}${String(n).padStart(3, '0')}`;
}

/**
 * Normalize raw lyrics text into stable line IDs.
 * Strips leading/trailing whitespace per line.
 * Removes timestamp artifacts like [00:12.34].
 */
export function normalizeLines(rawLyrics: string): NormalizedLine[] {
  const lines = rawLyrics
    .split('\n')
    .map((l) => l.replace(/^\[\d{2}:\d{2}[.:]\d{2,3}\]\s?/, '').trim());

  let lineCounter = 1;
  const result: NormalizedLine[] = [];

  for (const text of lines) {
    if (!text) continue;
    // Skip explicit section marker lines — they become section labels, not lyric lines
    if (isExplicitMarker(text)) continue;
    result.push({ lineId: padId(lineCounter++, 'L'), text });
  }

  return result;
}

/**
 * Split raw lyrics into sections using this priority:
 * 1. Explicit markers ([Verse], [Chorus], etc.)
 * 2. Blank-line separation
 * 3. Repeated hook detection (same block appears ≥2 times → chorus candidate)
 * 4. Neutral fallback ("Part N")
 */
export function detectSections(rawLyrics: string): RawSection[] {
  const rawLines = rawLyrics.split('\n').map((l) => l.trim());
  const sections: RawSection[] = [];

  let sectionCounter = 1;
  let lineCounter = 1;
  let currentMarker: string | null = null;
  let currentLines: NormalizedLine[] = [];

  function pushSection() {
    if (currentLines.length === 0) return;
    sections.push({
      sectionId: padId(sectionCounter++, 'S'),
      rawMarker: currentMarker,
      lines: currentLines,
    });
    currentLines = [];
    currentMarker = null;
  }

  for (const raw of rawLines) {
    const stripped = raw.replace(/^\[\d{2}:\d{2}[.:]\d{2,3}\]\s?/, '').trim();

    if (!stripped) {
      // Blank line → section boundary (strategy 2)
      pushSection();
      continue;
    }

    if (isExplicitMarker(stripped)) {
      // Explicit marker found (strategy 1)
      pushSection();
      currentMarker = stripped;
      continue;
    }

    currentLines.push({
      lineId: padId(lineCounter++, 'L'),
      text: stripped,
    });
  }

  pushSection();

  // Strategy 3: repeated hook detection
  // Find blocks whose joined text appears ≥2 times → mark rawMarker as "Chorus" if not already marked
  const blockFingerprints = new Map<string, number[]>();
  sections.forEach((s, i) => {
    const fingerprint = s.lines
      .map((l) => l.text)
      .join('|')
      .toLowerCase()
      .trim();
    if (fingerprint.length < 10) return; // too short to be meaningful
    const existing = blockFingerprints.get(fingerprint) ?? [];
    existing.push(i);
    blockFingerprints.set(fingerprint, existing);
  });

  for (const [, indices] of blockFingerprints) {
    if (indices.length >= 2) {
      for (const idx of indices) {
        const section = sections[idx];
        if (section && !section.rawMarker) {
          section.rawMarker = 'Chorus'; // inferred
        }
      }
    }
  }

  return sections;
}

/**
 * Build the lyric context packet for Gemini.
 * Returns a structured text representation of sections + lines.
 */
export function buildLyricContextText(sections: RawSection[]): string {
  return sections
    .map((s) => {
      const header = s.rawMarker
        ? `[${s.rawMarker}] (${s.sectionId})`
        : `[Section] (${s.sectionId})`;
      const body = s.lines.map((l) => `  ${l.lineId}: ${l.text}`).join('\n');
      return `${header}\n${body}`;
    })
    .join('\n\n');
}
