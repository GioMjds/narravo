# Music Context Layer Phase 1.0 Design

## Summary

Phase 1.0 adds a backend-only Music Context Layer for tracks, EPs/singles, and albums. The layer enriches reviews with source-tied context about artists, releases, credits, genre, era, and album continuity without introducing raw audio analysis, broad web research, or public transport changes.

The public review flow remains route-driven through `/review?url=...`, and the NDJSON stream shape remains `metadata`, `chunk`, and `complete`. New context improves the evidence available to the prompt and final review, but does not add a new response field in this phase.

## Goals

- Add artist background and high-level discography context.
- Add album or release concept context when supported by public source-tied text.
- Add release era, release date, genre/tag context, and label/catalog metadata.
- Add partial credit breakdowns when confidently matched, including songwriters, producers, featured artists, and major contributors.
- Add album track-to-track continuity using tracklist, sequencing, recurring tags/themes, and release-level notes.
- Preserve grounded review behavior by omitting uncertain facts and recording missing signals instead.

## Non-Goals

- Do not add similar songs by theme or mood.
- Do not add lyric evolution across versions, remixes, or alternate releases.
- Do not add playlist-specific Music Context Layer behavior.
- Do not add raw audio analysis or Spotify audio-feature based interpretation.
- Do not change the public review transport contract.
- Do not introduce broad web research, scraping, background jobs, or persistent storage.

## Architecture

The Music Context Layer should live inside the existing backend review pipeline. It should run after source resolution and before prompt building, extending the current context assembly stage instead of creating a parallel API flow.

Current high-level flow:

1. `resolveSource(url)` resolves the submitted Spotify or YouTube Music URL into `NormalizedMetadata`.
2. `assembleContext(metadata, userLyrics)` gathers existing lyrics, metadata, Last.fm, iTunes, Genius, and tracklist evidence.
3. The Music Context Layer enriches the request using the resolved metadata and existing provider output.
4. Trusted context facts are converted into existing `EvidenceBlock` entries.
5. Prompt building consumes the final `ReviewContextPacket` without public schema changes.

This keeps responsibilities explicit:

- Provider clients fetch raw source data.
- Matchers decide whether provider records correspond to the requested music object.
- Assemblers normalize accepted facts into stable internal context.
- The prompt builder receives only grounded evidence and missing signals.

## Internal Components

Add a small set of backend modules under `lib/pipeline/`:

- `music-context-types.ts`: internal types for context facts, source records, provenance, match confidence, and category-level missing signals.
- `musicbrainz-client.ts`: bounded MusicBrainz client with a required User-Agent, timeout handling, request-scoped deduplication, and one-request-per-second limiting.
- `music-context-resolver.ts`: matches `NormalizedMetadata` to MusicBrainz artist, release, recording, and work candidates.
- `music-context-assembler.ts`: builds a normalized `MusicContextPacket` and emits trusted facts as evidence blocks.
- `review-context-assembler.ts`: remains the owner of the final `ReviewContextPacket` and merges Music Context Layer evidence into the existing evidence array.

## Internal Data Model

The layer should model context as provenance-bearing facts rather than free prose. Each normalized fact should include:

- `category`: fixed Music Context Layer category.
- `label`: short human-readable label.
- `text`: concise fact text safe for prompt use.
- `provider`: source provider name.
- `sourceId` or `sourceUrl`: provider entity reference when available.
- `confidence`: match and fact confidence.
- `promptSafe`: whether the fact is allowed into review evidence.

Phase 1.0 fact categories:

- `artist_background`
- `discography_context`
- `release_concept`
- `release_era`
- `genre_context`
- `credits`
- `featured_artists`
- `album_continuity`

The layer should convert accepted facts into existing `EvidenceBlock` values with labels such as:

- `Artist context`
- `Discography context`
- `Release concept`
- `Release era`
- `Genre context`
- `Credits`
- `Featured artists`
- `Album continuity`

## Provider Policy

Phase 1.0 uses first-party plus public source-tied providers only. Existing provider boundaries remain in place for Spotify, YouTube Music, iTunes, Last.fm, LRCLIB, and Genius.

MusicBrainz is added as a bounded structured context provider for:

- Artist, release, recording, release group, and work matching.
- Artist credits and featured artist relationships.
- Release dates, release groups, labels, genres, tags, and tracklists.
- Work and recording relationships relevant to songwriting, production, and contributors when confidently matched.

MusicBrainz constraints:

