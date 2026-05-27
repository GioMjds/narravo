# AGENTS.md

Repository rules for Narravo.

## Mission Context

Narravo is not a generic AI utility. It is an editorial music product that turns supported music URLs into grounded meaning reviews.

Core product intent:

- accept Spotify and YouTube Music URLs
- resolve a music object such as a `track`, `ep-single`, `album`, or `playlist`
- generate a critic-style interpretation
- visibly separate resolved facts, grounded evidence, and interpretation
- stream the reading experience live on the review page
- preserve user trust by refusing to bluff when evidence coverage is weak

When making product or architecture decisions, optimize for:

- groundedness over breadth
- readability over dashboard noise
- explicit system boundaries over monolithic convenience
- stable transport contracts over ad hoc type branching

## Build, Lint, And Run Commands

- `pnpm dev` starts the Next.js dev server.
- `pnpm build` creates the production build.
- `pnpm start` runs the production build.
- `pnpm lint` runs ESLint.

## Test Commands

- There is currently no dedicated test runner configured in `package.json`.
- Do not invent Jest, Vitest, Playwright, or ad hoc test commands in future sessions unless the repo is explicitly updated to support them.
- Current verification is based on `pnpm lint`, `pnpm build`, targeted type safety, and manual route validation.

## Framework And Platform Rules

