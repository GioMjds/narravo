import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GeminiPromptPlan, PipelineError } from './types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

type GeminiResult =
  | { ok: true; fullText: string; proseParts: string[] }
  | { ok: false; error: PipelineError };

export async function streamFromGemini(
  plan: GeminiPromptPlan,
  onChunk: (text: string) => void,
): Promise<GeminiResult> {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: plan.systemInstruction,
    });

    const result = await model.generateContentStream(plan.userPrompt);

    let fullText = '';
    const proseParts: string[] = [];
    let xmlStarted = false;

    for await (const chunk of result.stream) {
      const text = chunk.text();
      fullText += text;

      // Stop emitting chunks once XML tail begins
      if (!xmlStarted) {
        const xmlIndex = text.indexOf('<ReviewResult>');
        if (xmlIndex !== -1) {
          xmlStarted = true;
          const proseChunk = text.slice(0, xmlIndex);
          if (proseChunk.trim()) {
            proseParts.push(proseChunk);
            onChunk(proseChunk);
          }
        } else {
          proseParts.push(text);
          onChunk(text);
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
