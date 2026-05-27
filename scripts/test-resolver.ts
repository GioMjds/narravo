// scripts/test-assembler.ts
import { config } from 'dotenv';
config({ path: '.env.local' });

import { resolveSource } from '../lib/pipeline/review-source-resolver';
import { routeTemplate } from '../lib/pipeline/review-template-router';
import { assembleContext } from '../lib/pipeline/review-context-assembler';

async function main() {
  const urls = [
    // Spotify
    'https://open.spotify.com/track/74VtE8bDmRqkjdZeEsrcVZ?si=a32cbcfc11534a9f',
    'https://open.spotify.com/track/4wZTvLi0khNRqqz4i5XhdV?si=783f98344caa4400',
    'https://open.spotify.com/album/59iPWlAD2FMcmnPs5HLcOj?si=Hz730EPRTq-70ZITboTqSw',
    'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    // YouTube Music
    'https://music.youtube.com/watch?v=hLQl3WQQoQ0',
    'https://music.youtube.com/watch?v=AJtDXIazrMo',
    'https://music.youtube.com/playlist?list=OLAK5uy_kmZrc98HkZdbCgzyFIxy9v29a6a0kD4Io&si=i7zMGO6iwUpO9Dvw',
  ];

  for (const url of urls) {
    console.log('\n=============================');
    console.log('URL:', url);

    const resolved = await resolveSource(url);
    if (!resolved.ok) {
      console.log('Resolver failed:', resolved.error);
      continue;
    }

    const templateKey = routeTemplate(resolved.metadata);
    const context = await assembleContext(resolved.metadata, templateKey);

    console.log('\nCoverage:', context.coverage);
    console.log('Missing signals:', context.missingSignals);
    console.log('\nEvidence blocks:');
    for (const block of context.evidenceBlocks) {
      console.log(`  [${block.kind}] ${block.label}`);
      console.log('  ', block.text.slice(0, 120).replace(/\n/g, ' ') + '...');
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
