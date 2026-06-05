# Multi-Model Specialist Pipeline Design

## Summary

Narravo will add a config-driven, parallel specialist model stage behind the existing live review pipeline. The change preserves the current `/review?url=...` public entrypoint, single live request behavior, and NDJSON stream shape while improving grounded review quality through specialized intermediate analysis.

The first implementation will introduce provider-agnostic model-role interfaces, but only wire the current Gemini backend. Specialist models will run from the same grounded evidence packet, produce compact XML outputs, and fail closed when required structure or evidence references are missing. The final reviewer model will synthesize validated specialist outputs into the existing curated review result.

## Goals

- Keep the review flow route-driven and live streamed.
- Preserve the public NDJSON event contract: `metadata`, `chunk`, `complete`.
- Add task-specialized model roles without changing the frontend transport schema.
- Keep evidence grounded in metadata, lyrics, and approved source-tied context.
- Refuse or fail restrainedly when evidence coverage or model output structure is insufficient.
- Avoid persistent search, broad web retrieval, audio upload, queues, or background jobs in v1.

## Architecture

The selected architecture is **Config-Driven Parallel Specialists**.

The current pipeline shape remains:

```text
URL
  -> source resolver
  -> context assembler
  -> prompt/model stages
  -> XML parser
  -> stream orchestrator
  -> review page
```

The new shape inserts specialist analysis after context assembly and before final reviewer generation:

```text
URL
  -> source resolver
  -> context assembler
  -> per-request evidence ranking
  -> parallel specialist analysis
  -> final reviewer generation
  -> XML parsing
  -> existing complete result
```

The specialist stage runs required text specialists in parallel from the same `ReviewContextPacket`. It does not chain one specialist into another, because chaining increases latency and allows one flawed stage to contaminate the rest. Each specialist receives the same evidence boundary and returns a typed XML packet that can be validated independently.

## Model Tiers

### Tier 1: Best General Reviewer Models

The reviewer role remains responsible for the streamed critic-style prose and final `<ReviewResult>` XML. It receives the original evidence packet, ranked evidence hints, validated specialist summaries, and missing-signal constraints.

The reviewer must not repair malformed specialist output, override low evidence, or invent claims not supported by the provided packet.

### Tier 2: Lyrics Specialist Pipeline

The lyrics tier handles lyric-specific interpretation when lyrics are available through current allowed sources or user-provided lyrics. It uses normalized section and line IDs from the existing lyrics normalizer.

The lyrics specialist may annotate provided lyric sections and lines, but it must not invent lyrics or cite unavailable lines. When lyrics are unavailable, the tier is skipped and the final reviewer receives an explicit missing-signal constraint.

### Tier 3: Embeddings and Search

The embeddings tier ranks evidence within the current request only. It may embed metadata blocks, description blocks, genre tags, and lyric sections already gathered by the resolver and context assembler.

It must not introduce persistent vector storage, review memory, broad web search, or external music knowledge in v1.

### Tier 4: Audio Analysis Models

The audio tier is defined as an inactive roadmap adapter. It exists in the model role registry so future lawful audio signals can be added without changing downstream pipeline consumers.

In v1, no audio model runs and Narravo must not make audio-specific claims from unavailable audio. Sonic claims must remain constrained to source-tied metadata, tags, descriptions, or explicitly available context.

### Tier 5: Sentiment Models

The sentiment tier is a required text specialist. It analyzes valence, intensity, and sentiment movement across the available evidence.

Sentiment is intentionally separate from emotion analysis: sentiment describes polarity and intensity, while emotion identifies affective states such as grief, longing, anger, release, tenderness, or resignation.

## Internal Interfaces

### Model Registry

Add a provider-agnostic model registry with role-based lookup. Initial roles:

- `reviewer`
- `evidenceEmbedder`
- `themeAnalyst`
- `emotionAnalyst`
- `narrativeAnalyst`
- `classifier`
- `sentimentAnalyst`
- `lyricsSpecialist`
- `audioAnalyst`

The registry should expose stable internal operations for generation, streaming generation, and embeddings. The first implementation wires these roles to Gemini-backed adapters only. Future providers should be added behind the same role interface rather than branching throughout the pipeline.

Exact model IDs should be configurable by role. The plan should not hard-code multiple provider choices into business logic.

### Ranked Evidence Packet

Add a `RankedEvidencePacket` derived from the existing `ReviewContextPacket`.

It should contain:

- original evidence blocks
- stable evidence references
- optional relevance scores for evidence blocks
- optional relevance scores for lyric sections and line IDs
- missing-signal metadata carried through from context assembly

