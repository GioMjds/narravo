import { requireModelAdapter } from './model-registry';
import {
  buildSpecialistPrompt,
  buildLyricsSpecialistPrompt,
} from './specialist-prompt-builder';
import { parseSpecialistOutput } from './specialist-output-parser';
import type {
  RankedEvidencePacket,
  SpecialistAnalysisPacket,
  SpecialistOutput,
} from './types';

export type SpecialistRunResult =
  | { ok: true; packet: SpecialistAnalysisPacket }
  | { ok: false; reason: string };

// Required text specialists. Audio analysis is intentionally absent in v1
// (the role exists in the registry but the pipeline does not invoke it).
const REQUIRED_ROLES: Array<{
  role: SpecialistOutput['role'];
  includeLyrics: boolean;
}> = [
  { role: 'themeAnalyst', includeLyrics: true },
  { role: 'emotionAnalyst', includeLyrics: true },
  { role: 'narrativeAnalyst', includeLyrics: true },
  { role: 'classifier', includeLyrics: true },
  { role: 'sentimentAnalyst', includeLyrics: true },
];

export async function runSpecialists(
  packet: RankedEvidencePacket,
): Promise<SpecialistRunResult> {
  const hasLyrics = packet.lyricLines.length > 0;

  const specialistRuns = REQUIRED_ROLES.map(async (spec) => {
    const adapter = requireModelAdapter(spec.role);
    const { systemInstruction, userPrompt } = buildSpecialistPrompt(
      spec.role,
      packet,
      {
        includeLyrics: spec.includeLyrics,
      },
    );

    const result = await adapter.generate({ systemInstruction, userPrompt });
    if (!result.ok) {
      return {
        ok: false as const,
        role: spec.role,
        reason: `${spec.role} generation failed: ${result.error.message}`,
      };
    }

    const parsed = parseSpecialistOutput(result.text, spec.role, packet);
    if (!parsed.ok) {
      return {
        ok: false as const,
        role: spec.role,
        reason: `${spec.role} parser rejected output: ${parsed.reason}`,
      };
    }

    return { ok: true as const, output: parsed.output };
  });

  // Lyrics specialist only runs when we have lyrics to annotate.
  if (hasLyrics) {
    specialistRuns.push(
      (async () => {
        const adapter = requireModelAdapter('lyricsSpecialist');
        const { systemInstruction, userPrompt } =
          buildLyricsSpecialistPrompt(packet);
        const result = await adapter.generate({
          systemInstruction,
          userPrompt,
        });
        if (!result.ok) {
          return {
            ok: false as const,
            role: 'lyricsSpecialist' as const,
            reason: `lyricsSpecialist generation failed: ${result.error.message}`,
          };
        }
        const parsed = parseSpecialistOutput(
          result.text,
          'lyricsSpecialist',
          packet,
        );
        if (!parsed.ok) {
          return {
            ok: false as const,
            role: 'lyricsSpecialist' as const,
            reason: `lyricsSpecialist parser rejected output: ${parsed.reason}`,
          };
        }
        return { ok: true as const, output: parsed.output };
      })(),
    );
  }

  const results = await Promise.all(specialistRuns);

  const byRole = new Map<SpecialistOutput['role'], SpecialistOutput>();
  for (const r of results) {
    if (!r.ok) {
      return { ok: false, reason: r.reason };
    }
    byRole.set(r.output.role, r.output);
  }

  const theme = byRole.get('themeAnalyst');
  const emotion = byRole.get('emotionAnalyst');
  const narrative = byRole.get('narrativeAnalyst');
  const classification = byRole.get('classifier');
  const sentiment = byRole.get('sentimentAnalyst');

  if (!theme || !emotion || !narrative || !classification || !sentiment) {
    return {
      ok: false,
      reason: 'One or more required specialists did not run',
    };
  }

  return {
    ok: true,
    packet: {
      theme,
      emotion,
      narrative,
      classification,
      sentiment,
      lyrics: byRole.get('lyricsSpecialist') ?? null,
    },
  };
}
