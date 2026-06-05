// Music Context Assembler — Phase 1.0
//
// Accepts a resolved MusicBrainz match (recording or release) plus a request-
// scoped dedupe cache, fetches supporting detail from MusicBrainz, and emits:
//   1. A MusicContextPacket of provenance-bearing facts.
//   2. An array of EvidenceBlock entries for prompt consumption (promptSafe facts only).
//
// The assembler deliberately uses only structured MusicBrainz data — no web
// scraping, no broad search, no persistent storage. Failures are best-effort:
// missing data is recorded as a category-level missing signal.

import type { NormalizedMetadata, EvidenceBlock } from './types';
import type {
  MusicContextFact,
  MusicContextPacket,
  MusicContextMissingSignal,
} from './music-context-types';
import type { MBRecordingMatch, MBReleaseMatch } from './music-context-types';
import {
  getMBArtistDetail,
  getMBReleaseGroupDetail,
  getMBReleaseDetail,
  getMBRecordingDetail,
  type MBRelation,
  type MBTag,
} from './musicbrainz-client';
import { resolveMBRecording, resolveMBRelease } from './music-context-resolver';

// ─── Public entry point ───────────────────────────────────────────────────────

export async function assembleMusicContext(
  metadata: NormalizedMetadata,
): Promise<{ packet: MusicContextPacket; evidenceBlocks: EvidenceBlock[] }> {
  const dedupeCache = new Map<string, unknown>();
  const facts: MusicContextFact[] = [];
  const missingSignals: MusicContextMissingSignal[] = [];

  console.log(
    '[music-context] Assembling context for:',
    metadata.title,
    'by',
    metadata.artistName,
  );

  try {
    if (metadata.contentType === 'track') {
      await assembleTrackContext(metadata, dedupeCache, facts, missingSignals);
    } else if (
      metadata.contentType === 'album' ||
      metadata.contentType === 'ep-single'
    ) {
      await assembleReleaseContext(
        metadata,
        dedupeCache,
        facts,
        missingSignals,
      );
    }
    // Playlists: Music Context Layer is a no-op (per design doc non-goals)
  } catch (err) {
    // Any uncaught error in the layer is an enrichment failure — do not let it
    // propagate into the pipeline.
    console.warn('[music-context] Unexpected error during assembly:', err);
  }

  const packet: MusicContextPacket = { facts, missingSignals };
  const evidenceBlocks = factsToEvidenceBlocks(facts);

  console.log(
    `[music-context] Assembly complete: ${facts.length} facts, ${missingSignals.length} missing signals, ${evidenceBlocks.length} evidence blocks`,
  );

  return { packet, evidenceBlocks };
}

// ─── Track assembly ───────────────────────────────────────────────────────────

async function assembleTrackContext(
  metadata: NormalizedMetadata,
  dedupeCache: Map<string, unknown>,
  facts: MusicContextFact[],
  missingSignals: MusicContextMissingSignal[],
): Promise<void> {
  const recording = await resolveMBRecording(metadata, dedupeCache);

  if (!recording) {
    console.log(
      '[music-context] No MusicBrainz recording match — all categories missing',
    );
    missingSignals.push(
      'artist_background',
      'discography_context',
      'release_era',
      'genre_context',
      'credits',
      'featured_artists',
    );
    return;
  }

  console.log(
    `[music-context] ✓ Recording matched: ${recording.recordingId} (${recording.confidence})`,
  );

  // Artist background + discography
  for (const mbid of recording.artistMbids.slice(0, 2)) {
    await assembleArtistFacts(mbid, dedupeCache, facts, missingSignals);
  }

  // Release era + genre from release group
  if (recording.releaseGroupId) {
    await assembleReleaseGroupFacts(
      recording,
      dedupeCache,
      facts,
      missingSignals,
    );
  } else {
    missingSignals.push('release_era', 'genre_context', 'release_concept');
  }

  // Credits from recording relations
  if (recording.recordingId) {
    await assembleRecordingCredits(
      recording,
      dedupeCache,
      facts,
      missingSignals,
    );
  } else {
    missingSignals.push('credits', 'featured_artists');
  }
}

// ─── Album / EP assembly ──────────────────────────────────────────────────────

