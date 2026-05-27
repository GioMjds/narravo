import { getSpotifyToken } from './spotify-token';
import { fetchSpotifyOembed } from './spotify-oembed';
import {
  resolveTrackFromItunes,
  resolveAlbumFromItunes,
} from './itunes-client';
import type { NormalizedMetadata, ContentType } from './types';

// ─── Spotify Web API response shapes ─────────────────────────────────────────

type SpotifyImage = { url: string; width: number; height: number };

type SpotifyTrackResponse = {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: {
    id: string;
    name: string;
    images: SpotifyImage[];
    release_date: string;
    album_type: string;
    total_tracks: number;
  };
  external_urls: { spotify: string };
};

type SpotifyAlbumResponse = {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  images: SpotifyImage[];
  release_date: string;
  album_type: string;
  total_tracks: number;
  external_urls: { spotify: string };
};

type SpotifyPlaylistResponse = {
  id: string;
  name: string;
  description: string;
  owner: { display_name: string };
  images: SpotifyImage[];
  tracks: { total: number };
  external_urls: { spotify: string };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bestSpotifyImage(images: SpotifyImage[]): string {
  if (!images.length) return '';
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted[0].url;
}

function formatArtists(artists: { name: string }[]): string {
  return artists.map((a) => a.name).join(', ');
}

function formatReleaseLabel(
  collectionName: string,
  releaseDate: string,
  suffix: string,
): string {
  const year = releaseDate.slice(0, 4);
  return `${collectionName} · ${year} · ${suffix}`;
}

async function spotifyApiFetch<T>(
  path: string,
  resourceId: string,
): Promise<T> {
  const token = await getSpotifyToken();
  const url = `https://api.spotify.com/v1/${path}/${resourceId}`;

  console.log(`[spotifyApiFetch] GET ${url}`);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch {
      body = '(unreadable)';
    }
    console.error(`[spotifyApiFetch] HTTP ${res.status}`);
    console.error(`[spotifyApiFetch] Body: ${body.slice(0, 300)}`);

    if (res.status === 404) throw new Error('spotify_not_found');
    if (res.status === 429) throw new Error('spotify_rate_limited');
    if (res.status === 401) throw new Error('spotify_unauthorized');
    if (res.status === 403) throw new Error('spotify_forbidden');
    throw new Error(`spotify_error:${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── oEmbed + iTunes fallback — with exact artist matching ───────────────────
//
// iTunes search is fuzzy. When the artist hint from oEmbed is incomplete or
// wrong, iTunes returns the most popular result for the title, which may be a
// cover or different artist entirely.
//
// Fix: after iTunes returns a result, verify the artist name roughly matches
// the hint before accepting it. If the match fails, build minimal metadata
// from oEmbed alone rather than returning wrong data.

function artistsRoughlyMatch(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const na = normalize(a);
  const nb = normalize(b);
  // Accept if one contains the other (handles "The Beatles" vs "Beatles")
  return na.includes(nb) || nb.includes(na);
}

// ─── Public resolvers ─────────────────────────────────────────────────────────

export async function resolveSpotifyTrack(
  id: string,
  sourceUrl: string,
): Promise<NormalizedMetadata> {
  console.log(`[spotify] Resolving track ID: ${id}`);

  // ── Primary path: Spotify Web API ─────────────────────────────────────────
  try {
    const track = await spotifyApiFetch<SpotifyTrackResponse>('tracks', id);

    const artistName = formatArtists(track.artists);
    const albumName = track.album.name;
    const coverArtUrl = bestSpotifyImage(track.album.images);

    console.log(
      `[spotify] ✓ Web API resolved: "${track.name}" by "${artistName}"`,
    );

    return {
      sourceUrl,
      platform: 'spotify',
      contentType: 'track',
      title: track.name,
      artistName,
      albumOrCollectionTitle: albumName,
      coverArtUrl,
      releaseLabel: formatReleaseLabel(
        albumName,
        track.album.release_date,
        'Spotify',
      ),
      trackCount: undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg === 'spotify_not_found' || msg === 'spotify_rate_limited') {
      throw err;
    }

    console.warn(
      `[spotify] Web API failed (${msg}), falling back to oEmbed + iTunes`,
    );
  }

  // ── Fallback: oEmbed → iTunes (with artist verification) ─────────────────
  const oembed = await fetchSpotifyOembed(sourceUrl);

  if (!oembed.ok) {
    if (oembed.status === 404) throw new Error('spotify_not_found');
    throw new Error(`spotify_error:${oembed.status}`);
  }

  console.log(
    `[spotify] oEmbed title: "${oembed.title}" | artistHint: "${oembed.artistHint}"`,
  );

  if (oembed.artistHint) {
    const itunes = await resolveTrackFromItunes(
      oembed.title,
      oembed.artistHint,
      sourceUrl,
    );

    if (itunes) {
      // Verify iTunes didn't return the wrong artist
      if (artistsRoughlyMatch(itunes.artistName, oembed.artistHint)) {
        console.log(
          `[spotify] ✓ iTunes match accepted: "${itunes.title}" by "${itunes.artistName}"`,
        );
        return {
          ...itunes,
          coverArtUrl: itunes.coverArtUrl || oembed.thumbnailUrl,
        };
      } else {
        console.warn(
          `[spotify] ✗ iTunes artist mismatch: got "${itunes.artistName}", expected "${oembed.artistHint}" — using oEmbed data`,
        );
      }
    }
  }

  // oEmbed-only fallback — at least title/artist/cover are correct
  console.log(`[spotify] Using oEmbed stub for "${oembed.title}"`);
  return {
    sourceUrl,
    platform: 'spotify',
    contentType: 'track',
    title: oembed.title,
    artistName: oembed.artistHint ?? 'Unknown Artist',
    albumOrCollectionTitle: '',
    coverArtUrl: oembed.thumbnailUrl,
    releaseLabel: 'Spotify',
    trackCount: undefined,
  };
}

export async function resolveSpotifyAlbum(
  id: string,
  sourceUrl: string,
): Promise<NormalizedMetadata> {
  console.log(`[spotify] Resolving album ID: ${id}`);

  // ── Primary path: Spotify Web API ─────────────────────────────────────────
  try {
    const album = await spotifyApiFetch<SpotifyAlbumResponse>('albums', id);

    const artistName = formatArtists(album.artists);
    const coverArtUrl = bestSpotifyImage(album.images);
    const contentType: ContentType =
      album.album_type === 'single' || album.total_tracks <= 6
        ? 'ep-single'
        : 'album';

    console.log(
      `[spotify] ✓ Web API resolved album: "${album.name}" by "${artistName}" (${contentType})`,
    );

    return {
      sourceUrl,
      platform: 'spotify',
      contentType,
      title: album.name,
      artistName,
      albumOrCollectionTitle: album.name,
      coverArtUrl,
      releaseLabel: formatReleaseLabel(
        album.name,
        album.release_date,
        'Spotify',
      ),
      trackCount: album.total_tracks,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg === 'spotify_not_found' || msg === 'spotify_rate_limited') {
      throw err;
    }

    console.warn(
      `[spotify] Web API failed for album (${msg}), falling back to oEmbed + iTunes`,
    );
  }

  // ── Fallback: oEmbed → iTunes ─────────────────────────────────────────────
  const oembed = await fetchSpotifyOembed(sourceUrl);

  if (!oembed.ok) {
    if (oembed.status === 404) throw new Error('spotify_not_found');
    throw new Error(`spotify_error:${oembed.status}`);
  }

  const metadata = await resolveAlbumFromItunes(
    oembed.title,
    oembed.artistHint,
    sourceUrl,
  );

  if (!metadata) {
    return {
      sourceUrl,
      platform: 'spotify',
      contentType: 'album',
      title: oembed.title,
      artistName: oembed.artistHint ?? 'Unknown Artist',
      albumOrCollectionTitle: oembed.title,
      coverArtUrl: oembed.thumbnailUrl,
      releaseLabel: 'Spotify',
      trackCount: undefined,
    };
  }

  return metadata;
}

export async function resolveSpotifyPlaylist(
  id: string,
  sourceUrl: string,
): Promise<NormalizedMetadata> {
  console.log(`[spotify] Resolving playlist ID: ${id}`);

  // ── Primary path: Spotify Web API ─────────────────────────────────────────
  try {
    const playlist = await spotifyApiFetch<SpotifyPlaylistResponse>(
      'playlists',
      id,
    );

    const coverArtUrl = bestSpotifyImage(playlist.images);
    const ownerName = playlist.owner.display_name || 'Spotify';

    console.log(
      `[spotify] ✓ Web API resolved playlist: "${playlist.name}" by "${ownerName}" (${playlist.tracks.total} tracks)`,
    );

    return {
      sourceUrl,
      platform: 'spotify',
      contentType: 'playlist',
      title: playlist.name,
      artistName: ownerName,
      albumOrCollectionTitle: playlist.name,
      coverArtUrl,
      releaseLabel: 'Spotify Playlist',
      trackCount: playlist.tracks.total,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg === 'spotify_not_found' || msg === 'spotify_rate_limited') {
      throw err;
    }

    console.warn(
      `[spotify] Web API failed for playlist (${msg}), falling back to oEmbed`,
    );
  }

  // ── Fallback: oEmbed only ─────────────────────────────────────────────────
  const oembed = await fetchSpotifyOembed(sourceUrl);

  if (!oembed.ok) {
    if (oembed.status === 404) throw new Error('spotify_not_found');
    throw new Error(`spotify_error:${oembed.status}`);
  }

  return {
    sourceUrl,
    platform: 'spotify',
    contentType: 'playlist',
    title: oembed.title,
    artistName: oembed.artistHint ?? 'Spotify',
    albumOrCollectionTitle: oembed.title,
    coverArtUrl: oembed.thumbnailUrl,
    releaseLabel: 'Spotify Playlist',
    trackCount: undefined,
  };
}