- This repo uses `Next.js 16` with the App Router.
- This is not standard historical Next.js. Before making framework-specific changes, read the relevant local docs in `node_modules/next/dist/docs/`.
- Start with these local docs when the change touches routing or rendering:
  - `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- Route files, layouts, metadata handling, and rendering behavior should follow the local Next docs, not stale training assumptions.
- Keep `typedRoutes: true` intact in [`next.config.ts`](C:\Users\giomj\OneDrive\Desktop\narravo\next.config.ts).
- Keep `reactCompiler: true` intact unless there is an explicit reason to remove it.
- Preserve the global `Cross-Origin-Opener-Policy` header unless the change explicitly requires a different policy.
- Use the `@/*` path alias from `tsconfig.json`.

## Product And AI Platform Rules

- Supported sources are currently Spotify and YouTube Music.
- The shareable review contract stays route-driven: `/review?url=...`.
- Review generation is a single live request, not a background job.
- The AI SDK for generation is `@google/generative-ai`.
- Use one Gemini generation model across review types unless a later design explicitly changes that.
- Allowed evidence is limited to metadata plus first-party or public source-tied text.
- Do not introduce broad web research as an implicit evidence source.
- The structured model output contract is XML.
- Do not fall back to heuristic structure extraction when XML is malformed.
- If grounded evidence is insufficient, fail with a restrained product error instead of fabricating a confident review.

## Folder Structure

Treat the repository layout as intentional.

- `app/`
  - App Router entrypoints only.
  - Route files such as `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, and `api/**/route.ts`.
- `components/pages/`
  - Page-level client experiences and page composition components.
  - This is the preferred home for interactive page implementations that back an App Router route.
- `components/narravo/`
  - Product-specific reusable components that are not full page containers.
  - Examples: forms, review panels, reusable product widgets.
- `components/layouts/`
  - Shared site shell elements such as `Header` and `Footer`.
- `components/ui/`
  - UI primitives and composable shared controls.
  - Prefer using and extending these before creating new primitives.
- `lib/`
  - Shared utilities, types, parsers, data access, orchestration helpers, and backend domain logic.
  - This is where review-engine stages should live.
- `docs/superpowers/`
  - Product specs, design docs, and architecture artifacts.
- `public/`
  - Static assets only.
- `stores/`
  - Client-side state stores if needed.
- `utils/`
  - Use only for truly generic helpers if they do not belong in `lib/`.

## Server Components In `app/` Vs Client Page Components In `components/pages/*`

Default rule:

- `app/` stays server-first.
- page-level interactivity lives in `components/pages/*`.

### `app/` Responsibilities

Files in `app/` should stay thin and focused on framework concerns:

- route entry
- metadata
- search params and route params
- server-side data bootstrapping
- rendering boundaries such as `loading.tsx`, `error.tsx`, and `not-found.tsx`
- delegating to page-level components

Do in `app/`:

- parse `searchParams` or awaited route params
- choose which page component to render
- perform server-safe fetches or lightweight orchestration
- keep file-convention logic local to the route

Avoid in `app/`:

- large interactive state machines
- dense client event logic
- reusable product widgets
- prompt-building or parser logic
- long blocks of UI composition that belong to a page module

### `components/pages/*` Responsibilities

Use `components/pages/*` for page-level client or hybrid composition:

- client state machines
- route-specific interactive experiences
- page-specific section orchestration
- streaming or optimistic UI behaviors
- large page layouts that would make `app/**/page.tsx` noisy

If a route becomes interactive, the preferred pattern is:

1. keep `app/**/page.tsx` as a Server Component
2. pass normalized props into a page component under `components/pages/*`
3. put `"use client"` only in the page component or its interactive subtrees

For example, future preferred shapes are:

- `app/review/page.tsx` -> server wrapper
- `components/pages/review/review-page.tsx` -> page-level experience
- `components/narravo/*` -> reusable review subcomponents

## Architecture Rules

### Keep The Review Surface Stable

Preserve these contracts unless the repo spec explicitly changes them:

- `/review?url=...` remains the public review entry
- `app/api/review/route.ts` remains a thin transport entrypoint
- the NDJSON stream shape remains:
  - `metadata`
  - `chunk`
  - `complete`
- the high-level review result remains shared across all content types

### Keep Backend Logic Staged

The review engine should be implemented as explicit modules in `lib/`, not as one large route handler.

Preferred staged modules:

- source resolver
- template router
- context assembler
- prompt builder
- Gemini client
- XML output parser
- stream orchestrator

Rules:

- content-type differences belong in routing, templates, and context assembly
- they do not justify separate frontend transport schemas
- route handlers should compose stage modules, not contain business logic directly
- parser failures must fail closed

### Server-First Data Boundaries

- Fetch and normalization logic should stay server-side by default.
- Do not move source resolution, parser logic, or Gemini calls into client components.
- Only browser-specific concerns should live in client code.

### Thin Route Handlers

API route files should:

- validate request shape
- call an orchestrator or service
- map typed failures to HTTP responses
- stream or return transport-safe payloads

API route files should not:

- contain embedded prompt templates
- contain XML parsing logic
- accumulate cross-stage domain decisions

## Composition Rules

- Prefer small, named components over deeply nested inline JSX.
- Prefer composition of `components/ui/*` primitives before inventing custom building blocks.
- Keep layout shell concerns in `components/layouts/*`.
- Keep product-specific reusable UI in `components/narravo/*`.
- Promote a piece into `components/pages/*` only when it represents route-level composition or route-level state.
- Use `lib/utils.ts` `cn()` for conditional class composition.
- Avoid duplicating display logic across routes. If the same UI appears on landing, review, or about flows, extract it.
- Keep schemas, types, and parsers close to the domain logic in `lib/`.

## Styling And UX Rules

Narravo should feel like an editorial music journal, not a generic AI dashboard.

### Visual Direction

- prioritize warm, literary, album-art-forward presentation
- prefer expressive serif typography for titles and editorial content
- prefer clean sans-serif typography for UI chrome and metadata
- avoid glossy AI chrome, neon gradients, and generic “assistant” styling
- keep the shell minimal so the review content remains the focus

### Review UX Rules

- always distinguish facts, grounded evidence, and interpretation
- keep long-form prose readable and visually calm
- reveal evidence and rubric without making the page feel like an analytics dashboard
- preserve layout stability during streaming
- use skeletons and reserved space to avoid jumpy rendering
- keep recovery actions obvious when a review fails

### Accessibility Rules

- maintain visible focus states
- do not rely on color alone for meaning
- keep touch targets comfortably tappable
- respect reduced motion
- keep body text readable on mobile widths
- avoid horizontal scrolling in core flows

### Theme Rules

- global theme behavior is owned by [`components/theme-provider.tsx`](./components/theme-provider.tsx)
- do not implement one-off theme toggling logic inside feature components
- use the tokens in [`app/globals.css`](./app/globals.css) rather than hardcoding ad hoc colors when a token exists

## Delivery Rules

- Keep edits scoped to the request.
- Do not rewrite working product surfaces when the change only needs backend or component internals.
- Preserve existing route contracts unless the request explicitly changes them.
- Prefer ASCII in docs and code unless a file already requires Unicode.
- Add brief comments only where the code would otherwise be difficult to follow.
- Do not introduce dead compatibility layers unless they are necessary for an incremental rollout.

## Verification Rules

For any meaningful change, verify with the strongest checks the repo currently supports.

Minimum expected checks:

- `pnpm lint`
- `pnpm build` when the change affects routing, rendering boundaries, config, or typed contracts

For route and UI changes, also verify:

- the route loads
- expected loading and error states still render
- no obvious layout regressions appear on mobile and desktop widths

For review-engine changes, also verify:

- NDJSON event ordering remains valid
- content-type routing still matches the submitted source
- malformed XML is rejected cleanly
- low-evidence inputs do not produce overconfident output

If full verification cannot be run, say exactly what was not verified and why.

## File-Specific Notes

- [`app/layout.tsx`](C:\Users\giomj\OneDrive\Desktop\narravo\app\layout.tsx) owns the site shell, font setup, global metadata defaults, and theme provider.
- [`app/api/review/route.ts`](C:\Users\giomj\OneDrive\Desktop\narravo\app\api\review\route.ts) should remain a thin API boundary.
- [`components/narravo/review-experience.tsx`](C:\Users\giomj\OneDrive\Desktop\narravo\components\narravo\review-experience.tsx) currently contains the client review state machine and is a candidate to move under `components/pages/review/*` as page composition evolves.
- [`lib/narravo-review.ts`](C:\Users\giomj\OneDrive\Desktop\narravo\lib\narravo-review.ts) currently mixes demo-domain logic and should not become the final home for the full staged engine.
