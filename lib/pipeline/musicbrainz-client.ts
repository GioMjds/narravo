// MusicBrainz client for Phase 1.0 Music Context Layer.
//
// Constraints (per design doc):
//  - Required User-Agent header identifying Narravo.
//  - One request per second (MusicBrainz public API rate limit).
//  - Short timeouts to keep the live review UX fast.
//  - Request-scoped deduplication via a passed-in cache Map.
//  - No background jobs, no persistent caching.

const MB_BASE = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'Narravo/1.0 (https://narravo.app; contact@narravo.app)';
const TIMEOUT_MS = 6000;

// Module-level timestamp for the last outgoing request. Used to enforce
// the 1 req/s rule within a single Node.js process lifetime.
let _lastRequestAt = 0;

async function mbThrottle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - _lastRequestAt;
  if (elapsed < 1050) {
    // 1050 ms gives a small safety margin over the 1 req/s limit
    await new Promise((resolve) => setTimeout(resolve, 1050 - elapsed));
  }
  _lastRequestAt = Date.now();
}

// Low-level GET

async function mbGet<T>(
  path: string,
  params: Record<string, string>,
  dedupeCache: Map<string, unknown>,
): Promise<T | null> {
  const query = new URLSearchParams({ ...params, fmt: 'json' });
  const url = `${MB_BASE}/${path}?${query.toString()}`;

  const cached = dedupeCache.get(url);
  if (cached !== undefined) {
    return cached as T;
  }

  await mbThrottle();

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status === 503 || res.status === 429) {
      console.warn(
        `[musicbrainz] Rate limited or service unavailable (${res.status})`,
      );
      dedupeCache.set(url, null);
      return null;
    }

    if (!res.ok) {
      console.warn(`[musicbrainz] HTTP ${res.status} for ${path}`);
      dedupeCache.set(url, null);
      return null;
    }

    const data = (await res.json()) as T;
    dedupeCache.set(url, data);
    return data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[musicbrainz] Fetch error for ${path}: ${msg}`);
    dedupeCache.set(url, null);
    return null;
  }
}

// Response shapes (minimal — only fields we use)

type MBArtistCredit = {
  name: string;
  artist: { id: string; name: string };
  joinphrase?: string;
};

type MBTag = { name: string; count: number };

type MBRecordingSearchItem = {
  id: string;
  title: string;
  score: number;
  length?: number;
  'artist-credit': MBArtistCredit[];
  releases?: {
    id: string;
    title: string;
    date?: string;
    'release-group'?: { id: string; 'primary-type'?: string };
    'track-count'?: number;
  }[];
};

type MBRecordingSearchResponse = {
  recordings: MBRecordingSearchItem[];
  count: number;
};

type MBReleaseSearchItem = {
  id: string;
  title: string;
  score: number;
  date?: string;
  'track-count'?: number;
  'artist-credit': MBArtistCredit[];
  'release-group'?: { id: string; 'primary-type'?: string };
};

type MBReleaseSearchResponse = {
  releases: MBReleaseSearchItem[];
  count: number;
};

type MBArtistDetail = {
  id: string;
  name: string;
  type?: string;
  country?: string;
  'begin-area'?: { name: string };
  'life-span'?: { begin?: string; end?: string; ended?: boolean };
  tags?: MBTag[];
  genres?: MBTag[];
};

type MBReleaseGroupDetail = {
  id: string;
  title: string;
  'primary-type'?: string;
  'first-release-date'?: string;
  tags?: MBTag[];
  genres?: MBTag[];
  releases?: { id: string; date?: string }[];
};

type MBReleaseDetail = {
  id: string;
  title: string;
  date?: string;
  'track-count'?: number;
  'label-info'?: { label?: { name: string } }[];
  media?: { 'track-count': number; tracks?: MBTrackDetail[] }[];
  relations?: MBRelation[];
};

type MBTrackDetail = {
  id: string;
  number: string;
  title: string;
  length?: number;
};

type MBRelation = {
  type: string;
  direction: string;
  artist?: { id: string; name: string };
  attributes?: string[];
};

type MBRecordingDetail = {
  id: string;
  title: string;
  length?: number;
  'artist-credit': MBArtistCredit[];
  relations?: MBRelation[];
  isrcs?: string[];
};

// ─── Helper: format artist credit string ─────────────────────────────────────

export function formatArtistCredit(credits: MBArtistCredit[]): string {
  return credits.map((c) => c.name + (c.joinphrase ?? '')).join('');
}

// ─── Public search functions ──────────────────────────────────────────────────

export async function searchMBRecording(
  title: string,
  artistName: string,
  dedupeCache: Map<string, unknown>,
): Promise<MBRecordingSearchItem[] | null> {
  const q = `recording:"${title}" AND artist:"${artistName}"`;
  const data = await mbGet<MBRecordingSearchResponse>(
    'recording',
    { query: q, limit: '5', inc: 'releases+artist-credits' },
    dedupeCache,
  );
  return data?.recordings ?? null;
}

export async function searchMBRelease(
  title: string,
  artistName: string,
  dedupeCache: Map<string, unknown>,
): Promise<MBReleaseSearchItem[] | null> {
  const q = `release:"${title}" AND artist:"${artistName}"`;
  const data = await mbGet<MBReleaseSearchResponse>(
    'release',
    { query: q, limit: '5', inc: 'artist-credits+release-groups' },
    dedupeCache,
  );
  return data?.releases ?? null;
}

export async function getMBArtistDetail(
  mbid: string,
  dedupeCache: Map<string, unknown>,
): Promise<MBArtistDetail | null> {
  return mbGet<MBArtistDetail>(
    `artist/${mbid}`,
    { inc: 'tags+genres' },
    dedupeCache,
  );
}

export async function getMBReleaseGroupDetail(
  mbid: string,
  dedupeCache: Map<string, unknown>,
): Promise<MBReleaseGroupDetail | null> {
  return mbGet<MBReleaseGroupDetail>(
    `release-group/${mbid}`,
    { inc: 'tags+genres+releases' },
    dedupeCache,
  );
}

export async function getMBReleaseDetail(
  mbid: string,
  dedupeCache: Map<string, unknown>,
): Promise<MBReleaseDetail | null> {
  return mbGet<MBReleaseDetail>(
    `release/${mbid}`,
    { inc: 'labels+recordings+artist-credits+work-rels' },
    dedupeCache,
  );
}

export async function getMBRecordingDetail(
  mbid: string,
  dedupeCache: Map<string, unknown>,
): Promise<MBRecordingDetail | null> {
  return mbGet<MBRecordingDetail>(
    `recording/${mbid}`,
    { inc: 'artist-credits+work-rels+isrcs' },
    dedupeCache,
  );
}

// Re-export types needed by resolver and assembler
export type {
  MBArtistCredit,
  MBArtistDetail,
  MBReleaseGroupDetail,
  MBReleaseDetail,
  MBRecordingDetail,
  MBRecordingSearchItem,
  MBReleaseSearchItem,
  MBRelation,
  MBTag,
};
