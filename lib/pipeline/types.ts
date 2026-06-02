import { RawSection } from "./lyrics-normalizer";

export type ContentType = 'track' | 'ep-single' | 'album' | 'playlist';
export type Platform = 'spotify' | 'youtube-music';
export type PromptTemplateKey = ContentType;

export type NormalizedMetadata = {
  sourceUrl: string;
  platform: Platform;
  contentType: ContentType;
  title: string;
  artistName: string;
  albumOrCollectionTitle: string;
  coverArtUrl: string;
  releaseLabel: string;
  trackCount?: number;
};

export type EvidenceBlock = {
  kind: 'lyrics' | 'description' | 'metadata' | 'playlist' | 'tracklist';
  label: string;
  text: string;
};

export type ReviewContextPacket = {
  metadata: NormalizedMetadata;
  evidenceBlocks: EvidenceBlock[];
  coverage: 'rich' | 'partial' | 'sparse';
  missingSignals: string[];
  confidenceInputs: {
    hasLyrics: boolean;
    hasDescription: boolean;
    hasTracklist: boolean;
  };
  normalizedLyricSections: RawSection[] | null;
};

export type GeminiPromptPlan = {
  systemInstruction: string;
  userPrompt: string;
};

export type PipelineError =
  | { code: 'unsupported_platform'; message: string }
  | { code: 'private_track'; message: string }
  | { code: 'missing_context'; message: string }
  | { code: 'rate_limited'; message: string }
  | { code: 'resolve_failure'; message: string }
  | { code: 'parse_failure'; message: string }
  | { code: 'specialist_failure'; message: string };

// ─── Specialist pipeline types ───────────────────────────────────────────────

// A stable, short reference to a piece of evidence that specialists can
// cite in their compact XML output. The ref format is intentionally simple
// so it survives round-trips through XML.
export type EvidenceRef = string; // e.g. "E001", "L001", "S001-L003"

// Ranks a ReviewContextPacket's evidence for specialist and reviewer
// consumption. The packet is internal; it never expands the evidence
// boundary, only re-orders and labels what is already there.
export type RankedEvidenceBlock = {
  ref: EvidenceRef;
  blockIndex: number;
  kind: EvidenceBlock['kind'];
  label: string;
  text: string;
  // Relevance is a coarse 0-1 score; absent means "no score".
  relevance?: number;
};

export type RankedLyricLine = {
  ref: EvidenceRef; // "L001"
  sectionId: string;
  lineId: string;
  text: string;
  relevance?: number;
};

export type RankedLyricSection = {
  ref: string; // "S001"
  sectionId: string;
  rawMarker: string | null;
  lineRefs: EvidenceRef[];
  relevance?: number;
};

export type RankedEvidencePacket = {
  metadata: NormalizedMetadata;
  blocks: RankedEvidenceBlock[];
  lyricSections: RankedLyricSection[];
  lyricLines: RankedLyricLine[];
  // Stable mapping the orchestrator uses to look refs back up.
  refToBlock: Map<EvidenceRef, RankedEvidenceBlock>;
  refToLine: Map<EvidenceRef, RankedLyricLine>;
  refToSection: Map<string, RankedLyricSection>;
  missingSignals: string[];
  coverage: ReviewContextPacket['coverage'];
};

export type SpecialistConfidence = 'high' | 'medium' | 'low';

export type SpecialistClaim = {
  text: string;
  evidenceRefs: EvidenceRef[];
};

export type SpecialistOutput = {
  role:
    | 'themeAnalyst'
    | 'emotionAnalyst'
    | 'narrativeAnalyst'
    | 'classifier'
    | 'sentimentAnalyst'
    | 'lyricsSpecialist';
  summary: string;
  claims: SpecialistClaim[];
  evidenceRefs: EvidenceRef[];
  confidence: SpecialistConfidence;
  refusalReason?: string;
};

export type SpecialistAnalysisPacket = {
  theme: SpecialistOutput;
  emotion: SpecialistOutput;
  narrative: SpecialistOutput;
  classification: SpecialistOutput;
  sentiment: SpecialistOutput;
  lyrics: SpecialistOutput | null; // null when no lyrics were available
};
