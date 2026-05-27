'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { ArrowRight, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { demoLinks, validateNarravoUrlInput } from '@/lib/narravo-review';

type UrlSubmissionFormProps = {
  defaultValue?: string;
  compact?: boolean;
  showExamples?: boolean;
  autoFocus?: boolean;
  className?: string;
};

export function UrlSubmissionForm({
  defaultValue = '',
  compact = false,
  showExamples = false,
  autoFocus = false,
  className,
}: UrlSubmissionFormProps) {
  const router = useRouter();
  const fieldId = useId();
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState('');
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
          Narravo only supports Spotify and YouTube Music track URLs for this MVP.
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
