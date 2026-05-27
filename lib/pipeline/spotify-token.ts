type TokenCache = {
  token: string;
  expiresAt: number;
};

let cache: TokenCache | null = null;

export async function getSpotifyToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid with 60s buffer
  if (cache && cache.expiresAt - 60_000 > now) {
    return cache.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64',
  );

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token fetch failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  cache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return cache.token;
}
