import { ReviewExperience } from '@/components/narravo/review-experience';

type ReviewPageProps = {
  searchParams: Promise<{
    url?: string | string[];
  }>;
};

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = await searchParams;
  const initialUrl = Array.isArray(params.url)
    ? params.url[0] ?? ''
    : params.url ?? '';

  return <ReviewExperience key={initialUrl} initialUrl={initialUrl} />;
}
