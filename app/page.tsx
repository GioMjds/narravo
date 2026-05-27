import Link from 'next/link';
import { Headphones, Sparkles, Waves } from 'lucide-react';
import { UrlSubmissionForm } from '@/components/narravo/url-submission-form';
import { demoLinks } from '@/lib/narravo-review';

export default function Home() {
  return (
    <main className="relative flex-1 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(173,83,47,0.16),transparent_60%)]" />
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 py-10 sm:px-6 lg:px-8 lg:py-18">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase backdrop-blur">
              <Headphones className="size-3.5" />
              Editorial music journal
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl font-heading text-5xl leading-none font-semibold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
                What is this song really saying?
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                Paste a Spotify or YouTube Music link and Narravo turns the track
                into a grounded critic&apos;s note: themes, emotional cues, sonic
                atmosphere, and a meaning-first review built from visible evidence.
              </p>
            </div>
            <UrlSubmissionForm
              className="max-w-2xl"
              showExamples
              autoFocus
            />
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
              Narravo is designed to separate facts, evidence, and interpretation.
              If lyrical context is unavailable, the review should say so instead
              of pretending certainty.
            </p>
          </div>

          <div className="grid gap-4">
            <article className="rounded-[2rem] border border-border/70 bg-card/90 p-6 shadow-[0_24px_80px_-48px_rgba(40,28,21,0.5)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                  Streaming review flow
                </span>
                <Sparkles className="size-4 text-(--color-accent-strong)" />
              </div>
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-[96px_1fr] gap-4">
                  <div className="aspect-square rounded-[1.5rem] bg-[linear-gradient(140deg,#4f2d24,#b56244_55%,#f3d5be)]" />
                  <div className="space-y-3 pt-2">
                    <div className="h-3.5 w-2/3 rounded-full bg-foreground/12" />
                    <div className="h-3.5 w-1/2 rounded-full bg-foreground/10" />
                    <div className="h-3.5 w-5/6 rounded-full bg-foreground/8" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-3 w-full rounded-full bg-foreground/10" />
                  <div className="h-3 w-[94%] rounded-full bg-foreground/10" />
                  <div className="h-3 w-[88%] rounded-full bg-foreground/10" />
                  <div className="h-3 w-[73%] rounded-full bg-foreground/10" />
                </div>
              </div>
            </article>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.75rem] border border-border/70 bg-card/85 p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Waves className="size-4 text-(--color-accent-strong)" />
                  Lyrical themes
                </div>
                <p className="text-sm leading-7 text-muted-foreground">
                  The review should name the emotional center, not just summarize
                  the plot.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-border/70 bg-card/85 p-5">
                <div className="mb-3 text-sm font-medium text-foreground">
                  Emotional cues
                </div>
                <p className="text-sm leading-7 text-muted-foreground">
                  Tone, restraint, tension, and release are surfaced explicitly in
                  the evidence layer.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-border/70 bg-card/85 p-5">
                <div className="mb-3 text-sm font-medium text-foreground">
                  Meaning-first rubric
                </div>
                <p className="text-sm leading-7 text-muted-foreground">
                  Theme clarity, lyrical depth, atmosphere, and replay pull arrive
                  after the prose is grounded.
                </p>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-6 rounded-[2rem] border border-border/70 bg-card/70 p-6 md:grid-cols-[1fr_auto] md:items-end lg:p-8">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
              Demo links
            </p>
            <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-foreground">
              Use the curated demos to preview the full review experience.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
              The page flow is fully implemented. Live resolver coverage is still
              limited, so these demo links are the fastest way to verify the
              evidence, streaming, and rubric states end to end.
            </p>
          </div>
          <Link
            href="/about"
            className="inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-medium text-foreground transition hover:bg-foreground hover:text-background"
          >
            Read the trust notes
          </Link>
          <div className="grid gap-3 md:col-span-2 lg:grid-cols-2">
            {demoLinks.map((example) => (
              <Link
                key={example.href}
                href={`/review?url=${encodeURIComponent(example.href)}`}
                className="group rounded-[1.5rem] border border-border/70 bg-background/80 p-4 transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_16px_36px_-28px_rgba(40,28,21,0.45)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {example.label}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {example.description}
                    </p>
                  </div>
                  <span className="rounded-full border border-border/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                    {example.platformLabel}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
