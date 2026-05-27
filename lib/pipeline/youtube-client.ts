import type { NormalizedMetadata, ContentType } from './types';

const BASE = 'https://www.googleapis.com/youtube/v3';

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('Missing YOUTUBE_API_KEY');
  return key;
}

// ─── Raw response shapes ──────────────────────────────────────────────────────

type YTPlaylistResponse = {
  items: {
    snippet: {
      title: string;
      description: string;
      channelTitle: string;
      publishedAt: string;
      thumbnails: {
        maxres?: { url: string };
        high?: { url: string };
        default?: { url: string };
      };
    };
    contentDetails: {
      itemCount: number;
    };
  }[];
};

type YTVideoResponse = {
  items: {
    snippet: {
      title: string;
      description: string;
      channelTitle: string;
      publishedAt: string;
      thumbnails: {
        maxres?: { url: string };
        high?: { url: string };
        default?: { url: string };
      };
    };
    contentDetails: {
      duration: string; // ISO 8601 e.g. PT3M45S
    };
  }[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bestThumbnail(
  thumbnails: YTPlaylistResponse['items'][0]['snippet']['thumbnails'],
): string {
  return (
    thumbnails.maxres?.url ??
    thumbnails.high?.url ??
    thumbnails.default?.url ??
    ''
  );
}

function formatReleaseLabel(
  collectionName: string,
  publishedAt: string,
  suffix: string,
): string {
  const year = publishedAt.slice(0, 4);
  return `${collectionName} · ${year} · ${suffix}`;
}

// ─── Public resolvers ─────────────────────────────────────────────────────────

export async function resolveYouTubeMusicPlaylist(
  playlistId: string,
  sourceUrl: string,
): Promise<NormalizedMetadata> {
  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    id: playlistId,
    key: getApiKey(),
  });

  const res = await fetch(`${BASE}/playlists?${params}`, { cache: 'no-store' });

  if (res.status === 403) throw new Error('youtube_quota_exceeded');
  if (!res.ok) throw new Error(`youtube_error:${res.status}`);

  const data = (await res.json()) as YTPlaylistResponse;
  const item = data.items[0];

  if (!item) throw new Error('youtube_not_found');

  const { snippet, contentDetails } = item;

  return {
    sourceUrl,
    platform: 'youtube-music',
    contentType: 'playlist',
    title: snippet.title,
    artistName: snippet.channelTitle,
    albumOrCollectionTitle: snippet.title,
    coverArtUrl: bestThumbnail(snippet.thumbnails),
    releaseLabel: formatReleaseLabel(
      snippet.title,
      snippet.publishedAt,
      'YouTube Music',
    ),
    trackCount: contentDetails.itemCount,
  };
}

export async function resolveYouTubeMusicVideo(
  videoId: string,
  sourceUrl: string,
): Promise<NormalizedMetadata> {
  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    id: videoId,
    key: getApiKey(),
  });

  const res = await fetch(`${BASE}/videos?${params}`, { cache: 'no-store' });

  if (res.status === 403) throw new Error('youtube_quota_exceeded');
  if (!res.ok) throw new Error(`youtube_error:${res.status}`);

  const data = (await res.json()) as YTVideoResponse;
  const item = data.items[0];

  if (!item) throw new Error('youtube_not_found');

  const { snippet } = item;

  // YouTube Music video titles are often "Artist - Track Name"
  // Split on first " - " to extract artist and title separately
  const titleRaw = snippet.title;
  const dashIndex = titleRaw.indexOf(' - ');
  const hasArtistPrefix = dashIndex !== -1;

  const title = hasArtistPrefix
    ? titleRaw.slice(dashIndex + 3).trim()
    : titleRaw;
  const artistName = hasArtistPrefix
    ? titleRaw.slice(0, dashIndex).trim()
    : snippet.channelTitle;

  return {
    sourceUrl,
    platform: 'youtube-music',
    contentType: 'track',
    title,
    artistName,
    albumOrCollectionTitle: snippet.channelTitle,
    coverArtUrl: bestThumbnail(snippet.thumbnails),
    releaseLabel: formatReleaseLabel(
      snippet.channelTitle,
      snippet.publishedAt,
      'YouTube Music',
    ),
    trackCount: undefined,
  };
}
