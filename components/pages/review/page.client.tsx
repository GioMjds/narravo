'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import type {
  NarravoRecoverableError,
  NarravoReviewStreamEvent,
} from '@/lib/narravo-review';
import type { ReviewState, ReviewExperienceProps } from './types';
import {
  createInitialState,
  EvidenceAndRubric,
  ReviewErrorState,
  ReviewHero,
  StreamingReviewPanel,
  UrlSubmissionForm,
} from './helpers';

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

  const startReview = useEffectEvent(
    async (url: string, signal: AbortSignal) => {
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
    },
  );

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
              <Badge
                variant="outline"
                className="rounded-full px-3 py-1 text-[11px] tracking-[0.18em] uppercase"
              >
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
              interpretation. If lyrical context is incomplete, the confidence
              note should say so rather than bluffing certainty.
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
