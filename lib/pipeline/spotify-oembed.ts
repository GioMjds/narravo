type SpotifyOembedResponse = {
  title: string;
  thumbnail_url: string;
  html: string;
  provider_name: string;
};

type OembedResult =
  | { ok: true; title: string; thumbnailUrl: string; artistHint: string | null }
  | { ok: false; status: number };

export async function fetchSpotifyOembed(
  spotifyUrl: string,
): Promise<OembedResult> {
  const endpoint = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`;

  const res = await fetch(endpoint, { cache: 'no-store' });

  if (!res.ok) {
    return { ok: false, status: res.status };
  }

  const data = (await res.json()) as SpotifyOembedResponse;

  // The iframe title attribute contains "Spotify Web Player: {Track} by {Artist}"
  // Extract artist hint from it for a better iTunes search query
  const iframeTitleMatch = data.html.match(/title="([^"]+)"/);
  const iframeTitle = iframeTitleMatch?.[1] ?? '';

  // "Spotify Web Player: Rolling in the Deep by Adele"
  const byMatch = iframeTitle.match(/ by (.+?)(?:"|$)/);
  const artistHint = byMatch?.[1]?.trim() ?? null;

  return {
    ok: true,
    title: data.title,
    thumbnailUrl: data.thumbnail_url,
    artistHint,
  };
}
