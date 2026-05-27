import {
  resolveSpotifyTrack,
  resolveSpotifyAlbum,
  resolveSpotifyPlaylist,
} from './spotify-client';
import {
  resolveYouTubeMusicVideo,
  resolveYouTubeMusicPlaylist,
} from './youtube-client';
import { fetchYouTubeOembed } from './youtube-oembed';
import { resolveTrackFromItunes } from './itunes-client';
import type { NormalizedMetadata, PipelineError } from './types';

type ResolveResult =
  | { ok: true; metadata: NormalizedMetadata }
  | { ok: false; error: PipelineError };

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function resolveSource(url: string): Promise<ResolveResult> {
  let parsed: URL;

  try {
    parsed = new URL(url.trim());
  } catch {
    return {
      ok: false,
      error: {
        code: 'resolve_failure',
        message: 'The URL could not be parsed.',
      },
    };
  }

  const host = parsed.hostname.toLowerCase();

  if (host.includes('spotify.com')) {
    return resolveSpotifyUrl(parsed, url);
  }

  if (host === 'music.youtube.com' || host === 'www.music.youtube.com') {
    return resolveYouTubeMusicUrl(parsed, url);
  }

  if (host.includes('youtube.com') || host === 'youtu.be') {
    return {
      ok: false,
      error: {
        code: 'unsupported_platform',
        message:
          'Standard YouTube links are not supported. Use a music.youtube.com URL instead.',
      },
    };
  }

  return {
    ok: false,
    error: {
      code: 'unsupported_platform',
      message: 'Only Spotify and YouTube Music links are supported.',
    },
  };
}

// ─── Spotify branch ───────────────────────────────────────────────────────────

async function resolveSpotifyUrl(
  parsed: URL,
  rawUrl: string,
): Promise<ResolveResult> {
  // Strip query params from pathname — Spotify share links include ?si=...
  const segments = parsed.pathname.split('/').filter(Boolean);
  const [type, id] = segments;

  if (!id) {
    return {
      ok: false,
      error: {
        code: 'resolve_failure',
        message: 'This Spotify link is missing a resource ID.',
      },
    };
  }

  try {
    switch (type) {
      case 'track':
        return { ok: true, metadata: await resolveSpotifyTrack(id, rawUrl) };
      case 'album':
        return { ok: true, metadata: await resolveSpotifyAlbum(id, rawUrl) };
      case 'playlist':
        return { ok: true, metadata: await resolveSpotifyPlaylist(id, rawUrl) };
      default:
        return {
          ok: false,
          error: {
            code: 'unsupported_platform',
            message: `Spotify resource type "${type}" is not supported in this MVP.`,
          },
        };
    }
  } catch (err) {
    return mapSpotifyError(err);
  }
}

function mapSpotifyError(err: unknown): ResolveResult {
  const message = err instanceof Error ? err.message : String(err);

  // True 404 — content doesn't exist or was removed
  if (message === 'spotify_not_found') {
    return {
      ok: false,
      error: {
        code: 'private_track',
        message: 'This track or release could not be found on Spotify.',
      },
    };
  }

  // Rate limited
  if (message === 'spotify_rate_limited') {
    return {
      ok: false,
      error: {
        code: 'rate_limited',
        message: 'Spotify is rate limiting this request. Retry in a moment.',
      },
    };
  }

  // 401/403 should never bubble up here — they're caught inside spotify-client
  // and trigger the oEmbed fallback. If they somehow escape, treat as resolve_failure.
  if (message === 'spotify_unauthorized' || message === 'spotify_forbidden') {
    return {
      ok: false,
      error: {
        code: 'resolve_failure',
        message: `Spotify returned an auth error (${message}). Check SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.`,
      },
    };
  }

  return {
    ok: false,
    error: { code: 'resolve_failure', message: `Spotify error: ${message}` },
  };
}

// ─── YouTube Music branch ─────────────────────────────────────────────────────

