type YouTubeOembedResponse = {
  title: string;
  author_name: string;
  thumbnail_url: string;
};

type YTOembedResult =
  | { ok: true; title: string; authorName: string; thumbnailUrl: string }
  | { ok: false; status: number };

export async function fetchYouTubeOembed(
  videoUrl: string,
): Promise<YTOembedResult> {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;

  const res = await fetch(endpoint, { cache: 'no-store' });

  if (!res.ok) {
    return { ok: false, status: res.status };
  }

  const data = (await res.json()) as YouTubeOembedResponse;

  return {
    ok: true,
    title: data.title,
    authorName: data.author_name,
    thumbnailUrl: data.thumbnail_url,
  };
}
