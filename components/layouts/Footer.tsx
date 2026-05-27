import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border/70 bg-background/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>
          Narravo is a grounded-review MVP for songs. Facts, evidence, and
          interpretation should stay visibly separate.
        </p>
        <div className="flex items-center gap-4">
          <Link href="/about" className="transition hover:text-foreground">
            About
          </Link>
          <span>&copy; 2026 Narravo</span>
        </div>
      </div>
    </footer>
  );
}
