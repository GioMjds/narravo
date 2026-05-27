import { fetchSpotifyOembed } from './spotify-oembed';
import {
  resolveTrackFromItunes,
  resolveAlbumFromItunes,
} from './itunes-client';
import type { NormalizedMetadata } from './types';

export async function resolveSpotifyTrack(
  _id: string,
  sourceUrl: string,
): Promise<NormalizedMetadata> {
  const oembed = await fetchSpotifyOembed(sourceUrl);

  if (!oembed.ok) {
    if (oembed.status === 404) throw new Error('spotify_not_found');
    if (oembed.status === 403) throw new Error('spotify_private');
    if (oembed.status === 429) throw new Error('spotify_rate_limited');
    throw new Error(`spotify_error:${oembed.status}`);
  }

  const metadata = await resolveTrackFromItunes(
    oembed.title,
    oembed.artistHint,
    sourceUrl,
  );

  if (!metadata) {
    // oEmbed worked but iTunes found nothing — build minimal metadata
    // from oEmbed data alone so the pipeline can still attempt a review
    return {
      sourceUrl,
      platform: 'spotify',
      contentType: 'track',
      title: oembed.title,
      artistName: oembed.artistHint ?? 'Unknown Artist',
      albumOrCollectionTitle: '',
      coverArtUrl: oembed.thumbnailUrl,
      releaseLabel: 'Spotify',
      trackCount: undefined,
    };
  }

  // Prefer oEmbed thumbnail if iTunes artwork is missing
  if (!metadata.coverArtUrl) {
    metadata.coverArtUrl = oembed.thumbnailUrl;
  }

  return metadata;
}

export async function resolveSpotifyAlbum(
  _id: string,
  sourceUrl: string,
): Promise<NormalizedMetadata> {
  const oembed = await fetchSpotifyOembed(sourceUrl);

  if (!oembed.ok) {
    if (oembed.status === 404) throw new Error('spotify_not_found');
    if (oembed.status === 429) throw new Error('spotify_rate_limited');
    throw new Error(`spotify_error:${oembed.status}`);
  }

  const metadata = await resolveAlbumFromItunes(
    oembed.title,
    oembed.artistHint,
    sourceUrl,
  );

  if (!metadata) {
    return {
      sourceUrl,
      platform: 'spotify',
      contentType: 'album',
      title: oembed.title,
      artistName: oembed.artistHint ?? 'Unknown Artist',
      albumOrCollectionTitle: oembed.title,
      coverArtUrl: oembed.thumbnailUrl,
      releaseLabel: 'Spotify',
      trackCount: undefined,
    };
  }

  return metadata;
}

export async function resolveSpotifyPlaylist(
  _id: string,
  sourceUrl: string,
): Promise<NormalizedMetadata> {
  const oembed = await fetchSpotifyOembed(sourceUrl);

  if (!oembed.ok) {
    if (oembed.status === 404) throw new Error('spotify_not_found');
    if (oembed.status === 429) throw new Error('spotify_rate_limited');
    throw new Error(`spotify_error:${oembed.status}`);
  }

  // Playlists: oEmbed gives title + thumbnail, no iTunes equivalent
  return {
    sourceUrl,
    platform: 'spotify',
    contentType: 'playlist',
    title: oembed.title,
    artistName: oembed.artistHint ?? 'Spotify',
    albumOrCollectionTitle: oembed.title,
    coverArtUrl: oembed.thumbnailUrl,
    releaseLabel: 'Spotify Playlist',
    trackCount: undefined,
  };
}
