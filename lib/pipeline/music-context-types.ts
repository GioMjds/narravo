// Provenance

export type MusicContextProvider =
  | 'musicbrainz'
  | 'lastfm'
  | 'spotify'
  | 'itunes';

export type MusicContextConfidence = 'high' | 'medium' | 'low';

// Fact categories

export type MusicContextCategory =
  | 'artist_background'
  | 'discography_context'
  | 'release_concept'
  | 'release_era'
  | 'genre_context'
  | 'credits'
  | 'featured_artists'
  | 'album_continuity';

// A single provenance-bearing fact

export type MusicContextFact = {
  category: MusicContextCategory;
  label: string;
  text: string;
  provider: MusicContextProvider;
  sourceId?: string;
  sourceUrl?: string;
  confidence: MusicContextConfidence;
  // Only facts with promptSafe=true are converted into EvidenceBlocks
  promptSafe: boolean;
};

// Category-level missing signals

export type MusicContextMissingSignal =
  | 'artist_background'
  | 'discography_context'
  | 'release_concept'
  | 'release_era'
  | 'genre_context'
  | 'credits'
  | 'featured_artists'
  | 'album_continuity';

// MusicBrainz raw entity refs

export type MBEntityRef = {
  id: string; // MusicBrainz MBID
  name: string;
  type?: string;
};

// Resolved MusicBrainz match for a recording / release

export type MBRecordingMatch = {
  recordingId: string;
  recordingTitle: string;
  artistCredit: string;
  artistMbids: string[];
  releaseId?: string;
  releaseTitle?: string;
  releaseGroupId?: string;
  releaseDate?: string;
  confidence: MusicContextConfidence;
};

export type MBReleaseMatch = {
  releaseId: string;
  releaseTitle: string;
  artistCredit: string;
  artistMbids: string[];
  releaseGroupId?: string;
  releaseDate?: string;
  trackCount?: number;
  confidence: MusicContextConfidence;
};

// Output packet from the assembler

export type MusicContextPacket = {
  facts: MusicContextFact[];
  missingSignals: MusicContextMissingSignal[];
};
