'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
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
      <div className="w-full rounded-[2rem] border border-destructive/30 bg-card p-8 shadow-[0_24px_80px_-52px_rgba(40,28,21,0.35)]">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" />
        </div>
        <h1 className="mt-5 font-heading text-4xl font-semibold tracking-tight text-foreground">
          The review page hit an unexpected fault
        </h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          Narravo keeps expected product failures inside the normal review states.
          This screen is reserved for runtime errors that need a fresh attempt.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            type="button"
            size="lg"
            className="cursor-pointer rounded-full px-5"
            onClick={() => unstable_retry()}
          >
            Retry the review route
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
      </div>
    </main>
  );
}
