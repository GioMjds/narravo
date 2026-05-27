import Link from 'next/link';
import { ArrowLeft, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-16 sm:px-6">
      <div className="w-full rounded-[2rem] border border-border/70 bg-card/90 p-8 text-center shadow-[0_24px_80px_-52px_rgba(40,28,21,0.45)]">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <SearchX className="size-5" />
        </div>
        <h1 className="mt-5 font-heading text-5xl font-semibold tracking-tight text-foreground">
          Page not found
        </h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          That route does not exist in Narravo. If you were trying to review a
          song, return home and paste a Spotify or YouTube Music track link.
        </p>
        <Button
          asChild
          size="lg"
          className="mt-8 cursor-pointer rounded-full px-5"
        >
          <Link href="/">
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
        </Button>
      </div>
    </main>
  );
}
