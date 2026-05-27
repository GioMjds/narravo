import Link from 'next/link';
import ThemeToggle from '@/components/theme-switcher';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            Narravo
          </span>
          <span className="hidden text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase sm:inline">
            Song meaning review
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/about"
            className="rounded-full px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            About
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