- Send a proper User-Agent.
- Limit requests to one per second.
- Use short timeouts to preserve live review UX.
- Deduplicate repeated lookups inside a single review request.
- Do not queue background jobs or add persistent provider caching.

Reference docs:

- MusicBrainz API: `https://musicbrainz.org/doc/MusicBrainz_API`
- Spotify Get Track: `https://developer.spotify.com/documentation/web-api/reference/get-track`

## Matching And Trust Rules

Accepted provider facts must be confidently tied to the submitted music object. Matching should use the strongest available combination of:

- Artist name agreement.
- Track, album, EP, or single title agreement.
- Release year agreement when available.
- Track count agreement for albums and EPs when available.
- Provider IDs or source URLs when available.

Reject a candidate when:

- Artist identity conflicts materially.
- Title or release name conflicts materially.
- Release year conflicts without a plausible explanation.
- Album track count conflicts materially.
- The candidate appears to be a cover, compilation, unrelated remix, or different recording.

Rejected or uncertain facts must not be passed to Gemini with caveats. They should be omitted and represented as missing signals such as `credits`, `release concept`, `artist background`, or `album continuity`.

## Failure Handling

Music Context Layer failures are enrichment failures by default. If MusicBrainz, Last.fm, or another context provider times out, rate limits, or cannot confidently match a record, the pipeline should continue with available evidence.

The review should fail with `missing_context` only when the total evidence package is too weak for a responsible reading. Phase 1.0 defaults:

- Track reviews can proceed with lyrics plus metadata even if Music Context Layer enrichment is partial.
- Track reviews without lyrics must remain narrow and low-confidence unless other source-tied context is strong.
- Album and EP reviews need metadata plus either a tracklist, release context, or artist context.
- Credits are optional and may be partial.
- Missing context must narrow the review and confidence note instead of causing fabricated claims.

Provider errors should be logged server-side and represented through category-level missing signals, not exposed as raw provider failures to the user.

## Prompt Behavior

Prompt building should remain stable because it already consumes evidence blocks and missing signals. Phase 1.0 should update prompt guidance only as needed to:

- Identify Music Context Layer evidence as source-tied context.
- Require claims about credits, era, concept, and continuity to be grounded in provided evidence.
- Tell Gemini which Music Context Layer categories are missing.
- Preserve the XML output contract.
- Preserve fail-closed parser behavior when XML is malformed.

The model must not infer missing credits, invent album concepts, or claim continuity that is not supported by metadata, tracklist, tags, lyrics, or source-tied descriptions.

## Public Interface Impact

No public transport changes are planned for Phase 1.0.

The following stay unchanged:

- `/review?url=...` as the shareable review route.
- `app/api/review/route.ts` as the thin transport boundary.
- NDJSON event order: `metadata`, zero or more `chunk`, then `complete`.
- Final review result schema.
- XML as the structured model output contract.

New context should become visible only through the existing review prose, evidence sections, confidence note, and tags.

## Acceptance Criteria

- Spotify track reviews can include artist, release, genre, era, and credit context when confidently matched.
- Spotify album and EP reviews can include release era, genre, tracklist, and album continuity context.
- YouTube Music track reviews continue to work with existing fallback metadata and attempt enrichment only when metadata is sufficient.
- Uncertain MusicBrainz matches are omitted and recorded as missing signals.
- Provider timeout or rate limit does not corrupt the NDJSON stream.
- Malformed Gemini XML remains rejected; no heuristic structure extraction is introduced.
- Low-evidence inputs produce restrained reviews or product errors rather than confident unsupported interpretation.
- User-provided lyrics behavior is preserved, including fixing any propagation gap found during implementation.

## Verification Plan

Use the repository's current supported checks:

- `pnpm lint`
- `pnpm build`

Manual validation should cover:

- A Spotify track with available lyrics.
- A Spotify album or EP with a resolvable tracklist.
- A YouTube Music track using fallback metadata.
- A request where MusicBrainz matching is uncertain.
- A provider timeout or rate-limit simulation.
- A low-evidence album or track.

Do not add Jest, Vitest, Playwright, or another test runner for this phase unless the repository is explicitly updated to support one.

## Assumptions

- Phase 1.0 is backend-first and does not add new UI sections.
- Source policy is first-party plus public source-tied data only.
- Cache strategy is request-scoped only.
- MusicBrainz is the only new provider introduced in this phase.
- Similar songs, remix/version lyric evolution, and playlist context are deferred.
- Music Context Layer failures are best-effort enrichment failures unless total evidence is insufficient.
