import type {
  EvidenceBlock,
  ReviewContextPacket,
} from './types';
import type {
  EvidenceRef,
  RankedEvidenceBlock,
  RankedEvidencePacket,
  RankedLyricLine,
  RankedLyricSection,
} from './types';

// Coarse heuristic scores per evidence kind. These are intentionally simple
// and per-request only: no persistent indexing, no broad web search. They
// give specialists a hint about which evidence to weigh most.
const KIND_RELEVANCE: Record<EvidenceBlock['kind'], number> = {
  lyrics: 0.95,
  description: 0.7,
  tracklist: 0.5,
  metadata: 0.4,
  playlist: 0.4,
};

function blockRelevance(block: EvidenceBlock): number {
  // Slight boost for shorter descriptions so the heuristic can prefer
  // focused blocks over multi-paragraph album biographies.
  const base = KIND_RELEVANCE[block.kind] ?? 0.4;
  const lengthPenalty = block.text.length > 2000 ? -0.1 : 0;
  return clamp01(base + lengthPenalty);
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function pad(n: number, prefix: string, width = 3): string {
  return `${prefix}${String(n).padStart(width, '0')}`;
}

function buildBlocks(packet: ReviewContextPacket): {
  blocks: RankedEvidenceBlock[];
  refToBlock: Map<EvidenceRef, RankedEvidenceBlock>;
} {
  const blocks: RankedEvidenceBlock[] = [];
  const refToBlock = new Map<EvidenceRef, RankedEvidenceBlock>();
  packet.evidenceBlocks.forEach((block, idx) => {
    const ref = pad(idx + 1, 'E');
    const ranked: RankedEvidenceBlock = {
      ref,
      blockIndex: idx,
      kind: block.kind,
      label: block.label,
      text: block.text,
      relevance: blockRelevance(block),
    };
    blocks.push(ranked);
    refToBlock.set(ref, ranked);
  });
  return { blocks, refToBlock };
}

function buildLyrics(packet: ReviewContextPacket): {
  sections: RankedLyricSection[];
  lines: RankedLyricLine[];
  refToLine: Map<EvidenceRef, RankedLyricLine>;
  refToSection: Map<string, RankedLyricSection>;
} {
  const sections: RankedLyricSection[] = [];
  const lines: RankedLyricLine[] = [];
  const refToLine = new Map<EvidenceRef, RankedLyricLine>();
  const refToSection = new Map<string, RankedLyricSection>();

  if (!packet.normalizedLyricSections) {
    return { sections, lines, refToLine, refToSection };
  }

  packet.normalizedLyricSections.forEach((section, sIdx) => {
    const sectionRef = pad(sIdx + 1, 'S');
    const lineRefs: EvidenceRef[] = [];

    section.lines.forEach((line, lIdx) => {
      const lineRef = `${sectionRef}-${line.lineId}`;
      const ranked: RankedLyricLine = {
        ref: lineRef,
        sectionId: section.sectionId,
        lineId: line.lineId,
        text: line.text,
        // Slight relevance drop on later lines so the heuristic can hint
        // the choruses (which appear earlier and repeat) matter more.
        relevance: clamp01(0.8 - lIdx * 0.005),
      };
      lines.push(ranked);
      refToLine.set(lineRef, ranked);
      lineRefs.push(lineRef);
    });

    const sectionRelevance = clamp01(
      0.6 +
        (section.rawMarker ? 0.15 : 0) +
        Math.min(0.15, section.lines.length * 0.01),
    );
    const rankedSection: RankedLyricSection = {
      ref: sectionRef,
      sectionId: section.sectionId,
      rawMarker: section.rawMarker,
      lineRefs,
      relevance: sectionRelevance,
    };
    sections.push(rankedSection);
    refToSection.set(sectionRef, rankedSection);
  });

  return { sections, lines, refToLine, refToSection };
}

export function buildRankedEvidencePacket(
  packet: ReviewContextPacket,
): RankedEvidencePacket {
  const { blocks, refToBlock } = buildBlocks(packet);
  const { sections, lines, refToLine, refToSection } = buildLyrics(packet);

  return {
    metadata: packet.metadata,
    blocks,
    lyricSections: sections,
    lyricLines: lines,
    refToBlock,
    refToLine,
    refToSection,
    missingSignals: packet.missingSignals,
    coverage: packet.coverage,
  };
}

export function formatRankedEvidenceForPrompt(
  packet: RankedEvidencePacket,
  options: { includeLyrics: boolean },
): string {
  const blockText = packet.blocks
    .map((b) => `[${b.ref}] (${b.kind}) ${b.label}\n${b.text}`)
    .join('\n\n');

  if (!options.includeLyrics || packet.lyricLines.length === 0) {
    return blockText;
  }

  const lyricsText = packet.lyricSections
    .map((s) => {
      const header = s.rawMarker
        ? `[${s.ref}] (${s.rawMarker})`
        : `[${s.ref}] (Section)`;
      const body = s.lineRefs
        .map((lineRef) => {
          const line = packet.refToLine.get(lineRef);
          if (!line) return null;
          return `  ${line.ref}: ${line.text}`;
        })
        .filter((line): line is string => line != null)
        .join('\n');
      return `${header}\n${body}`;
    })
    .join('\n\n');

  return `${blockText}\n\n### Lyrics\n${lyricsText}`;
}

export function isValidRef(packet: RankedEvidencePacket, ref: string): boolean {
  if (packet.refToBlock.has(ref)) return true;
  if (packet.refToLine.has(ref)) return true;
  if (packet.refToSection.has(ref)) return true;
  return false;
}
