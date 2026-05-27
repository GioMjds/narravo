const BASE = 'https://ws.audioscrobbler.com/2.0';

function getApiKey(): string {
  const key = process.env.LASTFM_API_KEY;
  if (!key) throw new Error('Missing LASTFM_API_KEY');
  return key;
}

async function lastfmGet<T>(params: Record<string, string>): Promise<T | null> {
  const query = new URLSearchParams({
    ...params,
    api_key: getApiKey(),
    format: 'json',
  });

  const res = await fetch(`${BASE}/?${query.toString()}`, {
    cache: 'no-store',
  });

  if (!res.ok) return null;

  const data = (await res.json()) as Record<string, unknown>;

  // Last.fm returns { error: number, message: string } for failures
  if ('error' in data) return null;

  return data as T;
}

// ─── Response shapes ──────────────────────────────────────────────────────────

type LastfmTag = { name: string; count: number };

type LastfmTrackInfoResponse = {
  track: {
    name: string;
    artist: { name: string };
    toptags: { tag: LastfmTag[] };
    wiki?: { summary: string; content: string };
    album?: { title: string };
    duration: string;
  };
};

type LastfmAlbumInfoResponse = {
  album: {
    name: string;
    artist: string;
    tags: { tag: LastfmTag[] };
    wiki?: { summary: string; content: string };
    tracks?: {
      track: { name: string; '@attr': { rank: number } }[];
    };
  };
};

type LastfmArtistInfoResponse = {
  artist: {
    name: string;
    tags: { tag: LastfmTag[] };
    bio: { summary: string; content: string };
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Last.fm wiki text contains HTML and trailing " <a href=...>Read more</a>"
function cleanWikiText(raw: string): string {
  return raw
    .replace(/<a\b[^>]*>.*?<\/a>/gi, '') // strip links
    .replace(/<[^>]+>/g, '') // strip remaining HTML tags
    .replace(/\n{3,}/g, '\n\n') // collapse excess newlines
    .trim();
}

function topTags(tags: LastfmTag[], limit = 5): string[] {
  return tags
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((t) => t.name.toLowerCase());
}

// ─── Public fetchers ──────────────────────────────────────────────────────────

export type TrackContext = {
  tags: string[];
  wikiSummary: string | null;
  duration: string | null;
};

export type AlbumContext = {
  tags: string[];
  wikiSummary: string | null;
  tracklist: string[] | null;
};

export type ArtistContext = {
  tags: string[];
  bioSummary: string | null;
};

export async function fetchTrackContext(
  title: string,
  artistName: string,
): Promise<TrackContext> {
  const data = await lastfmGet<LastfmTrackInfoResponse>({
    method: 'track.getInfo',
    track: title,
    artist: artistName,
    autocorrect: '1',
  });

  if (!data) {
    return { tags: [], wikiSummary: null, duration: null };
  }

  const { track } = data;

  return {
    tags: topTags(track.toptags?.tag ?? []),
    wikiSummary: track.wiki?.summary ? cleanWikiText(track.wiki.summary) : null,
    duration: track.duration ?? null,
  };
}

export async function fetchAlbumContext(
  album: string,
  artistName: string,
): Promise<AlbumContext> {
  const data = await lastfmGet<LastfmAlbumInfoResponse>({
    method: 'album.getInfo',
    album,
    artist: artistName,
    autocorrect: '1',
  });

  if (!data) {
    return { tags: [], wikiSummary: null, tracklist: null };
  }

  const { album: a } = data;

  const tracklist = a.tracks?.track
    ? [...a.tracks.track]
        .sort((x, y) => x['@attr'].rank - y['@attr'].rank)
        .map((t) => t.name)
    : null;

  return {
    tags: topTags(a.tags?.tag ?? []),
    wikiSummary: a.wiki?.summary ? cleanWikiText(a.wiki.summary) : null,
    tracklist,
  };
}

export async function fetchArtistContext(
  artistName: string,
): Promise<ArtistContext> {
  const data = await lastfmGet<LastfmArtistInfoResponse>({
    method: 'artist.getInfo',
    artist: artistName,
    autocorrect: '1',
  });

  if (!data) {
    return { tags: [], bioSummary: null };
  }

  const { artist } = data;

  return {
    tags: topTags(artist.tags?.tag ?? []),
    bioSummary: artist.bio?.summary ? cleanWikiText(artist.bio.summary) : null,
  };
}