async function resolveYouTubeMusicUrl(
  parsed: URL,
  rawUrl: string,
): Promise<ResolveResult> {
  try {
    // Track: /watch?v=VIDEO_ID
    const videoId = parsed.searchParams.get('v');
    if (videoId) {
      return await resolveYouTubeMusicTrack(videoId, rawUrl);
    }

    // Playlist: /playlist?list=PLAYLIST_ID
    const listId = parsed.searchParams.get('list');
    if (listId && parsed.pathname === '/playlist') {
      const metadata = await resolveYouTubeMusicPlaylist(listId, rawUrl);
      return { ok: true, metadata };
    }

    // Browse URLs: /browse/MPREb_... (album) or /browse/VL... (playlist)
    if (parsed.pathname.startsWith('/browse/')) {
      const browseId = parsed.pathname.replace('/browse/', '');
      return await resolveYouTubeMusicBrowse(browseId, rawUrl);
    }

    return {
      ok: false,
      error: {
        code: 'resolve_failure',
        message: 'This YouTube Music URL format is not recognized.',
      },
    };
  } catch (err) {
    return mapYouTubeError(err);
  }
}

async function resolveYouTubeMusicTrack(
  videoId: string,
  rawUrl: string,
): Promise<ResolveResult> {
  // Try YouTube Data API first for richer metadata
  if (process.env.YOUTUBE_API_KEY) {
    try {
      const metadata = await resolveYouTubeMusicVideo(videoId, rawUrl);
      return { ok: true, metadata };
    } catch {
      // Fall through to oEmbed + iTunes
    }
  }

  // Fallback: oEmbed → iTunes
  const oembed = await fetchYouTubeOembed(rawUrl);

  if (!oembed.ok) {
    if (oembed.status === 404) {
      return {
        ok: false,
        error: { code: 'private_track', message: 'This video is unavailable.' },
      };
    }
    return {
      ok: false,
      error: {
        code: 'resolve_failure',
        message: `oEmbed failed: ${oembed.status}`,
      },
    };
  }

  // Parse "Artist - Title" from YouTube video title
  const dashIndex = oembed.title.indexOf(' - ');
  const title =
    dashIndex !== -1 ? oembed.title.slice(dashIndex + 3).trim() : oembed.title;
  const artistHint =
    dashIndex !== -1
      ? oembed.title.slice(0, dashIndex).trim()
      : oembed.authorName;

  // Enrich with iTunes
  const itunes = await resolveTrackFromItunes(title, artistHint, rawUrl);

  if (itunes) {
    return {
      ok: true,
      metadata: {
        ...itunes,
        platform: 'youtube-music',
        coverArtUrl: itunes.coverArtUrl || oembed.thumbnailUrl,
        releaseLabel: itunes.releaseLabel.replace('Spotify', 'YouTube Music'),
      },
    };
  }

  // Minimal fallback from oEmbed alone
  return {
    ok: true,
    metadata: {
      sourceUrl: rawUrl,
      platform: 'youtube-music',
      contentType: 'track',
      title,
      artistName: artistHint,
      albumOrCollectionTitle: '',
      coverArtUrl: oembed.thumbnailUrl,
      releaseLabel: 'YouTube Music',
      trackCount: undefined,
    },
  };
}

async function resolveYouTubeMusicBrowse(
  browseId: string,
  rawUrl: string,
): Promise<ResolveResult> {
  if (browseId.startsWith('VL')) {
    const playlistId = browseId.slice(2);
    const metadata = await resolveYouTubeMusicPlaylist(playlistId, rawUrl);
    return { ok: true, metadata };
  }

  return {
    ok: false,
    error: {
      code: 'unsupported_platform',
      message:
        'YouTube Music album browse URLs are not supported yet. Use a track or playlist URL.',
    },
  };
}

function mapYouTubeError(err: unknown): ResolveResult {
  const message = err instanceof Error ? err.message : String(err);

  if (message === 'youtube_not_found') {
    return {
      ok: false,
      error: {
        code: 'private_track',
        message: 'This video is unavailable or private.',
      },
    };
  }

  if (message === 'youtube_quota_exceeded') {
    return {
      ok: false,
      error: {
        code: 'rate_limited',
        message:
          'YouTube API quota exceeded. Retry tomorrow or reduce request frequency.',
      },
    };
  }

  return {
    ok: false,
    error: { code: 'resolve_failure', message: `YouTube error: ${message}` },
  };
}
