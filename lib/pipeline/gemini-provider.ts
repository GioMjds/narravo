import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  registerModelAdapter,
  resolveModelIdForRole,
  type EmbedRequest,
  type EmbedResult,
  type GenerateRequest,
  type GenerateResult,
  type ModelAdapter,
  type ModelRole,
  type StreamRequest,
  type StreamResult,
} from './model-registry';
import type { PipelineError } from './types';

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAI) genAI = new GoogleGenerativeAI(apiKey);
  return genAI;
}

function missingKeyError(): PipelineError {
  return {
    code: 'resolve_failure',
    message: 'Gemini API key not configured',
  };
}

// Gemini-backed adapter for generation, streaming, and embedding. Other
// providers (Claude, etc.) should follow the same ModelAdapter shape and
// be registered per role via the model registry.
export function createGeminiAdapter(role: ModelRole): ModelAdapter {
  const modelId = resolveModelIdForRole(role);

  return {
    async generate(request: GenerateRequest): Promise<GenerateResult> {
      const client = getClient();
      if (!client) {
        return { ok: false, error: missingKeyError() };
      }

      try {
        const model = client.getGenerativeModel({
          model: modelId,
          systemInstruction: request.systemInstruction,
        });
        const result = await model.generateContent(request.userPrompt);
        const text = result.response.text();
        return { ok: true, text };
      } catch (err) {
        return {
          ok: false,
          error: {
            code: 'resolve_failure',
            message: err instanceof Error ? err.message : 'Gemini generate failed',
          },
        };
      }
    },

    async stream(request: StreamRequest): Promise<StreamResult> {
      const client = getClient();
      if (!client) {
        async function* failing(): AsyncIterable<string> {
          throw new Error('Gemini API key not configured');
        }
        return { iterator: failing() };
      }

      const model = client.getGenerativeModel({
        model: modelId,
        systemInstruction: request.systemInstruction,
      });
      const result = await model.generateContentStream(request.userPrompt);

      async function* streamChunks(): AsyncIterable<string> {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) yield text;
        }
      }

      return { iterator: streamChunks() };
    },

    async embed(request: EmbedRequest): Promise<EmbedResult> {
      const client = getClient();
      if (!client) {
        return { ok: false, error: missingKeyError() };
      }

      try {
        const model = client.getGenerativeModel({ model: modelId });
        const vectors: number[][] = [];
        for (const input of request.inputs) {
          const result = await model.embedContent(input);
          const values = result.embedding?.values;
          if (!values) {
            return {
              ok: false,
              error: {
                code: 'resolve_failure',
                message: 'Gemini embed returned no values',
              },
            };
          }
          vectors.push(values);
        }
        return { ok: true, vectors };
      } catch (err) {
        return {
          ok: false,
          error: {
            code: 'resolve_failure',
            message: err instanceof Error ? err.message : 'Gemini embed failed',
          },
        };
      }
    },
  };
}

// Register all roles with Gemini-backed adapters. The reviewer remains
// the same generation model as the rest of the pipeline; future provider
// overrides happen through configureModelRegistry + registerModelAdapter.
export function registerDefaultGeminiAdapters(): void {
  const roles: ModelRole[] = [
    'reviewer',
    'themeAnalyst',
    'emotionAnalyst',
    'narrativeAnalyst',
    'classifier',
    'sentimentAnalyst',
    'lyricsSpecialist',
    'audioAnalyst',
    'evidenceEmbedder',
  ];

  for (const role of roles) {
    registerModelAdapter(role, createGeminiAdapter(role));
  }
}
