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
}

export type EvidenceBlock = {
  kind: 'lyrics' | 'description' | 'metadata' | 'playlist';
  label: string;
  text: string;
}

export type ReviewContextPacket = {
  metadata: NormalizedMetadata;
  evidenceBlocks: EvidenceBlock[];
  coverage: 'rich' | 'partial' | 'sparse';
  missingSignals: string[];
  confidenceInputs: {
    hasLyrics: boolean;
    hasDescription: boolean;
    hasTracklist: boolean;
  }
}

export type GeminiPromptPlan = {
  systemInstruction: string;
  userPrompt: string;
}

export type PipelineError =
  | { code: 'unsupported_platform'; message: string }
  | { code: 'private_track'; message: string }
  | { code: 'missing_context'; message: string }
  | { code: 'rate_limited'; message: string }
  | { code: 'resolve_failure'; message: string }
  | { code: 'parse_failure'; message: string };