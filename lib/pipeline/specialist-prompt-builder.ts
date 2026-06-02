import type { NormalizedMetadata, RankedEvidencePacket } from './types';
import { formatRankedEvidenceForPrompt } from './evidence-ranker';

const SPECIALIST_XML_CONTRACT = `
    Output a single compact XML block. Do not include any prose, only the XML.

    <Specialist role="[exact role string]">
      <Summary>[two or three short sentences — at most 60 words]</Summary>
      <Claims>
        <Claim refs="[comma-separated evidence refs]">[one short interpretive claim]</Claim>
        <!-- repeat Claim as needed, min 1 -->
      </Claims>
      <EvidenceRefs>
        <Ref>[evidence ref]</Ref>
        <!-- repeat Ref as needed -->
      </EvidenceRefs>
      <Confidence>[high|medium|low]</Confidence>
      <!-- optional, only if the evidence is too thin to support a claim -->
      <RefusalReason>[one short reason]</RefusalReason>
    </Specialist>

    Rules:
    - Cite ONLY evidence refs that appear in the numbered evidence list above.
    - Do not invent facts, lyrics, lines, sections, or refs.
    - If the available evidence cannot support a claim, set Confidence="low" and
      include a RefusalReason instead of guessing.
    `;

function buildBasePrompt(
  packet: RankedEvidencePacket,
  options: { includeLyrics: boolean },
): string {
  const evidenceText = formatRankedEvidenceForPrompt(packet, options);
  const missingText =
    packet.missingSignals.length > 0
      ? `\nMissing signals: ${packet.missingSignals.join(', ')}.`
      : '';

  return `## Subject
    Title: ${packet.metadata.title}
    Artist: ${packet.metadata.artistName}
    ${packet.metadata.albumOrCollectionTitle ? `Release: ${packet.metadata.albumOrCollectionTitle}` : ''}
    Content type: ${packet.metadata.contentType}
    ${missingText}

    ## Numbered Evidence
    ${evidenceText}
    `;
}

const ROLE_GUIDANCE = {
  themeAnalyst: `You are the theme analyst. Identify the dominant themes that the available evidence supports. Themes should be interpretive labels (for example: "grief", "escape", "renewal") tied to the specific evidence that grounds them. Do not invent themes that the evidence does not support.`,
  emotionAnalyst: `You are the emotion analyst. Identify the affective stFates present in the evidence (for example: grief, longing, anger, release, tenderness, resignation). Distinguish emotion from sentiment: emotion names a felt state, sentiment describes polarity and intensity.`,
  narrativeAnalyst: `You are the narrative analyst. Describe any narrative arc, speaker position, or story-shaped structure supported by the evidence. If no narrative is supported by the evidence, say so in your RefusalReason rather than inventing one.`,
  classifier: `You are the song classifier. Provide a short classification across 2-4 dimensions (for example: genre, mood, lyrical register, sonic register). Each label must cite evidence. Do not introduce classifications the evidence does not support.`,
  sentimentAnalyst: `You are the sentiment analyst. Describe the overall valence (positive / negative / mixed), the intensity, and how sentiment moves across the available evidence. Sentiment is distinct from emotion; it focuses on polarity and intensity, not affective labels.`,
  lyricsSpecialist: `You are the lyrics specialist. Annotate the supplied lyric sections and lines using the exact line refs (e.g. L001) and section refs (e.g. S001) provided. Do not invent lines or sections. If a line is too ambiguous, prefer a low-confidence annotation or skip it.`,
} satisfies Record<string, string>;

export type SpecialistRole = keyof typeof ROLE_GUIDANCE;

export function buildSpecialistPrompt(
  role: SpecialistRole,
  packet: RankedEvidencePacket,
  options: { includeLyrics: boolean },
): { systemInstruction: string; userPrompt: string } {
  const includeLyrics = options.includeLyrics;
  const systemInstruction = `${ROLE_GUIDANCE[role]} Stay strictly within the supplied evidence. Do not introduce outside knowledge.`;

  const userPrompt = `${buildBasePrompt(packet, { includeLyrics })}

  ${SPECIALIST_XML_CONTRACT.replace('[exact role string]', role)}`;

  return { systemInstruction, userPrompt };
}

export function buildLyricsSpecialistPrompt(packet: RankedEvidencePacket): {
  systemInstruction: string;
  userPrompt: string;
} {
  if (packet.lyricLines.length === 0) {
    return {
      systemInstruction:
        'You are the lyrics specialist. Lyrics are unavailable for this request.',
      userPrompt: '',
    };
  }
  return buildSpecialistPrompt('lyricsSpecialist', packet, {
    includeLyrics: true,
  });
}

export type { NormalizedMetadata };