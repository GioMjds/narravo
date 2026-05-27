import type { NormalizedMetadata, ContentType } from './types';

// ─── Raw iTunes response shapes ──────────────────────────────────────────────

type iTunesTrackResult = {
  wrapperType: 'track';
  kind: 'song';
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
  releaseDate: string;
  primaryGenreName: string;
  trackCount?: number;
  trackViewUrl: string;
};

type iTunesCollectionResult = {
  wrapperType: 'collection';
  collectionType: string; // 'Album'
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl100: string;
  releaseDate: string;
  trackCount: number;
  primaryGenreName: string;
  collectionViewUrl: string;
};

type iTunesSearchResponse = {
  resultCount: number;
  results: (iTunesTrackResult | iTunesCollectionResult | Record<string, unknown>)[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// iTunes artwork URLs are 100x100 — replace with 600x600
function upgradeArtwork(url: string): string {
  return url.replace('100x100bb', '600x600bb');
}

function formatReleaseLabel(collectionName: string, releaseDate: string, suffix: string): string {
  const year = releaseDate.slice(0, 4);
  return `${collectionName} · ${year} · ${suffix}`;
}

// ─── Search ──────────────────────────────────────────────────────────────────

async function iTunesSearch(
  term: string,
  entity: 'song' | 'album' | 'playlist',
  limit = 5,
): Promise<iTunesSearchResponse> {
  const params = new URLSearchParams({
    term,
    media: 'music',
    entity,
    limit: String(limit),
  });

  const res = await fetch(
    `https://itunes.apple.com/search?${params.toString()}`,
    { cache: 'no-store' },
  );

  if (!res.ok) {
    throw new Error(`iTunes search failed: ${res.status}`);
  }

  return res.json() as Promise<iTunesSearchResponse>;
}

// ─── Public resolvers ─────────────────────────────────────────────────────────

export async function resolveTrackFromItunes(
  title: string,
  artistHint: string | null,
  sourceUrl: string,
): Promise<NormalizedMetadata | null> {
  // Build query: "title artistHint" gives much better precision than title alone
  const term = artistHint ? `${title} ${artistHint}` : title;
  const data = await iTunesSearch(term, 'song');

  const track = data.results.find(
    (r): r is iTunesTrackResult =>
      (r as iTunesTrackResult).wrapperType === 'track' &&
      (r as iTunesTrackResult).kind === 'song',
  );

  if (!track) return null;

  return {
    sourceUrl,
    platform: 'spotify',
    contentType: 'track',
    title: track.trackName,
    artistName: track.artistName,
    albumOrCollectionTitle: track.collectionName,
    coverArtUrl: upgradeArtwork(track.artworkUrl100),
    releaseLabel: formatReleaseLabel(track.collectionName, track.releaseDate, 'Spotify'),
    trackCount: undefined,
  };
}

export async function resolveAlbumFromItunes(
  title: string,
  artistHint: string | null,
  sourceUrl: string,
): Promise<NormalizedMetadata | null> {
  const term = artistHint ? `${title} ${artistHint}` : title;
  const data = await iTunesSearch(term, 'album');

  const album = data.results.find(
    (r): r is iTunesCollectionResult =>
      (r as iTunesCollectionResult).wrapperType === 'collection',
  );

  if (!album) return null;

  // Same EP heuristic as before
  const contentType: ContentType = album.trackCount <= 6 ? 'ep-single' : 'album';

  return {
    sourceUrl,
    platform: 'spotify',
    contentType,
    title: album.collectionName,
    artistName: album.artistName,
    albumOrCollectionTitle: album.collectionName,
    coverArtUrl: upgradeArtwork(album.artworkUrl100),
    releaseLabel: formatReleaseLabel(album.collectionName, album.releaseDate, 'Spotify'),
    trackCount: album.trackCount,
  };
}