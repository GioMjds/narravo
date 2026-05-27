import { type NextRequest, NextResponse } from 'next/server';
import { runReviewPipeline } from '@/lib/pipeline/review-stream-orchestrator';
import {
  validateNarravoUrlInput,
  type NarravoReviewStreamEvent,
} from '@/lib/narravo-review';

export async function POST(req: NextRequest) {
  let url: string;

  try {
    const body = (await req.json()) as { url?: string };
    url = body.url?.trim() ?? '';
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'resolve_failure',
          status: 400,
          title: 'Invalid request body',
          message: 'The request body could not be parsed as JSON.',
          hint: 'Send a JSON body with a url field.',
        },
      },
      { status: 400 },
    );
  }

  // Validate before touching the pipeline
  const validation = validateNarravoUrlInput(url);
  if (!validation.ok) {
    return NextResponse.json(
      {
        error: {
          code: 'unsupported_platform',
          status: 400,
          title: 'Unsupported music link',
          message: validation.message,
          hint: 'Paste a Spotify track URL or a YouTube Music track URL.',
        },
      },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let metadataEmitted = false;
      const pushEvent = (event: NarravoReviewStreamEvent) => {
        if (event.type === 'metadata') metadataEmitted = true;
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        const result = await runReviewPipeline(url, pushEvent);

        if (!result.ok) {
          if (!metadataEmitted) {
            controller.error(new Error(result.error.message));
            return;
          }
          pushEvent({
            type: 'complete',
            result: {
              reviewText: result.error.message,
              evidence: [],
              scores: [],
              tags: [],
              takeaway: result.error.hint,
              confidence: {
                label: 'Low confidence',
                note: result.error.title,
              },
            },
          });
        }
      } catch (error) {
        // Unexpected runtime fault — not a product error.
        // Do not try to push another event here; just close the stream and let
        // the route-boundary catch handle the response if the stream hasn't
        // started. If it has, the client will hit the broken-stream path and
        // show the ReviewErrorPage boundary.
        controller.error(error);
        return;
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
