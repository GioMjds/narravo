# Narravo MVP Pages Design

Date: 2026-05-27
Project: Narravo
Scope: Public MVP page set for an AI-powered song meaning reviewer

## Goal

Build the first public-facing Narravo experience around a single question: what is this song about?

The MVP should feel like a focused editorial music journal, not a generic AI utility. Anonymous users should be able to paste a supported song URL, land on a shareable review page, read a streaming critic-style interpretation, and understand what evidence the system used to produce that interpretation.

## Product Decisions

- Shell: minimal shell
- Visual direction: editorial music journal
- Result route: shareable review URL
- Supported sources: Spotify and YouTube Music
- Evidence visibility: visible evidence sections
- Review framing: critic-first editorial
- Structured scoring: meaning-first rubric
- Credibility rule: reviews must separate grounded inputs from interpretation and must not present unsupported certainty

## Route Map

### `/`

Landing page for anonymous users.

Responsibilities:

- Present the product promise in one line
- Accept a Spotify or YouTube Music URL
- Provide one primary submit action
- Set expectation that the app returns a grounded interpretation, not a generic summary

### `/review`

Shareable result page driven by the `url` search param, for example `/review?url=...`.

Responsibilities:

- Validate the incoming URL shape
- Start the review request
- Show resolved track metadata
- Stream critic prose while the review is generating
- Reveal evidence sections and rubric when parsing completes
- Render tailored failure states for expected product errors

### `/about`

Trust and explanation page.

Responsibilities:

- Explain what Narravo does
- List supported platforms
- Explain what the AI analyzes
- Explain confidence limits when lyrics or context are incomplete

### Root `not-found`

Global unmatched route fallback and irrecoverable bad-request fallback.

Responsibilities:

- Explain that the requested page does not exist or cannot be resolved
- Offer a single recovery path back to `/`

### `app/review/error.tsx`

Segment error boundary for unexpected runtime failures on the review route, using the local Next.js App Router `error.js` convention.

Responsibilities:

- Catch unexpected runtime failures
- Avoid exposing raw internal details
- Offer a retry action

## Review Page State Machine

The review page is the product surface and should be designed as explicit states instead of one static layout.

### `idle-invalid`

Used when the `url` param is missing, empty, or malformed.

UI:

- Reuse the URL form
- Show a concise validation message
- Link the user back into the supported flow

### `resolving`

Used while the platform and metadata are being resolved.

UI:

- Metadata skeletons
- Reserved cover-art space to prevent layout shift
- Status copy that says the system is validating the song source

### `streaming-review`

Used once metadata is ready and prose generation begins.

UI:

- Cover art and metadata visible
- Critic prose appears progressively
- Evidence cards and rubric remain in loading placeholders

### `parsed-complete`

Used when prose, evidence, and rubric are ready.

UI:

- Full editorial review
- Evidence sections
- Meaning-first rubric
- Tags and short takeaway

### `recoverable-error`

Used for expected product failures.

Error variants:

- Unsupported platform
- Private or unavailable track
- Upstream resolve failure
- Missing lyrical context
- Rate limit or temporary service overload

UI:

- Clear cause-specific title
- One sentence explaining what happened
- One action to retry or paste another URL

### `not-found`

Used for unmatched routes or irrecoverably bad navigation.

## Credibility And Interpretation Rules

Narravo should not behave like an unconstrained chat assistant. The product must make the review pipeline legible.

Every review is composed from three layers:

1. Resolved facts
2. Grounded inputs
3. Critic interpretation

### Resolved Facts

Resolved facts include:

- Title
- Artist
- Cover art
- Platform source
- Release details when available

These are presented as factual metadata.

### Grounded Inputs

Grounded inputs include:

- Lyrics, when available
- Derived lyrical themes
- Emotional cues
- Tonal or atmospheric cues
- Confidence notes about evidence completeness

If lyrics are partial or unavailable, the UI must say so explicitly. The system may still generate a limited review, but it must downgrade confidence and avoid strong claims about meaning that depend on missing evidence.

### Critic Interpretation

Interpretation includes:

- Streaming editorial prose
- Meaning-first scores
- Theme tags
- Plain-language takeaway

This content should be framed as interpretation based on the grounded inputs above, not as objective truth.

## Information Hierarchy

The review page should be read in this order:

1. Resolved song metadata
2. Streaming editorial review
3. Evidence sections
4. Meaning-first rubric and tags

This order keeps the page aligned to the user question first, while still making the evidence visible before the final structured verdict.

## Visual Direction

Narravo should feel like a small editorial publication for listening notes.

Design goals:

- Warm and literary rather than glossy or futuristic
- Album-art-forward without becoming a fake music player
- High readability for long-form prose
- Quiet trust cues instead of loud product marketing

### Shell

Use a minimal shell across public pages:

- Slim top bar
- `Narravo` wordmark or simple text mark
- `About` link
- Quiet footer

The shell should not compete with the URL form or the review body.

