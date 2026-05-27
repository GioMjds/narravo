import { config } from 'dotenv';
config({ path: '.env.local' });

import { resolveSource } from '../lib/pipeline/review-source-resolver';

async function main() {
  const urls = [
    // Spotify
    'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
    'https://open.spotify.com/album/3qpBPEFDnCpT9OJCwhjMNS',
    'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    // YouTube Music
    'https://music.youtube.com/watch?v=hLQl3WQQoQ0',
    'https://music.youtube.com/watch?v=AJtDXIazrMo',
    'https://music.youtube.com/playlist?list=OLAK5uy_kmZrc98HkZdbCgzyFIxy9v29a6a0kD4Io&si=i7zMGO6iwUpO9Dvw',
  ];

  for (const url of urls) {
    console.log('\nURL:', url);
    const result = await resolveSource(url);

    if (result.ok) {
      const m = result.metadata;
      console.log(`✓ [${m.contentType}] ${m.title} — ${m.artistName}`);
      console.log(`  platform:    ${m.platform}`);
      console.log(`  release:     ${m.releaseLabel}`);
      console.log(`  cover:       ${m.coverArtUrl.slice(0, 60)}...`);
      if (m.trackCount) console.log(`  trackCount:  ${m.trackCount}`);
    } else {
      console.log('✗', result.error);
    }
  }
}

main().catch(console.error);
