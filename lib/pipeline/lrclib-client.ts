type LrclibResponse = {
  trackName: string;
  artistName: string;
  plainLyrics: string | null;
  syncedLyrics: string | null;
};

type LyricsResult =
  | { ok: true; lyrics: string }
  | { ok: false; reason: 'not_found' | 'fetch_error' };

export async function fetchLyrics(
  title: string,
  artistName: string,
  albumName?: string,
): Promise<LyricsResult> {
  const params = new URLSearchParams({
    track_name: title,
    artist_name: artistName,
    ...(albumName ? { album_name: albumName } : {}),
  });

  try {
    const res = await fetch(
      `https://lrclib.net/api/get?${params.toString()}`,
      { cache: 'no-store' },
    );

    // 404 = no match, not an error worth throwing
    if (res.status === 404) {
      return { ok: false, reason: 'not_found' };
    }

    if (!res.ok) {
      return { ok: false, reason: 'fetch_error' };
    }

    const data = (await res.json()) as LrclibResponse;

    // Prefer plain lyrics — synced lyrics contain timestamps like [00:12.34]
    const lyrics = data.plainLyrics ?? stripTimestamps(data.syncedLyrics ?? '');

    if (!lyrics.trim()) {
      return { ok: false, reason: 'not_found' };
    }

    return { ok: true, lyrics: lyrics.trim() };
  } catch {
    return { ok: false, reason: 'fetch_error' };
  }
}

// Strip [mm:ss.xx] timestamps from synced lyrics as fallback
function stripTimestamps(synced: string): string {
  return synced
    .split('\n')
    .map((line) => line.replace(/^\[\d{2}:\d{2}\.\d{2,3}\]\s?/, '').trim())
    .filter(Boolean)
    .join('\n');
}