import Genius from 'genius-lyrics';

type GeniusResult =
  | { ok: true; lyrics: string }
  | { ok: false; reason: 'not_found' | 'no_api_key' | 'fetch_error' };

export async function fetchLyricsFromGenius(
  title: string,
  artist: string,
): Promise<GeniusResult> {
  const apiKey = process.env.GENIUS_ACCESS_TOKEN;

  if (!apiKey) {
    console.warn('[genius] GENIUS_ACCESS_TOKEN not set — skipping');
    return { ok: false, reason: 'no_api_key' };
  }

  try {
    const client = new Genius.Client(apiKey);
    const query = `${title} ${artist}`.trim();

    console.log(`[genius] Searching: "${query}"`);
    const results = await client.songs.search(query);

    if (!results.length) {
      console.log('[genius] No results found');
      return { ok: false, reason: 'not_found' };
    }

    // Try to find a result whose artist matches before accepting the top hit
    const normalizedArtist = artist.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matched =
      results.find((s) =>
        s.artist.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .includes(normalizedArtist),
      ) ?? results[0];

    console.log(
      `[genius] ✓ Using: "${matched.title}" by "${matched.artist.name}"`,
    );

    const lyrics = await matched.lyrics();

    if (!lyrics?.trim()) {
      console.log('[genius] Lyrics empty after fetch');
      return { ok: false, reason: 'not_found' };
    }

    // Strip Genius section headers like [Verse 1], [Chorus] —
    // the lyrics-normalizer handles section detection from blank lines + content
    // but keeping them is fine too since detectSections handles explicit markers
    return { ok: true, lyrics: lyrics.trim() };
  } catch (err) {
    console.warn(
      `[genius] Fetch error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { ok: false, reason: 'fetch_error' };
  }
}