async function assembleReleaseContext(
  metadata: NormalizedMetadata,
  dedupeCache: Map<string, unknown>,
  facts: MusicContextFact[],
  missingSignals: MusicContextMissingSignal[],
): Promise<void> {
  const release = await resolveMBRelease(metadata, dedupeCache);

  if (!release) {
    console.log(
      '[music-context] No MusicBrainz release match — all categories missing',
    );
    missingSignals.push(
      'artist_background',
      'discography_context',
      'release_concept',
      'release_era',
      'genre_context',
      'album_continuity',
    );
    return;
  }

  console.log(
    `[music-context] ✓ Release matched: ${release.releaseId} (${release.confidence})`,
  );

  // Artist facts
  for (const mbid of release.artistMbids.slice(0, 2)) {
    await assembleArtistFacts(mbid, dedupeCache, facts, missingSignals);
  }

  // Release group for concept + genre + era
  if (release.releaseGroupId) {
    const rgFacts = await assembleReleaseGroupFacts(
      {
        releaseGroupId: release.releaseGroupId,
        releaseDate: release.releaseDate,
        confidence: release.confidence,
      },
      dedupeCache,
      facts,
      missingSignals,
    );
    if (!rgFacts) {
      missingSignals.push('release_concept');
    }
  } else {
    missingSignals.push('release_concept', 'release_era', 'genre_context');
  }

  // Album continuity from tracklist
  if (release.releaseId) {
    await assembleAlbumContinuity(release, dedupeCache, facts, missingSignals);
  } else {
    missingSignals.push('album_continuity');
  }
}

// ─── Artist facts ─────────────────────────────────────────────────────────────

async function assembleArtistFacts(
  mbid: string,
  dedupeCache: Map<string, unknown>,
  facts: MusicContextFact[],
  missingSignals: MusicContextMissingSignal[],
): Promise<void> {
  const artist = await getMBArtistDetail(mbid, dedupeCache);

  if (!artist) {
    if (!missingSignals.includes('artist_background')) {
      missingSignals.push('artist_background');
    }
    return;
  }

  // Country / origin
  if (artist.country || artist['begin-area']?.name) {
    const origin = artist['begin-area']?.name ?? artist.country ?? '';
    facts.push({
      category: 'artist_background',
      label: 'Artist background',
      text: buildArtistBackgroundText(artist.name, origin, artist['life-span']),
      provider: 'musicbrainz',
      sourceId: mbid,
      confidence: 'medium',
      promptSafe: true,
    });
  } else {
    if (!missingSignals.includes('artist_background')) {
      missingSignals.push('artist_background');
    }
  }

  // Genre tags from MusicBrainz artist
  const tags = mergeAndRankTags(artist.tags ?? [], artist.genres ?? []);
  if (tags.length > 0) {
    facts.push({
      category: 'genre_context',
      label: 'Artist genre tags',
      text: tags.join(', '),
      provider: 'musicbrainz',
      sourceId: mbid,
      confidence: 'medium',
      promptSafe: true,
    });
  }
}

function buildArtistBackgroundText(
  name: string,
  origin: string,
  lifeSpan?: { begin?: string; end?: string; ended?: boolean },
): string {
  const parts: string[] = [`${name} is a recording artist`];
  if (origin) parts.push(`from ${origin}`);
  if (lifeSpan?.begin) {
    const year = lifeSpan.begin.slice(0, 4);
    parts.push(`active since ${year}`);
  }
  if (lifeSpan?.ended) {
    parts.push('(no longer active)');
  }
  return parts.join(' ') + '.';
}

// ─── Release group facts ──────────────────────────────────────────────────────

async function assembleReleaseGroupFacts(
  ref: { releaseGroupId?: string; releaseDate?: string; confidence: string },
  dedupeCache: Map<string, unknown>,
  facts: MusicContextFact[],
  missingSignals: MusicContextMissingSignal[],
): Promise<boolean> {
  if (!ref.releaseGroupId) return false;

  const rg = await getMBReleaseGroupDetail(ref.releaseGroupId, dedupeCache);
  if (!rg) return false;

  // Release era
  const releaseYear =
    rg['first-release-date']?.slice(0, 4) ?? ref.releaseDate?.slice(0, 4);
  if (releaseYear) {
    facts.push({
      category: 'release_era',
      label: 'Release era',
      text: `Released in ${releaseYear}.`,
      provider: 'musicbrainz',
      sourceId: ref.releaseGroupId,
      confidence: 'high',
      promptSafe: true,
    });
  } else {
    missingSignals.push('release_era');
  }

  // Genre / tags from release group
  const tags = mergeAndRankTags(rg.tags ?? [], rg.genres ?? []);
  if (tags.length > 0) {
    facts.push({
      category: 'genre_context',
      label: 'Release genre tags',
      text: tags.join(', '),
      provider: 'musicbrainz',
      sourceId: ref.releaseGroupId,
      confidence: 'medium',
      promptSafe: true,
    });
  }

  // Release type as concept context
  if (rg['primary-type']) {
    facts.push({
      category: 'release_concept',
      label: 'Release type',
      text: `This is a ${rg['primary-type'].toLowerCase()}.`,
      provider: 'musicbrainz',
      sourceId: ref.releaseGroupId,
      confidence: 'high',
      promptSafe: true,
    });
  } else {
    missingSignals.push('release_concept');
  }

  return true;
}

// ─── Recording credits ────────────────────────────────────────────────────────

