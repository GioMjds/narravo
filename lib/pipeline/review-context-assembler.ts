import { detectSections } from './lyrics-normalizer';
import type { RawSection } from './lyrics-normalizer';
import { fetchLyrics } from '@/lib/pipeline/lrclib-client';
import {
  fetchTrackContext,
  fetchAlbumContext,
  fetchArtistContext,
} from '@/lib/pipeline/lastfm-client';
import type {
  NormalizedMetadata,
  ReviewContextPacket,
  EvidenceBlock,
} from '@/lib/pipeline/types';
import { fetchLyricsFromGenius } from './genius-lyrics';

export async function assembleContext(
  metadata: NormalizedMetadata,
  userLyrics?: string,
): Promise<ReviewContextPacket> {
  const evidenceBlocks: EvidenceBlock[] = [];
  const missingSignals: string[] = [];
  let normalizedLyricSections: RawSection[] | null = null;

  // ── Always include normalized metadata ──────────────────────────────────────
  evidenceBlocks.push({
    kind: 'metadata',
    label: 'Release metadata',
    text: formatMetadata(metadata),
  });

  // ── Content-type specific evidence fetches ──────────────────────────────────
  switch (metadata.contentType) {
    case 'track':
      normalizedLyricSections = await assembleTrackEvidence(
        metadata,
        evidenceBlocks,
        missingSignals,
        userLyrics,
      );
      break;
    case 'ep-single':
    case 'album':
      await assembleAlbumEvidence(metadata, evidenceBlocks, missingSignals);
      break;
    case 'playlist':
      await assemblePlaylistEvidence(metadata, evidenceBlocks, missingSignals);
      break;
  }

  // ── Always try artist context ────────────────────────────────────────────────
  const artistCtx = await fetchArtistContext(metadata.artistName);
  if (artistCtx.bioSummary) {
    evidenceBlocks.push({
      kind: 'description',
      label: 'Artist background',
      text: artistCtx.bioSummary,
    });
  } else {
    missingSignals.push('artist biography');
  }

  if (artistCtx.tags.length > 0) {
    evidenceBlocks.push({
      kind: 'metadata',
      label: 'Artist genre tags',
      text: artistCtx.tags.join(', '),
    });
  }

  // ── Derive confidence inputs ──────────────────────────────────────────────────
  const hasLyrics = evidenceBlocks.some((b) => b.kind === 'lyrics');
  const hasDescription = evidenceBlocks.some((b) => b.kind === 'description');
  const hasTracklist = evidenceBlocks.some((b) => b.kind === 'tracklist');

  // Coverage bands:
  // rich    = lyrics present, OR description + tags present
  // partial = at least metadata + one enrichment signal
  // sparse  = metadata only
  const enrichmentCount = evidenceBlocks.filter(
    (b) => b.kind !== 'metadata',
  ).length;

  const coverage =
    hasLyrics || (hasDescription && enrichmentCount >= 2)
      ? 'rich'
      : enrichmentCount >= 1
        ? 'partial'
        : 'sparse';

  return {
    metadata,
    evidenceBlocks,
    coverage,
    missingSignals,
    confidenceInputs: { hasLyrics, hasDescription, hasTracklist },
    normalizedLyricSections: normalizedLyricSections,
  };
}

// ─── Track ────────────────────────────────────────────────────────────────────

