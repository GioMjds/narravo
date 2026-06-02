'use client';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type {
  LyricsIntelligence,
  LyricsSection,
  LyricsConfidence,
} from '@/lib/narravo-review';
import { cn } from '@/lib/utils';

function ConfidenceBadge({ confidence }: { confidence: LyricsConfidence }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase',
        confidence === 'confident' &&
          'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
        confidence === 'plausible' &&
          'border-amber-500/40 text-amber-600 dark:text-amber-400',
        confidence === 'speculative' &&
          'border-muted-foreground/40 text-muted-foreground',
      )}
    >
      {confidence}
    </Badge>
  );
}

function LyricsSectionCard({ section }: { section: LyricsSection }) {
  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-5">
      {/* Section header */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="font-heading text-base font-semibold text-foreground">
          {section.label}
        </span>
        <Badge
          variant="secondary"
          className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]"
        >
          {section.type}
        </Badge>
        <ConfidenceBadge confidence={section.confidence} />
      </div>

      {/* Section meta row */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {section.emotion && (
          <div>
            <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Emotion
            </p>
            <p className="mt-1 text-sm text-foreground">{section.emotion}</p>
          </div>
        )}
        {section.speakerTarget && section.speakerTarget !== 'unknown' && (
          <div>
            <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Speaker target
            </p>
            <p className="mt-1 text-sm text-foreground">
              {section.speakerTarget}
            </p>
          </div>
        )}
      </div>

      {/* Interpretations */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {section.literalInterpretation && (
          <div className="rounded-[1rem] border border-border/60 bg-card/60 p-3">
            <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Literal
            </p>
            <p className="mt-1.5 text-sm leading-6 text-foreground">
              {section.literalInterpretation}
            </p>
          </div>
        )}
        {section.symbolicInterpretation && (
          <div className="rounded-[1rem] border border-border/60 bg-card/60 p-3">
            <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Symbolic
            </p>
            <p className="mt-1.5 text-sm leading-6 text-foreground">
              {section.symbolicInterpretation}
            </p>
          </div>
        )}
      </div>

      {/* Themes + figurative + references */}
      {(section.themes.length > 0 ||
        section.figurativeLanguage ||
        section.references) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {section.themes.map((t) => (
            <Badge
              key={t}
              variant="outline"
              className="rounded-full px-2 py-0.5 text-xs"
            >
              {t}
            </Badge>
          ))}
          {section.figurativeLanguage && (
            <span className="rounded-full border border-dashed border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
              {section.figurativeLanguage}
            </span>
          )}
          {section.references && (
            <span className="rounded-full border border-dashed border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
              ↗ {section.references}
            </span>
          )}
        </div>
      )}

      {/* Line annotations */}
      {section.lines.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Line annotations
          </p>
          {section.lines.map((line) => (
            <div
              key={line.lineId}
              className="grid grid-cols-[1fr_auto] gap-3 rounded-[0.85rem] border border-border/50 bg-background/60 px-3 py-2.5"
            >
              <div>
                <p className="font-serif text-sm leading-6 text-foreground">
                  {line.text}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {line.annotation}
                </p>
              </div>
              <ConfidenceBadge confidence={line.confidence} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LyricsIntelligencePanel({
  intelligence,
}: {
  intelligence: LyricsIntelligence;
}) {
  return (
    <Card className="rounded-[2rem] border border-border/70 bg-card/90 py-0 shadow-[0_24px_80px_-52px_rgba(40,28,21,0.45)]">
      <CardHeader className="border-b border-border/70 py-5">
        <CardTitle className="font-heading text-3xl font-semibold tracking-tight">
          Lyrics intelligence
        </CardTitle>
        <CardDescription className="text-sm leading-7">
          Line-by-line annotation, section structure, and interpretive readings
          derived from the lyric text. Confidence labels distinguish strong
          signals from speculation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 py-6">
        {/* Overall themes */}
        {intelligence.overallThemes.length > 0 && (
          <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
            <p className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
              Overall themes
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {intelligence.overallThemes.map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="rounded-full px-3 py-1"
                >
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Confidence legend */}
        <div className="flex flex-wrap items-center gap-3 px-1 text-xs text-muted-foreground">
          <span>Confidence:</span>
          <ConfidenceBadge confidence="confident" />
          <ConfidenceBadge confidence="plausible" />
          <ConfidenceBadge confidence="speculative" />
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {intelligence.sections.map((section) => (
            <LyricsSectionCard key={section.sectionId} section={section} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
