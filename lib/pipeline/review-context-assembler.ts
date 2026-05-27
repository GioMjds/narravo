import type {
  NormalizedMetadata,
  PromptTemplateKey,
  ReviewContextPacket,
  EvidenceBlock,
} from './types';

export async function assembleContext(
  metadata: NormalizedMetadata,
  _templateKey: PromptTemplateKey,
): Promise<ReviewContextPacket> {
  const evidenceBlocks: EvidenceBlock[] = [];
  const missingSignals: string[] = [];

  // Always add metadata block
  evidenceBlocks.push({
    kind: 'metadata',
    label: 'Track metadata',
    text: formatMetadataAsText(metadata),
  });

  // Try to fetch lyrics (track only)
  if (metadata.contentType === 'track') {
    const lyrics = await fetchLyrics(metadata.title, metadata.artistName);
    if (lyrics) {
      evidenceBlocks.push({ kind: 'lyrics', label: 'Lyrics', text: lyrics });
    } else {
      missingSignals.push('lyrics');
    }
  }

  // Try to fetch description (album, playlist, ep-single)
  if (['album', 'ep-single', 'playlist'].includes(metadata.contentType)) {
    // fetch from Spotify/YouTube API if available
    missingSignals.push('editorial description');
  }

  const hasLyrics = evidenceBlocks.some((b) => b.kind === 'lyrics');
  const hasDescription = evidenceBlocks.some((b) => b.kind === 'description');
  const hasTracklist = evidenceBlocks.some((b) => b.kind === 'tracklist');

  // Derive coverage
  const coverage =
    hasLyrics || hasDescription
      ? 'rich'
      : evidenceBlocks.length > 1
        ? 'partial'
        : 'sparse';

  return {
    metadata,
    evidenceBlocks,
    coverage,
    missingSignals,
    confidenceInputs: { hasLyrics, hasDescription, hasTracklist },
  };
}

function formatMetadataAsText(m: NormalizedMetadata): string {
  return [
    `Title: ${m.title}`,
    `Artist: ${m.artistName}`,
    `Release: ${m.releaseLabel}`,
    `Platform: ${m.platform}`,
    m.trackCount ? `Track count: ${m.trackCount}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

async function fetchLyrics(
  title: string,
  artist: string,
): Promise<string | null> {
  // Option A: Musixmatch API
  // Option B: lyrics.ovh (free, no auth)
  try {
    const res = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { lyrics?: string };
    return data.lyrics?.trim() ?? null;
  } catch {
    return null;
  }
}
