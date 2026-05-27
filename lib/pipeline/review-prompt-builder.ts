import type {
  GeminiPromptPlan,
  PromptTemplateKey,
  ReviewContextPacket,
} from './types';

const CONTENT_TYPE_INSTRUCTIONS: Record<PromptTemplateKey, string> = {
  track: `Focus on: lyrical meaning, emotional cues, sonic atmosphere. 
Provide a single-song interpretation. Ground every claim in the evidence provided.`,
  'ep-single': `Focus on: short-release cohesion, recurring motifs, release intent.
Treat the tracks as a unified statement.`,
  album: `Focus on: arc and sequencing, recurring themes, tonal continuity.
Trace the relationship between individual tracks and the overall statement.`,
  playlist: `Focus on: curation logic, mood coherence, transition quality, selection intent.
Interpret the playlist as a curatorial act, not a collection of unrelated songs.`,
};

const XML_CONTRACT = `
After the prose review, append a single XML block using this exact structure.
Do not omit any required tags. Do not add tags not listed here.

<ReviewResult>
  <Evidence>
    <Section title="[section name]">
      <Item>[evidence point]</Item>
      <Item>[evidence point]</Item>
    </Section>
    <!-- repeat Section as needed, min 2 sections -->
  </Evidence>
  <Scores>
    <Score label="Theme clarity" score="[0-100]" note="[one sentence]" />
    <Score label="Emotional impact" score="[0-100]" note="[one sentence]" />
    <Score label="Lyrical depth" score="[0-100]" note="[one sentence]" />
    <Score label="Sonic atmosphere" score="[0-100]" note="[one sentence]" />
    <Score label="Replay pull" score="[0-100]" note="[one sentence]" />
  </Scores>
  <Tags>[comma-separated tags, 4-6 items]</Tags>
  <Takeaway>[one sentence takeaway]</Takeaway>
  <Confidence label="[High confidence|Medium confidence|Low confidence]" note="[one sentence explaining why]" />
</ReviewResult>
`;

export function buildPrompt(
  templateKey: PromptTemplateKey,
  context: ReviewContextPacket,
): GeminiPromptPlan {
  const evidenceText = context.evidenceBlocks
    .map((b) => `### ${b.label}\n${b.text}`)
    .join('\n\n');

  const missingText =
    context.missingSignals.length > 0
      ? `Missing evidence: ${context.missingSignals.join(', ')}. Narrow your interpretation accordingly.`
      : '';

  const systemInstruction = `You are a careful music critic writing grounded editorial reviews.
      You must only use evidence provided in the user message.
      Do not fabricate lyrics, facts, or claims not supported by the evidence.
      If evidence is limited, say so explicitly in your review and confidence note.
      ${CONTENT_TYPE_INSTRUCTIONS[templateKey]}`;

  const userPrompt = `## Evidence\n\n${evidenceText}\n\n${missingText}

      Write a 3-paragraph critic-style prose review of "${context.metadata.title}" by "${context.metadata.artistName}".
      Stay grounded. Do not bluff certainty when evidence is thin.
      After the prose, append the XML block as instructed.
      
      ${XML_CONTRACT}`;

  return { systemInstruction, userPrompt };
}