async function assembleTrackEvidence(
  metadata: NormalizedMetadata,
  blocks: EvidenceBlock[],
  missing: string[],
  userLyrics?: string,
): Promise<RawSection[] | null> {
  let normalizedLyricSections: RawSection[] | null = null;

  if (userLyrics) {
    console.log('[assembler] ✓ Lyrics from lrclib');
    blocks.push({
      kind: 'lyrics',
      label: 'Lyrics',
      text: userLyrics,
    });
    normalizedLyricSections = detectSections(userLyrics);
  } else {
    const lyricsResult = await fetchLyrics(
      metadata.title,
      metadata.artistName,
      metadata.albumOrCollectionTitle || undefined,
    );

    if (lyricsResult.ok) {
      console.log('[assembler] ✓ Lyrics from lrclib');
      blocks.push({ kind: 'lyrics', label: 'Lyrics', text: lyricsResult.lyrics });
      normalizedLyricSections = detectSections(lyricsResult.lyrics);
    } else {
      console.log(`[assembler] lrclib miss — trying Genius`);
      const geniusResult = await fetchLyricsFromGenius(
        metadata.title,
        metadata.artistName,
      );

      if (geniusResult.ok) {
        console.log('[assembler] ✓ Lyrics from Genius');
        blocks.push({ kind: 'lyrics', label: 'Lyrics', text: geniusResult.lyrics });
        normalizedLyricSections = detectSections(geniusResult.lyrics);
      } else {
        console.log('[assembler] No lyrics from any source');
        missing.push('lyrics');
      }
    }
  }

  // Track-level Last.fm context
  const trackCtx = await fetchTrackContext(metadata.title, metadata.artistName);

  if (trackCtx.wikiSummary) {
    blocks.push({
      kind: 'description',
      label: 'Track notes',
      text: trackCtx.wikiSummary,
    });
  } else {
    missing.push('track description');
  }

  if (trackCtx.tags.length > 0) {
    blocks.push({
      kind: 'metadata',
      label: 'Track genre tags',
      text: trackCtx.tags.join(', '),
    });
  }

  // Album context for the track's parent release
  if (metadata.albumOrCollectionTitle) {
    const albumCtx = await fetchAlbumContext(
      metadata.albumOrCollectionTitle,
      metadata.artistName,
    );

    if (albumCtx.wikiSummary) {
      blocks.push({
        kind: 'description',
        label: 'Album context',
        text: albumCtx.wikiSummary,
      });
    }
  }

  return normalizedLyricSections;
}

// ─── Album / EP ───────────────────────────────────────────────────────────────

async function assembleAlbumEvidence(
  metadata: NormalizedMetadata,
  blocks: EvidenceBlock[],
  missing: string[],
): Promise<null> {
  const albumCtx = await fetchAlbumContext(
    metadata.albumOrCollectionTitle || metadata.title,
    metadata.artistName,
  );

  if (albumCtx.wikiSummary) {
    blocks.push({
      kind: 'description',
      label: 'Album description',
      text: albumCtx.wikiSummary,
    });
  } else {
    missing.push('album description');
  }

  if (albumCtx.tags.length > 0) {
    blocks.push({
      kind: 'metadata',
      label: 'Album genre tags',
      text: albumCtx.tags.join(', '),
    });
  }

  if (albumCtx.tracklist && albumCtx.tracklist.length > 0) {
    blocks.push({
      kind: 'tracklist',
      label: 'Tracklist',
      text: albumCtx.tracklist.map((t, i) => `${i + 1}. ${t}`).join('\n'),
    });
  } else {
    missing.push('tracklist');
  }

  return null;
}

// ─── Playlist ─────────────────────────────────────────────────────────────────

async function assemblePlaylistEvidence(
  metadata: NormalizedMetadata,
  blocks: EvidenceBlock[],
  missing: string[],
): Promise<null> {
  // Playlists have no Last.fm equivalent — metadata + artist tags
  // are the main signals. Mark the key gaps explicitly.
  missing.push('playlist editorial description');
  missing.push('individual track lyrics');

  // If playlist has a description from the resolver, include it
  if (
    metadata.albumOrCollectionTitle &&
    metadata.albumOrCollectionTitle !== metadata.title
  ) {
    blocks.push({
      kind: 'description',
      label: 'Playlist description',
      text: metadata.albumOrCollectionTitle,
    });
  }

  return null;
}

// ─── Metadata formatter ───────────────────────────────────────────────────────

function formatMetadata(m: NormalizedMetadata): string {
  return [
    `Title: ${m.title}`,
    `Artist: ${m.artistName}`,
    m.albumOrCollectionTitle ? `Release: ${m.albumOrCollectionTitle}` : null,
    `Platform: ${m.platform}`,
    `Release label: ${m.releaseLabel}`,
    m.trackCount != null ? `Track count: ${m.trackCount}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}
