'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  AudioLines,
  BadgeInfo,
  CircleAlert,
  EqualApproximately,
  Loader2,
  RefreshCcw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { UrlSubmissionForm } from '@/components/narravo/url-submission-form';
import type {
  NarravoRecoverableError,
  NarravoReviewComplete,
  NarravoReviewMetadata,
  NarravoReviewStreamEvent,
} from '@/lib/narravo-review';

type ReviewState =
  | {
      kind: 'idle-invalid';
      url: string;
    }
  | {
      kind: 'resolving';
      url: string;
      metadata: NarravoReviewMetadata | null;
      reviewText: string;
    }
  | {
      kind: 'streaming-review';
      url: string;
      metadata: NarravoReviewMetadata;
      reviewText: string;
    }
  | {
      kind: 'parsed-complete';
      url: string;
      metadata: NarravoReviewMetadata;
      reviewText: string;
      result: NarravoReviewComplete;
    }
  | {
      kind: 'recoverable-error';
      url: string;
      error: NarravoRecoverableError;
    };

type ReviewExperienceProps = {
  initialUrl: string;
};

function createInitialState(initialUrl: string): ReviewState {
  const trimmedUrl = initialUrl.trim();

  if (!trimmedUrl) {
    return { kind: 'idle-invalid', url: '' };
  }

  return {
    kind: 'resolving',
    url: trimmedUrl,
    metadata: null,
    reviewText: '',
  };
}