### Color System

Use paper-like neutrals and ink-heavy text, with restrained warm accents.

Primary direction:

- Warm light background for editorial reading
- Deep charcoal or ink foreground
- Rust, bronze, or muted red accents for emphasis
- Dark mode that feels like a dim listening room, not pure black AI chrome

The `ui-ux-pro-max` design-system pass was useful for accent-family direction and single-column focus, but its dark-only recommendation should be rejected because this MVP needs strong editorial light mode and dual-theme support.

### Typography

Use an expressive serif for page headlines and song titles, paired with a clean sans for interface text, metadata, labels, and scores.

Typography responsibilities:

- Serif carries mood and editorial identity
- Sans carries clarity and utility
- Long-form review text must prioritize readability over novelty

### Motion

Motion should be minimal and purposeful:

- Soft fades for streaming prose
- Skeletons for loading
- No layout jumps when content arrives
- Respect `prefers-reduced-motion`

## Page Composition

### Landing Page

Composition:

- Centered hero
- One-line promise
- Single URL field
- One primary CTA
- One supporting line for supported links

Content should stay minimal. No feature grid is required for MVP.

### Review Page

Composition:

- Review hero with cover art and metadata
- Streaming review panel
- Evidence cards
- Meaning-first rubric
- Tags and short takeaway
- Recovery form or retry action when applicable

### About Page

Composition:

- What Narravo does
- Supported links
- How reviews are grounded
- What low-confidence analysis means
- Short note that interpretation is evidence-informed criticism, not factual omniscience

### Error And Not Found

Composition:

- Simple explanation card
- Clear recovery action
- Same typography and shell language as the rest of the site

## MVP Components

Build the pages from reusable pieces instead of page-specific markup.

### `Shell`

- Minimal header and footer
- Shared spacing and page container rules

### `UrlSubmissionForm`

- Shared on landing and retry states
- URL validation
- Submit loading state
- Helper copy for supported platforms

### `ReviewHero`

- Cover art
- Title
- Artist
- Release info
- Source badge
- Request status

### `StreamingReviewPanel`

- Editorial prose area
- Loading skeleton
- Streaming indicator
- Graceful partial-content display

### `EvidenceSection`

Grouped cards for:

- Lyrical themes
- Emotional cues
- Tonal atmosphere
- Confidence notes

### `MeaningRubric`

Five score rows:

- Theme clarity
- Emotional impact
- Lyrical depth
- Sonic atmosphere
- Replay pull

Also includes tags and a short takeaway.

### `ReviewErrorState`

Variant component for each expected product failure.

## Data Flow

1. User pastes a Spotify or YouTube Music URL into `/`.
2. Client validates basic URL shape.
3. App navigates to `/review?url=...`.
4. `/review` triggers the review request through `app/api/review/route.ts`.
5. The backend resolves platform and metadata first.
6. Once the song is valid, the API begins streaming critic prose.
7. After generation completes or reaches the parse boundary, the UI reveals evidence sections and rubric.

The frontend must reserve enough layout space for the metadata and result sections so that streaming does not cause a jumpy page.

## Failure Model

Expected product failures should remain inside normal page-state UI:

- Unsupported URL or unsupported platform
- Private or unavailable track
- Missing lyrical context
- Upstream resolution failure
- Rate limiting

Unexpected runtime failures should use `app/review/error.tsx`.

This separation matters because product failures are part of the user journey and should feel intentional, while runtime faults are implementation problems and should use a route boundary plus retry behavior.

## Accessibility And UX Requirements

- Maintain visible focus states
- Keep touch targets at least 44px high
- Do not rely on color alone to communicate status
- Respect `prefers-reduced-motion`
- Keep body text readable at mobile sizes
- Avoid horizontal scroll
- Provide clear error recovery actions
- Use skeletons and reserved space to reduce layout shift
- Preserve a single obvious primary action on the landing page

## Success Criteria

The MVP design is successful when:

1. Anonymous visitors immediately understand that Narravo analyzes song meaning from supported links.
2. The landing page has one obvious next action.
3. `/review?url=...` is refresh-safe and shareable.
4. The review page handles resolving, streaming, completion, and failure states gracefully.
5. The interface visibly separates facts, evidence, and interpretation.
6. The About page reduces confusion about what the AI knows and what it does not know.
7. The error experience explains specific problems instead of collapsing everything into a generic failure screen.

## Out Of Scope For This MVP

- Authentication
- Saved review history
- Social sharing widgets beyond the shareable URL itself
- Rich audio playback controls
- Multi-song comparison
- Community comments
- Slug-based canonical review pages

## Implementation Notes

- Keep the anonymous experience frame-light with the existing global layout reduced to a minimal shell.
- Prefer route-driven state on `/review` over client-only in-memory state.
- Use the App Router conventions already present in the repo.
- Add a route-level error boundary for review failures that are not expected product outcomes.
- Preserve typed route compatibility with the current Next.js setup.
