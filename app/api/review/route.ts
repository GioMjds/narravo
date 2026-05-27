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
      const pushEvent = (event: NarravoReviewStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        const result = await runReviewPipeline(url, pushEvent);

        if (!result.ok) {
          // Pipeline failed after stream opened — the metadata event may or may
          // not have been emitted already. Encode the error as a recoverable
          // complete event so the existing ReviewExperience state machine can
          // handle it without a broken stream.
          //
          // The ReviewExperience client already handles recoverable errors from
          // the initial JSON response path. Here we need to decide: if metadata
          // was never emitted (resolver failed), close without events and let
          // the client fall through to the error state. If metadata was emitted
          // but generation failed, send a minimal complete event so the UI
          // doesn't hang in streaming-review state.
          //
          // The orchestrator emits metadata before generation starts, so a
          // pipeline failure after that point means the client is already in
          // streaming-review state. Emit a complete with empty result fields
          // so the state machine transitions cleanly. The ReviewErrorState panel
          // is separate from the complete event — this is a known gap in the
          // current UI contract. For MVP, the hint text in the complete payload
          // acts as the visible signal.
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