This packet is internal. It is used to focus specialist prompts and final reviewer synthesis, not to expand the evidence boundary.

### Specialist Analysis Packet

Add a `SpecialistAnalysisPacket` that aggregates validated specialist outputs.

Each compact specialist XML output should include:

- `Summary`
- `Claims`
- `EvidenceRefs`
- `Confidence`
- optional `RefusalReason`

Required specialists for v1:

- theme analysis
- emotion analysis
- narrative analysis
- song classification
- sentiment analysis

Lyrics specialist output is required only when lyrics exist. Audio specialist output is not required because audio analysis is inactive in v1.

## Failure Policy

Required specialist failures must fail closed before final reviewer generation.

Required failure cases include:

- malformed specialist XML
- missing required XML fields
- empty required claims
- missing or invalid evidence references
- unsupported confidence values
- claims that cannot be tied to provided evidence

Non-required unavailable signals should become missing signals, not fabricated analysis. This includes unavailable lyrics and inactive audio analysis.

The final reviewer output remains XML-backed and must also fail closed when `<ReviewResult>` is malformed or incomplete. The system must not add heuristic structure extraction for malformed XML.

## Public Contracts

The request body remains:

```ts
{
  url: string;
  lyrics?: string;
}
```

The shareable review route remains:

```text
/review?url=...
```

The NDJSON stream shape remains unchanged:

```text
metadata
chunk
complete
```

Specialist outputs are internal and curated into existing final review fields:

- prose review text
- evidence sections
- scores
- tags
- takeaway
- confidence
- lyrics intelligence

No new frontend diagnostics panel, progress event, or public specialist event is part of v1.

## Implementation Boundaries

Add new pipeline modules under `lib/pipeline/` for:

- model registry and role configuration
- Gemini provider adapter
- evidence ranking
- specialist prompt building
- specialist XML parsing
- specialist orchestration

Keep `app/api/review/route.ts` as a thin transport boundary. It should continue to validate request shape, start the stream, call the pipeline orchestrator, and map typed failures to HTTP-safe responses.

Keep review page UI changes minimal. Because specialist outputs remain internal and the public complete result stays stable, the first implementation should not require a new page-level diagnostics surface.

Do not add:

- background jobs
- queues
- persistent vector storage
- broad web research
- scraping expansion
- audio upload
- a new test runner
- new frontend transport schemas

## Acceptance Scenarios

### Valid Track With Lyrics

- Metadata emits first.
- Specialist text analyses run successfully.
- Lyrics specialist runs with normalized section and line IDs.
- Final reviewer streams prose chunks.
- Complete event includes parsed result and lyrics intelligence.

### Valid Track Without Lyrics

- Metadata emits first.
- Lyrics specialist is skipped.
- Missing lyrics are included as a confidence constraint.
- Final review avoids lyric-specific claims unless supported by other grounded evidence.

### Malformed Specialist XML

- Required specialist parser rejects the output.
- Final reviewer generation does not run.
- Pipeline returns a restrained product error.

### Malformed Final XML

- Final parser rejects incomplete or malformed `<ReviewResult>`.
- Pipeline fails closed.
- No heuristic extraction is attempted.

### Low Evidence Input

- Pipeline either fails with insufficient evidence or produces a constrained low-confidence review if minimum required evidence is present.
- The review does not bluff specific lyrical, narrative, or sonic claims.

### Unsupported URL

- Existing URL validation behavior remains intact.
- Unsupported sources fail before model calls.

### Stream Ordering

- `metadata` is emitted before any `chunk`.
- `chunk` events only contain final reviewer prose, not XML or specialist output.
- `complete` is emitted last when the review succeeds.

## Verification Plan

Use the repo-supported verification commands:

```bash
pnpm lint
pnpm build
```

Manual route validation should cover:

- Spotify track with lyrics
- YouTube Music track with lyrics
- track without available lyrics
- unsupported URL
- malformed specialist XML fixture or forced parser path
- malformed final XML fixture or forced parser path
- low-evidence input
- NDJSON event ordering

Do not introduce Jest, Vitest, Playwright, or ad hoc test commands unless the repository is explicitly updated to support them.

## Assumptions

- Current automatic lyrics sources plus user-uploaded lyrics remain allowed.
- Gemini remains the only implemented provider adapter in v1.
- Model IDs are configurable by role.
- Audio analysis is a roadmap interface only in v1.
- Embeddings are per-request ranking only.
- Specialist outputs are internal and curated into existing result fields.
- Public review transport remains stable.
