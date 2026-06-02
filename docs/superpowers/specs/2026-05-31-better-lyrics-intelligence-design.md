# Better Lyrics Intelligence Design

Date: 2026-05-31
Project: Narravo
Scope: Track-only lyrics intelligence layer

## Summary

Add a lyrics-first analysis layer that makes Narravo feel sharper without introducing audio analysis yet.

This phase keeps the current review flow intact and adds a separate structured lyrics panel for tracks. The panel should provide:

- line-by-line annotation
- verse / chorus / bridge segmentation
- theme tagging
- emotion detection per section
- figurative language detection
- reference detection for slang, culture, religion, politics, and relationships
- literal vs symbolic interpretations
- speaker-target detection

The review should still read like an editorial critique first. The new lyrics intelligence surface is additive and should not replace the existing prose review.

## Decisions

- Scope: track-only
- UX shape: separate structured panel
- Analysis strategy: single Gemini pass with deterministic helpers
- Confidence policy: hybrid, with explicit `confident`, `plausible`, and `speculative` labels
- Audio: out of scope
- Transport: preserve the existing `/review?url=...` route and NDJSON stream order

## Goals

- Make lyric reviews feel materially smarter and more specific.
- Preserve user trust by separating strong signals from speculation.
- Keep the implementation bounded to the current review pipeline.
- Avoid adding a second review transport or a new page flow.

## Existing Surface To Preserve

The feature should extend the current pipeline rather than replacing it:

- [`app/api/review/route.ts`](C:\Users\giomj\OneDrive\Desktop\narravo\app\api\review\route.ts)
- [`components/narravo/review-experience.tsx`](C:\Users\giomj\OneDrive\Desktop\narravo\components\narravo\review-experience.tsx)
- [`lib/pipeline/review-stream-orchestrator.ts`](C:\Users\giomj\OneDrive\Desktop\narravo\lib\pipeline\review-stream-orchestrator.ts)
- [`lib/pipeline/review-context-assembler.ts`](C:\Users\giomj\OneDrive\Desktop\narravo\lib\pipeline\review-context-assembler.ts)
- [`lib/pipeline/review-prompt-builder.ts`](C:\Users\giomj\OneDrive\Desktop\narravo\lib\pipeline\review-prompt-builder.ts)
- [`lib/pipeline/review-output-parser.ts`](C:\Users\giomj\OneDrive\Desktop\narravo\lib\pipeline\review-output-parser.ts)
- [`lib/narravo-review.ts`](C:\Users\giomj\OneDrive\Desktop\narravo\lib\narravo-review.ts)

The current prose review, metadata stream, and recoverable error behavior should remain stable.

## Architecture

The feature is a single-pass enriched review pipeline:

1. Resolve the source and fetch lyrics as today.
2. Run deterministic lyric helpers to normalize lines and infer section boundaries.
3. Build a richer lyric context packet for Gemini.
4. Ask Gemini for the prose review and the structured lyrics analysis in one response.
5. Strictly parse the structured tail and render it in a dedicated panel.

The deterministic helpers are responsible for the safe parts:

- normalize raw lyrics text
- split lines into stable line IDs
- detect obvious section boundaries
- preserve order for every line

Gemini is responsible for the interpretive parts:

- annotate each line
- label section type
- infer themes and emotions
- detect figurative language
- detect references
- provide literal and symbolic readings
- identify the likely speaker target

This keeps the implementation grounded while avoiding a multi-stage model pipeline.

## Lyric Structure Rules

The analyzer should work only on tracks.

Section detection should follow this priority:

1. Explicit section markers in lyrics, when present, such as `Verse`, `Chorus`, `Bridge`, `Intro`, `Outro`, or `Pre-Chorus`.
2. Blank-line separation between lyric blocks.
3. Repeated hook detection to infer a chorus when the same block recurs.
4. Neutral fallback sections when no marker can be justified.

Line handling rules:

- each displayed line gets a stable ID from the deterministic helper
- each line inside a section gets one short annotation
- annotations should be concise and should not restate the lyric verbatim
- if a line is too ambiguous, the annotation should say so rather than bluff

Section handling rules:

- each section must have a section type
- each section must have a label
- each section must include at least one line
- each section should carry its own theme tags, emotion, figurative language notes, references, speaker target, and literal vs symbolic readings

