import { type NextRequest, NextResponse } from 'next/server';
import {
  resolveNarravoReview,
  wait,
  type NarravoReviewStreamEvent,
} from '@/lib/narravo-review';

export async function POST(req: NextRequest) {
  try {
    const { url } = (await req.json()) as { url?: string };
    const result = resolveNarravoReview(url ?? '');

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error.status },
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const pushEvent = (event: NarravoReviewStreamEvent) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        try {
          await wait(250);
          pushEvent({
            type: 'metadata',
            metadata: result.payload.metadata,
          });

          for (const chunk of result.payload.reviewChunks) {
            await wait(420);
            pushEvent({
              type: 'chunk',
              chunk,
            });
          }

          await wait(260);
          pushEvent({
            type: 'complete',
            result: result.payload.complete,
          });
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'resolve_failure',
          status: 500,
          title: 'Failed to create the review response',
          message:
            error instanceof Error
              ? error.message
              : 'An unexpected error interrupted review creation.',
          hint: 'Retry the request.',
        },
      },
      { status: 500 },
    );
  }
}
