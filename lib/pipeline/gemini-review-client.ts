import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GeminiPromptPlan, PipelineError } from './types';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

type GeminiResult =
  | { ok: true; fullText: string; proseParts: string[] }
  | { ok: false; error: PipelineError };

export async function streamFromGemini(
  plan: GeminiPromptPlan,
  onChunk: (text: string) => void,
): Promise<GeminiResult> {
  try {
    if (!genAI) {
      return {
        ok: false,
        error: {
          code: 'resolve_failure',
          message: 'Gemini API key not configured',
        },
      };
    }
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: plan.systemInstruction,
    });

    const result = await model.generateContentStream(plan.userPrompt);

    let fullText = '';
    let emittedLength = 0;
    const proseParts: string[] = [];
    let xmlStarted = false;

    for await (const chunk of result.stream) {
      const text = chunk.text();
      fullText += text;

      // Stop emitting chunks once XML tail begins
      if (!xmlStarted) {
        const xmlIndex = fullText.indexOf('<ReviewResult>');
        if (xmlIndex !== -1) {
          xmlStarted = true;
          const proseChunk = fullText.slice(emittedLength, xmlIndex);
          if (proseChunk.trim()) {
            proseParts.push(proseChunk);
            onChunk(proseChunk);
          }
        } else {
          const proseChunk = fullText.slice(emittedLength);
          if (proseChunk) {
            proseParts.push(proseChunk);
            onChunk(proseChunk);
            emittedLength = fullText.length;
          }
        }
      }
    }

    return { ok: true, fullText, proseParts };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'resolve_failure',
        message: err instanceof Error ? err.message : 'Gemini call failed',
      },
    };
  }
}
