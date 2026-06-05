import { buildLyricContextText } from './lyrics-normalizer';
import type {
  GeminiPromptPlan,
  PromptTemplateKey,
  ReviewContextPacket,
  SpecialistAnalysisPacket,
} from './types';
import type { RankedEvidencePacket } from './types';

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

function buildLyricsXmlContract(lyricContextText: string): string {
  return `
After the <ReviewResult> XML block, if the content is a track with lyrics, append a second XML block using this exact structure. Do not omit required tags. Do not invent lines not present in the lyric context.

LYRIC CONTEXT (use ONLY these lines):
${lyricContextText}

<LyricsIntelligence>
  <OverallThemes>[comma-separated overall themes]</OverallThemes>
  <Sections>
    <Section id="[sectionId from context]" type="[verse|chorus|bridge|intro|outro|pre-chorus|hook|other]" label="[e.g. Verse 1]" confidence="[confident|plausible|speculative]">
      <Themes>[comma-separated themes]</Themes>
      <Emotion>[one or two words]</Emotion>
      <FigurativeLanguage>[note or "none"]</FigurativeLanguage>
      <References>[note or "none"]</References>
      <SpeakerTarget>[self|lover|ex-partner|friend|family|God|audience|authority|community|unknown]</SpeakerTarget>
      <LiteralInterpretation>[one sentence]</LiteralInterpretation>
      <SymbolicInterpretation>[one sentence]</SymbolicInterpretation>
      <Lines>
        <Line id="[lineId]" confidence="[confident|plausible|speculative]">[one short annotation — do not restate the lyric]</Line>
        <!-- repeat for each line in this section -->
      </Lines>
    </Section>
    <!-- repeat Section for each section in the lyric context -->
  </Sections>
</LyricsIntelligence>

If lyrics are unavailable or too ambiguous to annotate responsibly, omit the <LyricsIntelligence> block entirely. Do not emit it with empty or fabricated content.
`;
}

function formatSpecialistSection(
  specialists: SpecialistAnalysisPacket,
): string {
  const lines: string[] = [];
  lines.push('## Specialist Analyses');
  lines.push(
    'The following specialist outputs have already been generated and validated. Use them as supporting evidence, but stay within the original evidence boundary.',
  );

  for (const [name, output] of [
    ['Theme', specialists.theme],
    ['Emotion', specialists.emotion],
    ['Narrative', specialists.narrative],
    ['Classification', specialists.classification],
    ['Sentiment', specialists.sentiment],
  ] as const) {
    lines.push('');
    lines.push(`### ${name} (confidence: ${output.confidence})`);
    lines.push(output.summary);
    if (output.refusalReason) {
      lines.push(`Refusal reason: ${output.refusalReason}`);
    }
    lines.push('Claims:');
    for (const claim of output.claims) {
      lines.push(`- (${claim.evidenceRefs.join(', ')}) ${claim.text}`);
    }
  }

  if (specialists.lyrics) {
    lines.push('');
    lines.push(`### Lyrics (confidence: ${specialists.lyrics.confidence})`);
    lines.push(specialists.lyrics.summary);
    if (specialists.lyrics.refusalReason) {
      lines.push(`Refusal reason: ${specialists.lyrics.refusalReason}`);
    }
    lines.push('Claims:');
    for (const claim of specialists.lyrics.claims) {
      lines.push(`- (${claim.evidenceRefs.join(', ')}) ${claim.text}`);
    }
  } else {
    lines.push('');
    lines.push('### Lyrics: unavailable for this request');
  }

  return lines.join('\n');
}

function formatRankedEvidenceHints(packet: RankedEvidencePacket): string {
  const top = [...packet.blocks]
    .sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0))
    .slice(0, 5)
    .map(
      (b) =>
        `- ${b.ref} (${b.kind}, relevance ${(b.relevance ?? 0).toFixed(2)}): ${b.label}`,
    );
  if (top.length === 0) return '';
  return `\n\nTop-ranked evidence (highest relevance first):\n${top.join('\n')}`;
}

export function buildPrompt(
  templateKey: PromptTemplateKey,
  context: ReviewContextPacket,
): GeminiPromptPlan {
  const evidenceText = context.evidenceBlocks
    .map((b) => `### ${b.label}\n${b.text}`)
    .join('\n\n');

  const missingText =
    context.missingSignals.length > 0
      ? templateKey === 'track' && context.missingSignals.includes('lyrics')
        ? `IMPORTANT: Lyrics are unavailable for this track. Do not speculate about lyrical content, specific themes, or meaning you cannot verify. Limit the review strictly to what the metadata, genre tags, and artist context support. State in the review that a lyric-grounded reading is not yet possible. Set confidence to Low.`
        : `Missing evidence: ${context.missingSignals.join(', ')}. Narrow your interpretation accordingly.`
      : '';

  const lyricsContract =
    templateKey === 'track' && context.normalizedLyricSections
      ? buildLyricsXmlContract(
          buildLyricContextText(context.normalizedLyricSections),
        )
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

${XML_CONTRACT}

${lyricsContract}`;

  return { systemInstruction, userPrompt };
}

// Synthesis prompt: used after the specialist stage to give the final
// reviewer the original evidence plus the validated specialist outputs.
// The reviewer remains the single source of streamed prose and final
// <ReviewResult> XML — specialists do not bypass it.
export function buildReviewerSynthesisPrompt(
  templateKey: PromptTemplateKey,
  context: ReviewContextPacket,
  ranked: RankedEvidencePacket,
  specialists: SpecialistAnalysisPacket,
): GeminiPromptPlan {
  const evidenceText = context.evidenceBlocks
    .map((b) => `### ${b.label}\n${b.text}`)
    .join('\n\n');

  const missingText =
    context.missingSignals.length > 0
      ? `Missing evidence: ${context.missingSignals.join(', ')}. Narrow your interpretation accordingly.`
      : '';

  const rankedHints = formatRankedEvidenceHints(ranked);
  const specialistSection = formatSpecialistSection(specialists);

  const lyricsContract =
    templateKey === 'track' && context.normalizedLyricSections
      ? buildLyricsXmlContract(
          buildLyricContextText(context.normalizedLyricSections),
        )
      : '';

  const systemInstruction = `You are the final reviewer. You have access to the original evidence
and validated specialist outputs. Your job is to synthesize them into
one grounded, critic-style review and a final <ReviewResult> XML block.
Do not repair malformed specialist output, override low evidence, or
invent claims not supported by the evidence.
${CONTENT_TYPE_INSTRUCTIONS[templateKey]}`;

  const userPrompt = `## Evidence\n\n${evidenceText}\n\n${missingText}${rankedHints}

${specialistSection}

Write a 3-paragraph critic-style prose review of "${context.metadata.title}" by "${context.metadata.artistName}".
Use the specialist outputs as supporting structure, but do not contradict
the original evidence. If a specialist produced a low-confidence claim or
a refusal reason, treat that as a confidence constraint, not a hard
fact. Stay grounded. After the prose, append the XML block as instructed.

${XML_CONTRACT}

${lyricsContract}`;

  return { systemInstruction, userPrompt };
}
