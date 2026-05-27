import type { NormalizedMetadata, ContentType } from './types';

// ─── Raw iTunes response shapes ───────────────────────────────────────────────

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
  collectionType: string;
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
  results: (
    | iTunesTrackResult
    | iTunesCollectionResult
    | Record<string, unknown>
  )[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function upgradeArtwork(url: string): string {
  return url.replace('100x100bb', '600x600bb');
}

function formatReleaseLabel(
  collectionName: string,
  releaseDate: string,
  suffix: string,
): string {
  const year = releaseDate.slice(0, 4);
  return `${collectionName} · ${year} · ${suffix}`;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check whether the iTunes result artist is a reasonable match for the hint.
 * Handles:
 *  - Exact match: "Adele" === "Adele"
 *  - Substring: "The Beatles" contains "Beatles"
 *  - Featured artists: hint="Ed Sheeran" result="Ed Sheeran feat. Beyoncé"
 *  - Multiple primary artists: result="Travis Scott, Drake"
 */
function artistMatchesHint(resultArtist: string, hint: string): boolean {
  const nr = normalize(resultArtist);
  const nh = normalize(hint);
  if (!nh) return true; // no hint — can't verify
  return nr.includes(nh) || nh.includes(nr);
}

// ─── Search ───────────────────────────────────────────────────────────────────

async function iTunesSearch(
  term: string,
  entity: 'song' | 'album',
  limit = 10,
): Promise<iTunesSearchResponse> {
  const params = new URLSearchParams({
    term,
    media: 'music',
    entity,
    limit: String(limit),
  });

  const url = `https://itunes.apple.com/search?${params.toString()}`;
  console.log(`[itunes] GET ${url}`);

  const res = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });

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
  // Search with artist hint for precision; fall back to title-only if no results
  const term = artistHint ? `${title} ${artistHint}` : title;

  let data: iTunesSearchResponse;
  try {
    data = await iTunesSearch(term, 'song');
  } catch (err) {
    console.warn(
      `[itunes] Search failed: ${err instanceof Error ? err.message : err}`,
    );
    return null;
  }

  console.log(`[itunes] Track search "${term}" → ${data.resultCount} results`);

  const tracks = data.results.filter(
    (r): r is iTunesTrackResult =>
      (r as iTunesTrackResult).wrapperType === 'track' &&
      (r as iTunesTrackResult).kind === 'song',
  );

  if (!tracks.length) {
    console.log(`[itunes] No track results`);
    return null;
  }

  // If we have an artist hint, find the first result whose artist matches.
  // This prevents iTunes returning a popular cover when the actual artist
  // is less well-known globally.
  let track: iTunesTrackResult | undefined;

  if (artistHint) {
    track = tracks.find((t) => artistMatchesHint(t.artistName, artistHint));

    if (!track) {
      console.warn(
        `[itunes] No artist match for hint "${artistHint}" among: ${tracks.map((t) => t.artistName).join(', ')}`,
      );
      // Last resort: return the top result anyway but log the mismatch
      // so the caller (spotify-client) can decide to reject it
      track = tracks[0];
      console.warn(
        `[itunes] Falling back to top result: "${track.trackName}" by "${track.artistName}"`,
      );
    } else {
      console.log(
        `[itunes] ✓ Artist match: "${track.trackName}" by "${track.artistName}"`,
      );
    }
  } else {
    track = tracks[0];
    console.log(
      `[itunes] No hint — using top result: "${track.trackName}" by "${track.artistName}"`,
    );
  }

  if (!track) return null;

  return {
    sourceUrl,
    platform: 'spotify',
    contentType: 'track',
    title: track.trackName,
    artistName: track.artistName,
    albumOrCollectionTitle: track.collectionName,
    coverArtUrl: upgradeArtwork(track.artworkUrl100),
    releaseLabel: formatReleaseLabel(
      track.collectionName,
      track.releaseDate,
      'Spotify',
    ),
    trackCount: undefined,
  };
}

export async function resolveAlbumFromItunes(
  title: string,
  artistHint: string | null,
  sourceUrl: string,
): Promise<NormalizedMetadata | null> {
  const term = artistHint ? `${title} ${artistHint}` : title;

  let data: iTunesSearchResponse;
  try {
    data = await iTunesSearch(term, 'album');
  } catch (err) {
    console.warn(
      `[itunes] Album search failed: ${err instanceof Error ? err.message : err}`,
    );
    return null;
  }

  console.log(`[itunes] Album search "${term}" → ${data.resultCount} results`);

  const albums = data.results.filter(
    (r): r is iTunesCollectionResult =>
      (r as iTunesCollectionResult).wrapperType === 'collection',
  );

  if (!albums.length) {
    console.log(`[itunes] No album results`);
    return null;
  }

  let album: iTunesCollectionResult | undefined;

  if (artistHint) {
    album = albums.find((a) => artistMatchesHint(a.artistName, artistHint));

    if (!album) {
      console.warn(
        `[itunes] No artist match for hint "${artistHint}" among: ${albums.map((a) => a.artistName).join(', ')}`,
      );
      album = albums[0];
    } else {
      console.log(
        `[itunes] ✓ Artist match: "${album.collectionName}" by "${album.artistName}"`,
      );
    }
  } else {
    album = albums[0];
  }

  if (!album) return null;

  const contentType: ContentType =
    album.trackCount <= 6 ? 'ep-single' : 'album';

  return {
    sourceUrl,
    platform: 'spotify',
    contentType,
    title: album.collectionName,
    artistName: album.artistName,
    albumOrCollectionTitle: album.collectionName,
    coverArtUrl: upgradeArtwork(album.artworkUrl100),
    releaseLabel: formatReleaseLabel(
      album.collectionName,
      album.releaseDate,
      'Spotify',
    ),
    trackCount: album.trackCount,
  };
}
