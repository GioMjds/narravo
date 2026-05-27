# Song Meaning Review Engine Design

Date: 2026-05-27
Project: Narravo
Scope: AI-powered song meaning review engine for the current MVP

## Goal

Replace the seeded demo review backend with a real staged generation pipeline that can produce grounded reviews for four content types:

- `track`
- `ep-single`
- `album`
- `playlist`

The engine must preserve the current public review experience:

- shareable route remains `/review?url=...`
- generation runs in a single live request
- the frontend keeps receiving NDJSON events in the existing order
- the result uses one shared review schema across all supported content types

## Product Decisions

- Architecture: strict staged pipeline
- Model SDK: `@google/generative-ai`
- Model topology: one Gemini generation model for all content types
- Supported review targets in MVP: `track`, `ep-single`, `album`, `playlist`
- Evidence policy: metadata plus first-party or public source-tied text only
- Shareable review behavior: regenerate from source URL on each visit
- Result contract: one shared schema for all content types
- Structured model output: XML tail payload appended to streamed editorial prose
- Failure rule: do not generate a confident review when evidence coverage is insufficient

## Existing Surface To Preserve

The current repo already has the public-facing review flow and should not be redesigned as part of this work.

Existing surface to preserve:

- [`/review` route](C:\Users\giomj\OneDrive\Desktop\narravo\app\review\page.tsx)
- [`/api/review` route entrypoint](C:\Users\giomj\OneDrive\Desktop\narravo\app\api\review\route.ts)
- [`ReviewExperience` state machine](C:\Users\giomj\OneDrive\Desktop\narravo\components\narravo\review-experience.tsx)
- current review result semantics in [`lib/narravo-review.ts`](C:\Users\giomj\OneDrive\Desktop\narravo\lib\narravo-review.ts)
- engineering direction described in [`docs/superpowers/review_generation_pipeline.svg`](C:\Users\giomj\OneDrive\Desktop\narravo\docs\superpowers\review_generation_pipeline.svg)

The backend should become real behind this existing contract instead of replacing the page flow first.

## Architecture

The review engine will be implemented as a strict staged pipeline:

1. `review-source-resolver`
2. `review-template-router`
3. `review-context-assembler`
4. `review-prompt-builder`
5. `gemini-review-client`
6. `review-output-parser`
7. `review-stream-orchestrator`

This is the preferred architecture because the main complexity is not rendering the page. The main complexity is keeping multi-type prompt behavior, evidence policy, parser stability, and failure handling coherent as the demo backend becomes a live generation system.

## Stage Responsibilities

### `review-source-resolver`

Input:

- raw music URL

Output:

- `NormalizedMetadata`

Responsibilities:

- validate supported platform
- normalize the source identity
- infer `contentType`
- resolve source-linked metadata only
- produce a canonical typed object for downstream stages

### `review-template-router`

Input:

- `NormalizedMetadata`

Output:

- `PromptTemplateKey`

Responsibilities:

- map `track`, `ep-single`, `album`, and `playlist` to prompt families
- keep routing rules explicit and testable
- avoid embedding prompt text directly into orchestration logic

### `review-context-assembler`

Input:

- `NormalizedMetadata`
- `PromptTemplateKey`

Output:

- `ReviewContextPacket`

Responsibilities:

- gather allowed evidence only
- assemble bounded source-tied context for Gemini
- record coverage gaps explicitly
- shape confidence inputs from evidence quality rather than from model self-report alone

Allowed evidence for MVP includes:

- track, release, artist, or collection metadata
- lyrics when available from allowed first-party or public source-tied text
- album descriptions
- playlist descriptions
- tracklists
- other directly fetched public text tied to the submitted source

Disallowed evidence for MVP:

- broad open web research
- unrelated reviews or interviews
- user-generated commentary not directly tied to the source ingestion path

### `review-prompt-builder`

Input:

- `PromptTemplateKey`
- `ReviewContextPacket`

Output:

- `GeminiPromptPlan`

Responsibilities:

- build the system instruction
- inject content-type-specific instructions
- define the XML output contract
- define groundedness and restraint rules
- keep prompt composition separate from fetching and model execution

### `gemini-review-client`

Input:

- `GeminiPromptPlan`

Output:

- streamed editorial prose
- final raw XML payload text

Responsibilities:

- call a single Gemini generation model through `@google/generative-ai`
- stream the critic-style prose for the current UI
- preserve the final structured tail for parsing
- surface model and transport failures cleanly to the orchestrator

### `review-output-parser`

Input:

- raw model completion text

Output:

- shared `ReviewResult`

Responsibilities:

- detect one bounded XML tail payload
- validate required tags and repeated sections
- normalize parsed data into the shared result contract
- fail closed on malformed, incomplete, or contradictory structured output

### `review-stream-orchestrator`

Input:

- raw music URL

Output:

- NDJSON stream consumed by the existing review client

Responsibilities:

- run the stages in order
- emit `metadata`, then `chunk`, then `complete`
- map stage failures to recoverable product errors
- keep the API route thin and transport-focused

## Shared Core Contracts

### `NormalizedMetadata`

This is the canonical normalized input for the rest of the pipeline.

Expected fields:

- `sourceUrl`
- `platform`
- `contentType`
- `title`
- `artistName` or equivalent curator or owner label when relevant
- `albumOrCollectionTitle`
- `coverArtUrl`
- `releaseLabel`
- `trackCount` when applicable

### `ReviewContextPacket`

This is the bounded, evidence-aware input given to prompt construction.

Expected fields:

- `metadata`
- `evidenceBlocks[]`
- `coverage`
- `missingSignals[]`
- `confidenceInputs`

### `ReviewResult`

All content types must emit the same high-level result contract so the existing UI can remain stable.

Top-level fields:

- `reviewText`
- `evidence`
- `scores`
- `tags`
- `takeaway`
- `confidence`

Type-specific behavior must live inside prompt routing and context assembly, not in four separate transport schemas.

## Content-Type Behavior Inside Shared Contracts

### `track`

Primary emphasis:

- lyrical meaning
- emotional cues
- sonic atmosphere
- focused single-song interpretation

### `ep-single`

Primary emphasis:

- short-release cohesion
- recurring motifs across a small track set
- release intent and consistency

### `album`

Primary emphasis:

- arc and sequencing
- recurring themes
- tonal and world-building continuity
- relationship between individual tracks and overall statement

### `playlist`

Primary emphasis:

- curation logic
- mood coherence
- transition quality
- selection intent

These differences change the prompt family and evidence emphasis, but not the top-level response schema.

## Request Flow

1. The client submits a Spotify or YouTube Music URL to `/review?url=...`.
2. [`app/api/review/route.ts`](C:\Users\giomj\OneDrive\Desktop\narravo\app\api\review\route.ts) delegates to `review-stream-orchestrator`.
3. `review-source-resolver` validates the URL, resolves metadata, and infers `contentType`.
4. The orchestrator emits a `metadata` event as soon as normalized metadata is available.
5. `review-template-router` selects the prompt family.
6. `review-context-assembler` gathers first-party or public source-tied text and records missing evidence.
7. `review-prompt-builder` creates the final Gemini prompt plan with XML contract instructions.
8. `gemini-review-client` streams editorial prose.
9. The orchestrator emits `chunk` events as prose arrives.
10. `review-output-parser` validates and parses the final XML payload.
11. The orchestrator emits one `complete` event containing the shared `ReviewResult`.

This preserves the transport shape already expected by [`ReviewExperience`](C:\Users\giomj\OneDrive\Desktop\narravo\components\narravo\review-experience.tsx).

## Model Output Contract

Gemini must produce two conceptual parts in a single generation:

1. streamed editorial prose
2. a strict XML tail payload

The prose exists for the reading experience. The XML exists for machine parsing.

The parser must not attempt to recover structure by scraping freeform prose. It should look for one bounded XML section at the tail and validate it strictly.

### XML Rules

