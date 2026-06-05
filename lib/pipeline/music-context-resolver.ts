// Music Context Resolver — Phase 1.0
//
// Matches a NormalizedMetadata object to MusicBrainz recordings, releases,
// and artists using the trust rules defined in the design document.
// All matching decisions are documented inline. Uncertain or rejected
// candidates are never passed to the assembler; they are discarded silently
// (the assembler will record the category as a missing signal instead).

import type { NormalizedMetadata } from './types';
import type { MBRecordingMatch, MBReleaseMatch } from './music-context-types';
import {
  searchMBRecording,
  searchMBRelease,
  formatArtistCredit,
  type MBRecordingSearchItem,
  type MBReleaseSearchItem,
} from './musicbrainz-client';

// String matching helpers

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'") // curly quotes → straight
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titlesSimilar(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return true;
  // Accept if one is a prefix/suffix of the other (handles "(feat. X)" suffix)
  if (na.startsWith(nb) || nb.startsWith(na)) return true;
  return false;
}

function artistsSimilar(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/^the\s+/, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return true; // if either is empty we can't verify
  return na.includes(nb) || nb.includes(na);
}

function releaseYearsClose(a?: string, b?: string): boolean {
  if (!a || !b) return true; // can't verify — allow
  const ya = parseInt(a.slice(0, 4), 10);
  const yb = parseInt(b.slice(0, 4), 10);
  if (isNaN(ya) || isNaN(yb)) return true;
  return Math.abs(ya - yb) <= 1; // 1-year tolerance for regional/digital release skew
}

// Recording resolver (for track content types)

export async function resolveMBRecording(
  metadata: NormalizedMetadata,
  dedupeCache: Map<string, unknown>,
): Promise<MBRecordingMatch | null> {
  const results = await searchMBRecording(
    metadata.title,
    metadata.artistName,
    dedupeCache,
  );

  if (!results || results.length === 0) return null;

  // MusicBrainz search results are scored 0-100. We require score ≥ 85 and
  // apply our own trust rules on top.
  const candidates = results.filter((r) => r.score >= 85);

  for (const candidate of candidates) {
    if (!acceptRecordingCandidate(candidate, metadata)) continue;

    const artistMbids = candidate['artist-credit'].map((ac) => ac.artist.id);
    const artistCredit = formatArtistCredit(candidate['artist-credit']);

    // Find the release that best matches the album hint
    const release =
      candidate.releases?.find((rel) =>
        titlesSimilar(rel.title, metadata.albumOrCollectionTitle),
      ) ?? candidate.releases?.[0];

    return {
      recordingId: candidate.id,
      recordingTitle: candidate.title,
      artistCredit,
      artistMbids,
      releaseId: release?.id,
      releaseTitle: release?.title,
      releaseGroupId: release?.['release-group']?.id,
      releaseDate: release?.date,
      confidence: candidate.score >= 95 ? 'high' : 'medium',
    };
  }

  return null;
}

function acceptRecordingCandidate(
  candidate: MBRecordingSearchItem,
  metadata: NormalizedMetadata,
): boolean {
  // Rule 1: title must agree
  if (!titlesSimilar(candidate.title, metadata.title)) {
    console.log(
      `[mb-resolver] Rejected recording "${candidate.title}" — title mismatch with "${metadata.title}"`,
    );
    return false;
  }

  // Rule 2: artist must agree
  const creditStr = formatArtistCredit(candidate['artist-credit']);
  if (!artistsSimilar(creditStr, metadata.artistName)) {
    console.log(
      `[mb-resolver] Rejected recording "${candidate.title}" — artist "${creditStr}" vs "${metadata.artistName}"`,
    );
    return false;
  }

  // Rule 3: release year must be plausible (checked against album hint release)
  // We parse the release label for a year hint since NormalizedMetadata does
  // not carry a structured date field.
  const yearHint = metadata.releaseLabel.match(/\b(19|20)\d{2}\b/)?.[0];
  if (yearHint) {
    const candidateYear = candidate.releases?.[0]?.date?.slice(0, 4);
    if (!releaseYearsClose(yearHint, candidateYear)) {
      console.log(
        `[mb-resolver] Rejected recording "${candidate.title}" — year ${candidateYear} conflicts with hint ${yearHint}`,
      );
      return false;
    }
  }

  return true;
}

// ─── Release resolver (for album / ep-single content types) ───────────────────

export async function resolveMBRelease(
  metadata: NormalizedMetadata,
  dedupeCache: Map<string, unknown>,
): Promise<MBReleaseMatch | null> {
  const title = metadata.albumOrCollectionTitle || metadata.title;
  const results = await searchMBRelease(
    title,
    metadata.artistName,
    dedupeCache,
  );

  if (!results || results.length === 0) return null;

  const candidates = results.filter((r) => r.score >= 85);

  for (const candidate of candidates) {
    if (!acceptReleaseCandidate(candidate, metadata, title)) continue;

    const artistMbids = candidate['artist-credit'].map((ac) => ac.artist.id);
    const artistCredit = formatArtistCredit(candidate['artist-credit']);

    return {
      releaseId: candidate.id,
      releaseTitle: candidate.title,
      artistCredit,
      artistMbids,
      releaseGroupId: candidate['release-group']?.id,
      releaseDate: candidate.date,
      trackCount: candidate['track-count'],
      confidence: candidate.score >= 95 ? 'high' : 'medium',
    };
  }

  return null;
}

function acceptReleaseCandidate(
  candidate: MBReleaseSearchItem,
  metadata: NormalizedMetadata,
  searchTitle: string,
): boolean {
  // Rule 1: title
  if (!titlesSimilar(candidate.title, searchTitle)) {
    console.log(
      `[mb-resolver] Rejected release "${candidate.title}" — title mismatch`,
    );
    return false;
  }

  // Rule 2: artist
  const creditStr = formatArtistCredit(candidate['artist-credit']);
  if (!artistsSimilar(creditStr, metadata.artistName)) {
    console.log(
      `[mb-resolver] Rejected release "${candidate.title}" — artist "${creditStr}" vs "${metadata.artistName}"`,
    );
    return false;
  }

  // Rule 3: year
  const yearHint = metadata.releaseLabel.match(/\b(19|20)\d{2}\b/)?.[0];
  if (yearHint && !releaseYearsClose(yearHint, candidate.date)) {
    console.log(
      `[mb-resolver] Rejected release "${candidate.title}" — year ${candidate.date} conflicts with hint ${yearHint}`,
    );
    return false;
  }

  // Rule 4: track count conflict (if we have both)
  if (
    metadata.trackCount != null &&
    candidate['track-count'] != null &&
    Math.abs(metadata.trackCount - candidate['track-count']) > 3
  ) {
    console.log(
      `[mb-resolver] Rejected release "${candidate.title}" — track count ${candidate['track-count']} conflicts with ${metadata.trackCount}`,
    );
    return false;
  }

  return true;
}