async function assembleRecordingCredits(
  recording: MBRecordingMatch,
  dedupeCache: Map<string, unknown>,
  facts: MusicContextFact[],
  missingSignals: MusicContextMissingSignal[],
): Promise<void> {
  const detail = await getMBRecordingDetail(recording.recordingId, dedupeCache);

  if (!detail?.relations || detail.relations.length === 0) {
    missingSignals.push('credits');
    missingSignals.push('featured_artists');
    return;
  }

  const credits = extractCreditsFromRelations(detail.relations);
  const featured = extractFeaturedArtists(
    detail.relations,
    recording.artistCredit,
  );

  if (credits.length > 0) {
    facts.push({
      category: 'credits',
      label: 'Credits',
      text: credits.join('\n'),
      provider: 'musicbrainz',
      sourceId: recording.recordingId,
      confidence: 'medium',
      promptSafe: true,
    });
  } else {
    missingSignals.push('credits');
  }

  if (featured.length > 0) {
    facts.push({
      category: 'featured_artists',
      label: 'Featured artists',
      text: featured.join(', '),
      provider: 'musicbrainz',
      sourceId: recording.recordingId,
      confidence: 'medium',
      promptSafe: true,
    });
  } else {
    missingSignals.push('featured_artists');
  }
}

const CREDIT_RELATION_TYPES: Record<string, string> = {
  composer: 'Composed by',
  lyricist: 'Lyrics by',
  writer: 'Written by',
  producer: 'Produced by',
  'mix-DJ': 'Mixed by',
  arranger: 'Arranged by',
  engineer: 'Engineered by',
};

function extractCreditsFromRelations(relations: MBRelation[]): string[] {
  const credits: string[] = [];
  for (const rel of relations) {
    const label = CREDIT_RELATION_TYPES[rel.type];
    if (label && rel.artist) {
      credits.push(`${label} ${rel.artist.name}`);
    }
  }
  return credits;
}

function extractFeaturedArtists(
  relations: MBRelation[],
  primaryCredit: string,
): string[] {
  return relations
    .filter(
      (rel) =>
        rel.type === 'performer' &&
        rel.attributes?.includes('additional') &&
        rel.artist &&
        !primaryCredit.toLowerCase().includes(rel.artist.name.toLowerCase()),
    )
    .map((rel) => rel.artist!.name);
}

// ─── Album continuity ─────────────────────────────────────────────────────────

async function assembleAlbumContinuity(
  release: MBReleaseMatch,
  dedupeCache: Map<string, unknown>,
  facts: MusicContextFact[],
  missingSignals: MusicContextMissingSignal[],
): Promise<void> {
  const detail = await getMBReleaseDetail(release.releaseId, dedupeCache);

  if (!detail) {
    missingSignals.push('album_continuity');
    return;
  }

  // Build tracklist from media
  const tracks: string[] = [];
  if (detail.media) {
    for (const medium of detail.media) {
      if (medium.tracks) {
        for (const track of medium.tracks) {
          tracks.push(`${track.number}. ${track.title}`);
        }
      }
    }
  }

  if (tracks.length > 0) {
    // Track count for continuity note
    const labelLines = [
      `Tracklist (${tracks.length} track${tracks.length !== 1 ? 's' : ''}):`,
      ...tracks,
    ];

    // Label info
    const labels = detail['label-info']
      ?.map((li) => li.label?.name)
      .filter(Boolean) as string[] | undefined;
    if (labels && labels.length > 0) {
      labelLines.push(`Label: ${labels.join(', ')}`);
    }

    facts.push({
      category: 'album_continuity',
      label: 'Album continuity',
      text: labelLines.join('\n'),
      provider: 'musicbrainz',
      sourceId: release.releaseId,
      confidence: 'high',
      promptSafe: true,
    });
  } else {
    missingSignals.push('album_continuity');
  }
}

// ─── Tag helpers ──────────────────────────────────────────────────────────────

interface TagLike {
  name: string;
  count: number;
}

function mergeAndRankTags(tags: TagLike[], genres: TagLike[]): string[] {
  const merged = new Map<string, number>();
  for (const t of [...tags, ...genres]) {
    merged.set(t.name, (merged.get(t.name) ?? 0) + t.count);
  }
  return [...merged.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name]) => name.toLowerCase());
}

// ─── Facts → EvidenceBlocks ───────────────────────────────────────────────────

// Label map from MusicContextCategory to the EvidenceBlock label string used
// by the existing evidence panel UI.
const CATEGORY_TO_EVIDENCE_LABEL: Record<string, string> = {
  artist_background: 'Artist context',
  discography_context: 'Discography context',
  release_concept: 'Release concept',
  release_era: 'Release era',
  genre_context: 'Genre context',
  credits: 'Credits',
  featured_artists: 'Featured artists',
  album_continuity: 'Album continuity',
};

function factsToEvidenceBlocks(facts: MusicContextFact[]): EvidenceBlock[] {
  return facts
    .filter((f) => f.promptSafe)
    .map((f) => ({
      kind: 'description' as const,
      label: CATEGORY_TO_EVIDENCE_LABEL[f.category] ?? f.label,
      text: f.text,
    }));
}