export function ReviewExperience({ initialUrl }: ReviewExperienceProps) {
  const [state, setState] = useState<ReviewState>(() =>
    createInitialState(initialUrl),
  );
  const [attempt, setAttempt] = useState(0);

  const applyEvent = useEffectEvent((event: NarravoReviewStreamEvent) => {
    switch (event.type) {
      case 'metadata':
        setState((current) => {
          if (
            current.kind === 'idle-invalid' ||
            current.kind === 'recoverable-error'
          ) {
            return current;
          }

          return {
            kind: 'streaming-review',
            url: current.url,
            metadata: event.metadata,
            reviewText: current.reviewText,
          };
        });
        break;
      case 'chunk':
        setState((current) => {
          if (current.kind !== 'streaming-review') {
            return current;
          }

          return {
            ...current,
            reviewText: `${current.reviewText}${event.chunk}`,
          };
        });
        break;
      case 'complete':
        setState((current) => {
          if (current.kind !== 'streaming-review') {
            return current;
          }

          return {
            kind: 'parsed-complete',
            url: current.url,
            metadata: current.metadata,
            reviewText:
              current.reviewText.trim() || event.result.reviewText.trim(),
            result: event.result,
          };
        });
        break;
    }
  });

  const startReview = useEffectEvent(async (url: string, signal: AbortSignal) => {
    const response = await fetch('/api/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
      signal,
    });

    if (!response.ok) {
      const payload = (await response.json()) as {
        error: NarravoRecoverableError;
      };

      setState({
        kind: 'recoverable-error',
        url,
        error: payload.error,
      });

      return;
    }

    if (!response.body) {
      setState({
        kind: 'recoverable-error',
        url,
        error: {
          code: 'resolve_failure',
          status: 500,
          title: 'No review stream was returned',
          message:
            'Narravo expected a streaming review response, but the connection returned empty.',
          hint: 'Please retry the request.',
        },
      });

      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      while (buffer.includes('\n')) {
        const newlineIndex = buffer.indexOf('\n');
        const raw = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (!raw) {
          continue;
        }

        applyEvent(JSON.parse(raw) as NarravoReviewStreamEvent);
      }
    }

    const trailing = buffer.trim();
    if (trailing) {
      applyEvent(JSON.parse(trailing) as NarravoReviewStreamEvent);
    }
  });

  useEffect(() => {
    const nextState = createInitialState(initialUrl);

    if (nextState.kind === 'idle-invalid') {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void startReview(nextState.url, controller.signal).catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          kind: 'recoverable-error',
          url: nextState.url,
          error: {
            code: 'resolve_failure',
            status: 500,
            title: 'Narravo could not finish the review',
            message:
              error instanceof Error
                ? error.message
                : 'An unexpected error interrupted the review stream.',
            hint: 'Retry the review or return to the landing page.',
          },
        });
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [attempt, initialUrl]);

  const heroMetadata =
    state.kind === 'streaming-review' || state.kind === 'parsed-complete'
      ? state.metadata
      : state.kind === 'resolving'
        ? state.metadata
        : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-[0_24px_80px_-52px_rgba(40,28,21,0.45)]">
            <div className="mb-5 flex items-center gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] tracking-[0.18em] uppercase">
                Shareable review
              </Badge>
            </div>
            <ReviewHero state={state} metadata={heroMetadata} />
          </div>

          <UrlSubmissionForm
            defaultValue={initialUrl}
            compact
            showExamples={state.kind === 'recoverable-error'}
          />

          <div className="rounded-[1.75rem] border border-border/70 bg-card/80 p-5">
            <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
              Trust boundary
            </p>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Narravo separates resolved facts, grounded cues, and critic
              interpretation. If lyrical context is incomplete, the confidence note
              should say so rather than bluffing certainty.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <StreamingReviewPanel state={state} />
          <EvidenceAndRubric state={state} />

          {state.kind === 'recoverable-error' ? (
            <ReviewErrorState
              error={state.error}
              onRetry={() => setAttempt((value) => value + 1)}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function ReviewHero({
  state,
  metadata,
}: {
  state: ReviewState;
  metadata: NarravoReviewMetadata | null;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
      {metadata ? (
        <Image
          src={metadata.coverArtUrl}
          alt={`${metadata.title} cover art`}
          width={640}
          height={640}
          unoptimized
          className="aspect-square w-full rounded-[1.5rem] border border-border/70 object-cover shadow-[0_22px_40px_-24px_rgba(0,0,0,0.45)]"
        />
      ) : (
        <div className="aspect-square w-full animate-pulse rounded-[1.5rem] border border-border/70 bg-muted/70" />
      )}

      <div className="flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {metadata ? metadata.platformLabel : 'Resolving source'}
            </Badge>
            {state.kind === 'streaming-review' ? (
              <Badge className="rounded-full px-3 py-1">
                <Loader2 className="size-3.5 animate-spin" />
                Streaming review
              </Badge>
            ) : null}
            {state.kind === 'parsed-complete' ? (
              <Badge className="rounded-full px-3 py-1">
                <BadgeInfo className="size-3.5" />
                Review grounded
              </Badge>
            ) : null}
          </div>

          {metadata ? (
            <>
              <div>
                <h1 className="font-heading text-4xl leading-none font-semibold tracking-tight text-foreground sm:text-5xl">
                  {metadata.title}
                </h1>
                <p className="mt-2 text-lg text-muted-foreground">
                  {metadata.artist}
                </p>
              </div>
              <p className="text-sm leading-7 text-muted-foreground">
                {metadata.releaseLabel}
              </p>
            </>
          ) : (
            <div className="space-y-3">
              <div className="h-8 w-3/4 animate-pulse rounded-full bg-foreground/12" />
              <div className="h-5 w-1/2 animate-pulse rounded-full bg-foreground/10" />
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-foreground/8" />
            </div>
          )}
        </div>

        <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-4">
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Current state
          </p>
          <p className="mt-2 text-sm leading-7 text-foreground">
            {state.kind === 'idle-invalid'
              ? 'Paste a supported track URL to start the review.'
              : state.kind === 'resolving'
                ? 'Narravo is validating the platform and preparing grounded song context.'
                : state.kind === 'streaming-review'
                  ? 'Metadata is resolved and the critic prose is streaming now.'
                  : state.kind === 'parsed-complete'
                    ? 'Facts, evidence, and interpretation are all available.'
                    : state.error.message}
          </p>
        </div>
      </div>
    </div>
  );
}

function StreamingReviewPanel({ state }: { state: ReviewState }) {
  const isReviewVisible =
    state.kind === 'streaming-review' || state.kind === 'parsed-complete';

  return (
    <Card className="rounded-[2rem] border border-border/70 bg-card/90 py-0 shadow-[0_24px_80px_-52px_rgba(40,28,21,0.45)]">
      <CardHeader className="border-b border-border/70 py-5">
        <CardTitle className="font-heading text-3xl font-semibold tracking-tight">
          The critic&apos;s read
        </CardTitle>
        <CardDescription className="text-sm leading-7">
          Long-form interpretation appears before the evidence rubric so the page
          still reads like criticism rather than a dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="py-6">
        {state.kind === 'idle-invalid' ? (
          <EmptyState
            icon={<CircleAlert className="size-5" />}
            title="No song link yet"
            body="Paste a Spotify or YouTube Music track URL above to generate a shareable review page."
          />
        ) : null}

        {state.kind === 'resolving' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Resolving metadata
            </div>
            <div className="space-y-3">
              <div className="h-3.5 w-full animate-pulse rounded-full bg-foreground/10" />
              <div className="h-3.5 w-[96%] animate-pulse rounded-full bg-foreground/10" />
              <div className="h-3.5 w-[90%] animate-pulse rounded-full bg-foreground/10" />
              <div className="h-3.5 w-[85%] animate-pulse rounded-full bg-foreground/10" />
            </div>
          </div>
        ) : null}

        {isReviewVisible ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              {state.kind === 'streaming-review' ? (
                <>
                  <AudioLines className="size-4 text-(--color-accent-strong)" />
                  Streaming interpretation
                </>
              ) : (
                <>
                  <EqualApproximately className="size-4 text-(--color-accent-strong)" />
                  Completed interpretation
                </>
              )}
            </div>
            <div
              aria-live="polite"
              className="space-y-4 font-serif text-lg leading-8 text-foreground sm:text-[1.18rem]"
            >
              {state.reviewText
                .split('\n\n')
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p key={`${index}-${paragraph.slice(0, 18)}`}>{paragraph}</p>
                ))}
              {state.kind === 'streaming-review' ? (
                <span className="inline-flex size-2.5 animate-pulse rounded-full bg-(--color-accent-strong) align-middle" />
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EvidenceAndRubric({ state }: { state: ReviewState }) {
  if (state.kind === 'parsed-complete') {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-[2rem] border border-border/70 bg-card/90 py-0 shadow-[0_24px_80px_-52px_rgba(40,28,21,0.45)]">
          <CardHeader className="border-b border-border/70 py-5">
            <CardTitle className="font-heading text-3xl font-semibold tracking-tight">
              Evidence used
            </CardTitle>
            <CardDescription className="text-sm leading-7">
              The model should show what supported the reading instead of hiding
              behind a single opaque opinion.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 py-6">
            {state.result.evidence.map((section) => (
              <div
                key={section.title}
                className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4"
              >
                <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                  {section.title}
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-foreground">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-(--color-accent-strong)" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border border-border/70 bg-card/90 py-0 shadow-[0_24px_80px_-52px_rgba(40,28,21,0.45)]">
          <CardHeader className="border-b border-border/70 py-5">
            <CardTitle className="font-heading text-3xl font-semibold tracking-tight">
              Meaning-first rubric
            </CardTitle>
            <CardDescription className="text-sm leading-7">
              Scores arrive after the prose so the review keeps its editorial center.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 py-6">
            <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
              <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                Confidence note
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {state.result.confidence.label}
              </p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                {state.result.confidence.note}
              </p>
            </div>
            <div className="space-y-4">
              {state.result.scores.map((score) => (
                <div key={score.label} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">
                      {score.label}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {score.score}/100
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-[linear-gradient(90deg,var(--color-accent-strong),var(--color-accent-soft))]"
                      style={{ width: `${score.score}%` }}
                    />
                  </div>
                  <p className="text-sm leading-7 text-muted-foreground">
                    {score.note}
                  </p>
                </div>
              ))}
            </div>
            <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
              <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                Tags
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {state.result.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="rounded-full px-3 py-1"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              <p className="mt-4 text-sm leading-7 text-foreground">
                {state.result.takeaway}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.kind === 'streaming-review' || state.kind === 'resolving') {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <LoadingCard
          title="Evidence used"
          body="Lyrical themes, emotional cues, and tonal atmosphere appear once the interpretation is parsed."
        />
        <LoadingCard
          title="Meaning-first rubric"
          body="Scores and tags wait until the full critic read is grounded."
        />
      </div>
    );
  }

  return null;
}

function LoadingCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="rounded-[2rem] border border-border/70 bg-card/90 py-0 shadow-[0_24px_80px_-52px_rgba(40,28,21,0.45)]">
      <CardHeader className="border-b border-border/70 py-5">
        <CardTitle className="font-heading text-3xl font-semibold tracking-tight">
          {title}
        </CardTitle>
        <CardDescription className="text-sm leading-7">{body}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 py-6">
        <div className="h-20 animate-pulse rounded-[1.5rem] bg-muted/70" />
        <div className="h-20 animate-pulse rounded-[1.5rem] bg-muted/70" />
        <div className="h-20 animate-pulse rounded-[1.5rem] bg-muted/70" />
      </CardContent>
    </Card>
  );
}

function ReviewErrorState({
  error,
  onRetry,
}: {
  error: NarravoRecoverableError;
  onRetry: () => void;
}) {
  return (
    <Card className="rounded-[2rem] border border-destructive/30 bg-destructive/5 py-0 shadow-[0_24px_80px_-52px_rgba(40,28,21,0.25)]">
      <CardHeader className="border-b border-destructive/20 py-5">
        <CardTitle className="flex items-center gap-2 font-heading text-3xl font-semibold tracking-tight text-foreground">
          <AlertCircle className="size-5 text-destructive" />
          {error.title}
        </CardTitle>
        <CardDescription className="text-sm leading-7 text-foreground/80">
          {error.message}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 py-6">
        <div className="rounded-[1.5rem] border border-destructive/20 bg-background/80 p-4">
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Recovery path
          </p>
          <p className="mt-2 text-sm leading-7 text-foreground">{error.hint}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            size="lg"
            className="cursor-pointer rounded-full px-5"
            onClick={onRetry}
          >
            <RefreshCcw className="size-4" />
            Retry review
          </Button>
          <Button
            asChild
            type="button"
            size="lg"
            variant="outline"
            className="cursor-pointer rounded-full px-5"
          >
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-border/80 bg-background/70 p-6 text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <h2 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{body}</p>
    </div>
  );
}
