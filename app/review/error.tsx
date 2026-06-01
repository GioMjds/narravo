'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ArrowLeft, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ReviewErrorPageProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function ReviewErrorPage({
  error,
  unstable_retry,
}: ReviewErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-16 sm:px-6">
      <div className="w-full">
        {/* Ambient glow behind the card */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive/8 blur-3xl" />

        <div className="rounded-[2rem] border border-destructive/25 bg-card/95 shadow-[0_32px_80px_-40px_rgba(40,28,21,0.4),0_0_0_1px_rgba(220,80,60,0.08)]">
          {/* Header band */}
          <div className="flex items-start gap-4 border-b border-destructive/15 p-8 pb-6">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/20">
              <TriangleAlert className="size-5 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-[0.18em] text-destructive/70 uppercase">
                Runtime fault
              </p>
              <h1 className="mt-1.5 font-heading text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
                The review route hit an unexpected error
              </h1>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-5 p-8 pt-6">
            <p className="text-sm leading-7 text-muted-foreground">
              Narravo keeps expected product failures — unsupported links,
              missing lyrics, low-confidence context — inside the normal review
              states. This screen is only shown for runtime errors that fall
              outside that handled surface.
            </p>

            {/* Fault detail box */}
            {error.message && (
              <div className="rounded-[1.25rem] border border-border/60 bg-muted/40 px-4 py-3">
                <p className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                  Fault detail
                </p>
                <p className="mt-2 font-mono text-xs leading-6 text-foreground/80 break-all">
                  {error.message}
                </p>
                {error.digest && (
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    digest: {error.digest}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-[1.25rem] border border-border/60 bg-background/60 px-4 py-3">
              <p className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                What to do
              </p>
              <p className="mt-2 text-sm leading-7 text-foreground">
                A retry usually resolves transient faults. If this persists on
                the same song link, try a different track or use one of the
                curated demo links to verify the pipeline is healthy.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                type="button"
                size="lg"
                className="cursor-pointer rounded-full px-6"
                onClick={() => unstable_retry()}
              >
                <RefreshCw className="size-4" />
                Retry the review
              </Button>
              <Button
                asChild
                type="button"
                size="lg"
                variant="outline"
                className="cursor-pointer rounded-full px-6"
              >
                <Link href="/">
                  <ArrowLeft className="size-4" />
                  Back to home
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