## Output Contract

The current review result should gain a new structured lyrics object rather than a separate transport.

Proposed shared result shape:

- `reviewText`
- `evidence`
- `scores`
- `tags`
- `takeaway`
- `confidence`
- `lyricsIntelligence`

The `lyricsIntelligence` payload should include:

- overall track themes
- ordered sections
- per-section emotion
- per-section reference notes
- per-section figurative language notes
- per-section speaker target
- per-section literal vs symbolic interpretations
- per-line annotations
- field-level confidence labels

Recommended field vocabulary:

- section types: `verse`, `chorus`, `bridge`, `intro`, `outro`, `pre-chorus`, `hook`, `other`
- confidence labels: `confident`, `plausible`, `speculative`
- speaker target values: `self`, `lover`, `ex-partner`, `friend`, `family`, `God`, `audience`, `authority`, `community`, `unknown`

If the model cannot support a field strongly, it should still emit a value and mark it as speculative instead of omitting the field.

## Prompt And Parsing

The prompt should instruct Gemini to produce two conceptual outputs in one generation:

1. the existing prose review
2. a strict XML tail that contains the lyrics intelligence payload

The XML contract should remain fail-closed:

- no heuristic recovery from malformed XML
- no scraping of freeform prose for structure
- no silent acceptance of missing required tags

The parser should reject incomplete or contradictory structured output.

The lyrics intelligence XML should represent sections and lines explicitly. A section should contain:

- section type
- section label
- section confidence
- section themes
- section emotion
- figurative language notes
- reference notes
- speaker target
- literal interpretation
- symbolic interpretation
- line entries with annotation and confidence

The parser should map this into the shared `lyricsIntelligence` object for the client.

## UI Behavior

The review page should keep the current prose review as the main editorial read.

The new lyrics intelligence surface should render as a separate structured panel:

- place it after the prose review
- keep it visually distinct from the existing evidence and rubric cards
- organize it by section
- show the section label and confidence prominently
- show the line annotations directly under each line
- show theme tags, emotion, figurative language, references, and speaker target in a compact section summary

The panel should support graceful degradation:

- if only some fields are confident, render the confident fields and mark the rest as speculative
- if lyrics are thin or unavailable, fall back to the existing missing-context behavior
- if the structured payload fails to parse, fail the review closed instead of inventing a partial panel

## Error Handling

Expected failure modes:

- unsupported URL or platform
- private or unavailable track
- missing lyrics or weak lyrical context
- malformed XML
- incomplete lyrics intelligence payload

Behavior rules:

- if lyrics are unavailable, preserve the existing `missing_context` style failure
- if the model output is malformed, treat it as a parse failure
- if the lyrics are ambiguous, use `speculative` labels rather than pretending certainty
- if section boundaries cannot be inferred reliably, fall back to neutral sections instead of forcing verse/chorus labels

## Testing And Validation

Validation should focus on structure, not only visual rendering.

Required checks:

- track-only URLs still resolve through the existing review route
- lyrics helper output stays stable for explicit markers, blank-line separation, repeated hooks, and markerless lyrics
- the parser rejects malformed XML and incomplete structured payloads
- the client can render the new `lyricsIntelligence` payload without breaking the existing streaming flow
- the review stream event order remains `metadata` -> `chunk` -> `complete`

Recommended test cases:

- a track with explicit `Verse` / `Chorus` markers
- a track with blank-line-separated lyrics and no section markers
- a track with repeated hooks that should be treated as a chorus
- a track with slang or cultural references that should be marked speculative
- a sparse lyric track that should still render gracefully without overclaiming
- malformed XML from the model that must fail closed

Manual verification should include:

- one clean track URL with strong lyrics coverage
- one ambiguous track URL with weaker coverage
- mobile and desktop layout checks for the new panel

## Assumptions

- Lyrics will continue to come from the current lyrics source path.
- No audio or waveform analysis is introduced in this phase.
- No persistence layer is added for annotations.
- The current review prose remains the primary editorial experience.
- This phase does not broaden to albums, EPs, or playlists.

## Non-Goals

- audio analysis
- beat, tempo, or production timing analysis
- cross-track lyric memory
- user-editable annotations
- background processing or review jobs
- a new review route or transport contract
