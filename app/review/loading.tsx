import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function LoadingCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="rounded-[2rem] border border-border/70 bg-card/90 py-0 shadow-[0_24px_80px_-52px_rgba(40,28,21,0.45)]">
      <CardHeader className="border-b border-border/70 py-5">
        <CardTitle className="font-heading text-3xl font-semibold tracking-tight">
          {title}
        </CardTitle>
        <CardDescription className="text-sm leading-7">{body}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 py-6">
        <div className="h-20 animate-pulse rounded-[1.5rem] bg-muted/70" />
        <div className="h-20 animate-pulse rounded-[1.5rem] bg-muted/70" />
        <div className="h-20 animate-pulse rounded-[1.5rem] bg-muted/70" />
      </CardContent>
    </Card>
  );
}
