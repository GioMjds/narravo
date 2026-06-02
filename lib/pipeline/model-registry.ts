// Model registry: role-based lookup of generation / streaming / embedding
// adapters. The first implementation wires every role to Gemini-backed
// adapters; future providers plug in here without business-logic branching.

import type { PipelineError } from './types';

export type ModelRole =
  | 'reviewer'
  | 'evidenceEmbedder'
  | 'themeAnalyst'
  | 'emotionAnalyst'
  | 'narrativeAnalyst'
  | 'classifier'
  | 'sentimentAnalyst'
  | 'lyricsSpecialist'
  | 'audioAnalyst';

export type ModelCapability = 'generate' | 'stream' | 'embed';

export type GenerateRequest = {
  systemInstruction: string;
  userPrompt: string;
  // Output must be one of: text, json, xml
  outputShape?: 'text' | 'json' | 'xml';
};

export type StreamRequest = {
  systemInstruction: string;
  userPrompt: string;
};

export type EmbedRequest = {
  inputs: string[];
};

export type GenerateResult =
  | { ok: true; text: string }
  | { ok: false; error: PipelineError };

export type StreamResult = {
  // Streaming returns an async iterator of text chunks. Errors surface as
  // a failed final result via the consumer.
  iterator: AsyncIterable<string>;
};

export type EmbedResult =
  | { ok: true; vectors: number[][] }
  | { ok: false; error: PipelineError };

export type ModelAdapter = {
  generate(request: GenerateRequest): Promise<GenerateResult>;
  stream(request: StreamRequest): Promise<StreamResult>;
  embed?(request: EmbedRequest): Promise<EmbedResult>;
};

// Per-role model ID overrides. Defaults below are applied when a role is
// not explicitly configured. Env variable name: NARRAVO_MODEL_<ROLE>.
function envKey(role: ModelRole): string {
  return `NARRAVO_MODEL_${role.replace(/[A-Z]/g, (m) => `_${m.toUpperCase()}`)}`;
}

const DEFAULT_GENERATION_MODEL = 'gemini-2.5-flash';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-004';

const DEFAULT_ROLE_MODEL_IDS: Record<ModelRole, string> = {
  reviewer: DEFAULT_GENERATION_MODEL,
  evidenceEmbedder: DEFAULT_EMBEDDING_MODEL,
  themeAnalyst: DEFAULT_GENERATION_MODEL,
  emotionAnalyst: DEFAULT_GENERATION_MODEL,
  narrativeAnalyst: DEFAULT_GENERATION_MODEL,
  classifier: DEFAULT_GENERATION_MODEL,
  sentimentAnalyst: DEFAULT_GENERATION_MODEL,
  lyricsSpecialist: DEFAULT_GENERATION_MODEL,
  audioAnalyst: DEFAULT_GENERATION_MODEL,
};

export type ModelRegistryConfig = Partial<Record<ModelRole, string>>;

let activeConfig: ModelRegistryConfig = {};

export function configureModelRegistry(config: ModelRegistryConfig): void {
  activeConfig = { ...config };
}

export function resetModelRegistry(): void {
  activeConfig = {};
}

export function resolveModelIdForRole(role: ModelRole): string {
  const fromEnv = process.env[envKey(role)]?.trim();
  if (fromEnv) return fromEnv;
  return activeConfig[role] ?? DEFAULT_ROLE_MODEL_IDS[role];
}

// Adapter registry: each role maps to an adapter instance. The default
// implementation is the Gemini provider; tests or alternate providers can
// swap an adapter in without touching the rest of the pipeline.
const adapterRegistry = new Map<ModelRole, ModelAdapter>();

export function registerModelAdapter(role: ModelRole, adapter: ModelAdapter): void {
  adapterRegistry.set(role, adapter);
}

export function getModelAdapter(role: ModelRole): ModelAdapter | undefined {
  return adapterRegistry.get(role);
}

export function requireModelAdapter(role: ModelRole): ModelAdapter {
  const adapter = adapterRegistry.get(role);
  if (!adapter) {
    throw new Error(`No model adapter registered for role "${role}".`);
  }
  return adapter;
}
