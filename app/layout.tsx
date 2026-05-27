import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { cn } from '@/lib/utils';
import { Footer, Header } from '@/components/layouts';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

const cormorant = Cormorant_Garamond({
  variable: '--font-serif',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6efe5' },
    { media: '(prefers-color-scheme: dark)', color: '#171310' },
  ],
};

export const metadata: Metadata = {
  title: {
    default: 'Narravo',
    template: '%s | Narravo',
  },
  description:
    'Narravo turns supported song links into grounded critic-style reviews with visible evidence and a meaning-first rubric.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={cn(
        'h-full antialiased',
        inter.variable,
        cormorant.variable,
        jetbrainsMono.variable,
      )}
    >
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="relative flex min-h-dvh flex-col">
            <Header />
            {children}
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
