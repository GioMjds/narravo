import Link from 'next/link';
import { ArrowRight, BookOpenText, Disc3, ShieldCheck } from 'lucide-react';
import { demoLinks } from '@/lib/narravo-review';

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <section className="rounded-[2rem] border border-border/70 bg-card/90 p-8 shadow-[0_24px_80px_-52px_rgba(40,28,21,0.45)]">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          About Narravo
        </p>
        <h1 className="mt-4 max-w-3xl font-heading text-5xl leading-none font-semibold tracking-tight text-foreground">
          Narravo is an editorial song reviewer built around meaning, not hype.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          The product goal is simple: take a supported song link and return a
          grounded answer to the question &quot;what is this song about?&quot; The
          review should read like criticism, but it should also show the evidence
          that supported the reading.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <article className="rounded-[1.75rem] border border-border/70 bg-card/85 p-6">
          <div className="flex size-11 items-center justify-center rounded-full bg-accent-soft/20 text-(--color-accent-strong)">
            <Disc3 className="size-5" />
          </div>
          <h2 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-foreground">
            Supported links
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Narravo currently accepts Spotify track links and YouTube Music track
            links. Standard YouTube video links are out of scope for this MVP.
          </p>
        </article>
        <article className="rounded-[1.75rem] border border-border/70 bg-card/85 p-6">
          <div className="flex size-11 items-center justify-center rounded-full bg-accent-soft/20 text-(--color-accent-strong)">
            <BookOpenText className="size-5" />
          </div>
          <h2 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-foreground">
            What the AI uses
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Narravo separates resolved facts, lyrical themes, emotional cues, and
            tonal atmosphere from the interpretation layer. If context is missing,
            the page should say so explicitly.
          </p>
        </article>
        <article className="rounded-[1.75rem] border border-border/70 bg-card/85 p-6">
          <div className="flex size-11 items-center justify-center rounded-full bg-accent-soft/20 text-(--color-accent-strong)">
            <ShieldCheck className="size-5" />
          </div>
          <h2 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-foreground">
            What it should not do
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Narravo should not bluff certainty, fabricate evidence, or pretend a
            song was fully understood when the available context is weak.
          </p>
        </article>
      </section>

      <section className="grid gap-6 rounded-[2rem] border border-border/70 bg-card/90 p-8 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Credibility notes
          </p>
          <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
            <p>
              Narravo is trying to behave more like a careful critic than a generic
              chatbot. That means the page structure matters: metadata first,
              interpretation second, evidence third, rubric last.
            </p>
            <p>
              In this MVP, the UI flow is fully implemented but live song
              resolution is still limited. Curated demo links are provided so the
              full streaming and evidence experience can be tested without
              pretending arbitrary tracks are already grounded.
            </p>
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-5">
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Demo links
          </p>
          <div className="mt-4 space-y-3">
            {demoLinks.map((example) => (
              <Link
                key={example.href}
                href={`/review?url=${encodeURIComponent(example.href)}`}
                className="flex items-center justify-between gap-3 rounded-[1rem] border border-border/70 px-4 py-3 text-sm text-foreground transition hover:border-foreground/20 hover:bg-card"
              >
                <span>{example.label}</span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