- use one root review tag such as `ReviewResult`
- keep tag names fixed across all content types
- keep content-type differences inside values and repeated sections, not alternate schemas
- require escaping and well-formed XML content
- reject missing required tags
- reject malformed or truncated XML

Expected XML sections should cover:

- evidence sections
- score rows
- tags
- takeaway
- confidence

## Confidence Policy

Confidence must be derived from evidence coverage assembled by the backend, not only from model self-description.

Suggested confidence bands:

- `High confidence`
  - rich source-tied text coverage, including lyrics or equivalent grounding where appropriate
- `Medium confidence`
  - partial but still meaningful evidence coverage
- `Low confidence`
  - sparse source-tied text, requiring narrower and more conditional interpretation

If the context assembler cannot gather enough evidence to support a responsible reading for the detected content type, the pipeline should return `missing_context` instead of producing confident-sounding weak output.

## Error Model

Expected recoverable product errors should remain aligned with the existing user-facing review flow:

- `unsupported_platform`
- `private_track`
- `missing_context`
- `rate_limited`
- `resolve_failure`

An additional internal failure class should exist:

- `parse_failure`

`parse_failure` covers cases where Gemini returns malformed or incomplete XML. For MVP, this can still surface publicly as `resolve_failure` if the UI should avoid adding a new visible error branch yet.

Expected separation:

- product failures remain inside normal review-page states
- unexpected runtime faults remain route-boundary or server-side failures

## Testing Strategy

The pipeline should be testable mostly without live Gemini calls.

### Unit Tests

Cover:

- URL validation and content-type inference in `review-source-resolver`
- content-type to template selection in `review-template-router`
- evidence inclusion and missing-signal handling in `review-context-assembler`
- XML contract instructions in `review-prompt-builder`
- strict XML parsing and failure modes in `review-output-parser`

### Orchestration Tests

Mock stages and verify:

- event order is `metadata` -> `chunk` -> `complete`
- recoverable error mapping per stage
- no duplicate terminal events

### Golden Fixture Tests

Create representative fixtures for:

- `track`
- `ep-single`
- `album`
- `playlist`

Each fixture should include normalized inputs and mocked Gemini XML outputs so prompt-parser drift can be caught without live model traffic.

### Minimal Live Smoke Tests

Use a small number of live checks only to verify:

- SDK wiring
- streaming behavior
- XML tail delivery
- parser compatibility with real completions

These tests are for integration confidence, not broad correctness evaluation.

## Observability

Log stage-level request telemetry rather than only final failures.

Recommended fields:

- request id
- source platform
- content type
- stage start and end
- stage duration
- evidence coverage summary
- model call success or failure
- parser success or failure
- public error code returned

Logging constraints:

- do not log long lyrics bodies or large raw model outputs in standard logs
- prefer summaries and failure metadata
- preserve enough stage detail to diagnose resolver, prompt, model, and parser regressions

## MVP Guardrails

- no broad web research
- no persisted review artifacts
- no background job system
- no separate frontend result schemas per content type
- no model-selected schema changes
- no heuristic fallback from malformed XML into best-effort extraction
- no confident review when evidence coverage is below threshold

## Rollout Path

1. Keep the current demo review UX working.
2. Introduce typed staged modules behind the API route.
3. Replace seeded resolver behavior with real normalization and evidence assembly.
4. Bring up live Gemini generation against the shared event contract.
5. Expand and harden behavior across `track`, `ep-single`, `album`, and `playlist` within the same response shape.
6. Only treat the pipeline as ready once parser and orchestration tests are stable against representative XML completions.

## Out Of Scope

- authentication
- saved review history
- persisted canonical review pages
- background queue infrastructure
- broad research aggregation across the open web
- separate content-type-specific frontend page designs
- alternate transport contracts for different review types

## Implementation Notes

- preserve the current `/review?url=...` route model
- preserve the current NDJSON event semantics
- keep the API route thin and move logic into typed backend modules
- keep XML strict and explicit rather than permissive
- treat parser stability as a first-class requirement, not a cleanup step
