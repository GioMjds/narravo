'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ReactNode, useId, useRef, useState, useTransition } from 'react';
import {
  demoLinks,
  validateNarravoUrlInput,
  type NarravoRecoverableError,
  type NarravoReviewMetadata,
  type LyricsIntelligence,
} from '@/lib/narravo-review';
import { LyricsIntelligencePanel } from './lyrics-intelligence-panel';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { LyricsUploaderProps, ReviewState, UrlSubmissionFormProps } from './types';
import {
  AlertCircle,
  ArrowRight,
  AudioLines,
  BadgeInfo,
  CircleAlert,
  EqualApproximately,
  FileText,
  Link2,
  Loader2,
  RefreshCcw,
  Upload,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function createInitialState(initialUrl: string): ReviewState {
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

export function UrlSubmissionForm({
  defaultValue = '',
  compact = false,
  showExamples = false,
  autoFocus = false,
  className,
}: UrlSubmissionFormProps) {
  const router = useRouter();
  const fieldId = useId();
  const [value, setValue] = useState<string>(defaultValue);
  const [error, setError] = useState<string>('');
  const [isPending, beginTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextValue = value.trim();
    const validation = validateNarravoUrlInput(nextValue);

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setError('');
    beginTransition(() => {
      router.push(`/review?url=${encodeURIComponent(nextValue)}`);
    });
  }

  return (
    <div className={cn('space-y-3', className)}>
      <form
        onSubmit={onSubmit}
        className={cn(
          'rounded-[1.75rem] border border-border/70 bg-card/90 p-3 shadow-[0_24px_80px_-52px_rgba(40,28,21,0.45)] backdrop-blur',
          compact ? 'max-w-none' : 'max-w-3xl',
        )}
      >
        <label
          htmlFor={fieldId}
          className="mb-3 flex items-center gap-2 px-2 text-sm font-medium text-foreground"
        >
          <Link2 className="size-4 text-(--color-accent-strong)" />
          Paste a Spotify or YouTube Music track link
        </label>
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            id={fieldId}
            type="url"
            inputMode="url"
            autoFocus={autoFocus}
            autoComplete="off"
            spellCheck={false}
            placeholder="https://open.spotify.com/track/..."
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${fieldId}-error` : `${fieldId}-hint`}
            className="h-14 rounded-[1.2rem] border-border/80 bg-background px-4 text-base md:flex-1"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <Button
            type="submit"
            size="lg"
            className="h-14 cursor-pointer rounded-[1.2rem] px-6 text-sm font-semibold"
            disabled={isPending}
          >
            {isPending ? 'Opening review...' : 'Review this song'}
            <ArrowRight className="size-4" />
          </Button>
        </div>
        <p
          id={`${fieldId}-hint`}
          className="mt-3 px-2 text-sm leading-7 text-muted-foreground"
        >
          Narravo only supports Spotify and YouTube Music track URLs for this
          MVP.
        </p>
        {error ? (
          <p
            id={`${fieldId}-error`}
            role="alert"
            className="mt-2 px-2 text-sm font-medium text-destructive"
          >
            {error}
          </p>
        ) : null}
      </form>

      {showExamples ? (
        <div className="flex flex-wrap gap-2 px-1">
          {demoLinks.map((example) => (
            <Link
              key={example.href}
              href={`/review?url=${encodeURIComponent(example.href)}`}
              className="rounded-full border border-border/80 bg-background/75 px-3 py-1.5 text-sm text-muted-foreground transition hover:border-foreground/20 hover:text-foreground"
            >
              {example.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function EmptyState({
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

export function ReviewErrorState({
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

export function ReviewHero({
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

export function StreamingReviewPanel({ state }: { state: ReviewState }) {
  const isReviewVisible =
    state.kind === 'streaming-review' || state.kind === 'parsed-complete';

  return (
    <Card className="rounded-[2rem] border border-border/70 bg-card/90 py-0 shadow-[0_24px_80px_-52px_rgba(40,28,21,0.45)]">
      <CardHeader className="border-b border-border/70 py-5">
        <CardTitle className="font-heading text-3xl font-semibold tracking-tight">
          The critic&apos;s read
        </CardTitle>
        <CardDescription className="text-sm leading-7">
          Long-form interpretation appears before the evidence rubric so the
          page still reads like criticism rather than a dashboard.
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

export function EvidenceAndRubric({ state }: { state: ReviewState }) {
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
              Scores arrive after the prose so the review keeps its editorial
              center.
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

export function LoadingCard({ title, body }: { title: string; body: string }) {
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

export function LyricsIntelligenceSection({
  intelligence,
}: {
  intelligence: LyricsIntelligence | null | undefined;
}) {
  if (!intelligence) return null;
  return <LyricsIntelligencePanel intelligence={intelligence} />;
}

export function LyricsUploader({ onLyrics, activeLyrics }: LyricsUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  async function handleFile(file: File) {
    setError('');

    if (!file.name.endsWith('.txt') && file.type !== 'text/plain') {
      setError('Only .txt files are supported.');
      return;
    }

    if (file.size > 64 * 1024) {
      setError('File is too large. Max 64 KB.');
      return;
    }

    const text = await file.text();
    const trimmed = text.trim();

    if (!trimmed) {
      setError('The file appears to be empty.');
      return;
    }

    setFileName(file.name);
    onLyrics(trimmed);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function clear() {
    setFileName(null);
    setError('');
    onLyrics(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="rounded-[1.75rem] border border-border/70 bg-card/80 p-5">
      <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
        Supply lyrics
      </p>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        If this track isn&apos;t in our lyrics database, upload a{' '}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">.txt</code> file
        with the lyrics. User-supplied lyrics take priority over all other sources.
      </p>

      {fileName ? (
        /* Loaded state */
        <div className="mt-4 flex items-center justify-between gap-3 rounded-[1.25rem] border border-border/70 bg-background/80 px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="size-4 shrink-0 text-(--color-accent-strong)" />
            <span className="truncate text-sm font-medium text-foreground">
              {fileName}
            </span>
            {activeLyrics && (
              <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                Active
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={clear}
            className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Remove lyrics file"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        /* Drop zone */
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="mt-4 flex flex-col items-center gap-3 rounded-[1.25rem] border border-dashed border-border bg-background/60 px-4 py-6 text-center transition hover:border-foreground/20 hover:bg-background/80"
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Upload className="size-4" />
          </div>
          <div>
            <p className="text-sm text-foreground">
              Drop a <code className="rounded bg-muted px-1 py-0.5 text-xs">.txt</code> file here
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">or</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer rounded-full px-4"
            onClick={() => inputRef.current?.click()}
          >
            Browse file
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,text/plain"
            className="sr-only"
            onChange={handleChange}
          />
        </div>
      )}

      {error && (
        <p className="mt-2 px-1 text-sm font-medium text-destructive">{error}</p>
      )}
    </div>
  );
}
