import type { NormalizedMetadata, PromptTemplateKey } from "./types";

export function routeTemplate(metadata: NormalizedMetadata): PromptTemplateKey {
  return metadata.contentType; // track, ep-single, album, or playlist
}