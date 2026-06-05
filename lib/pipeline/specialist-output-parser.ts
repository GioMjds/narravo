import type {
  EvidenceRef,
  RankedEvidencePacket,
  SpecialistClaim,
  SpecialistConfidence,
  SpecialistOutput,
} from './types';

type ParseResult =
  | { ok: true; output: SpecialistOutput }
  | { ok: false; reason: string };

const VALID_CONFIDENCE: ReadonlySet<SpecialistConfidence> = new Set([
  'high',
  'medium',
  'low',
]);

const VALID_ROLES: ReadonlySet<SpecialistOutput['role']> = new Set([
  'themeAnalyst',
  'emotionAnalyst',
  'narrativeAnalyst',
  'classifier',
  'sentimentAnalyst',
  'lyricsSpecialist',
]);

export function parseSpecialistOutput(
  text: string,
  expectedRole: SpecialistOutput['role'],
  packet: RankedEvidencePacket,
): ParseResult {
  const match = text.match(/<Specialist\b[^>]*>([\s\S]*?)<\/Specialist>/);
  if (!match) {
    return { ok: false, reason: 'No <Specialist> XML block found' };
  }

  const headerMatch = text.match(/<Specialist\b([^>]*)>/);
  const attrs = headerMatch?.[1] ?? '';
  const roleMatch = attrs.match(/role="([^"]+)"/);

  const claimedRole = roleMatch?.[1] ?? '';
  if (claimedRole !== expectedRole) {
    return {
      ok: false,
      reason: `Specialist role mismatch: expected "${expectedRole}", got "${claimedRole || 'missing'}"`,
    };
  }

  if (!VALID_ROLES.has(claimedRole as SpecialistOutput['role'])) {
    return {
      ok: false,
      reason: `Unsupported specialist role "${claimedRole}"`,
    };
  }

  const body = match[1];

  const summaryMatch = body.match(/<Summary>([\s\S]*?)<\/Summary>/);
  const summary = summaryMatch?.[1]?.trim() ?? '';
  if (!summary) {
    return { ok: false, reason: 'Empty <Summary>' };
  }

  const claimsBody = matchClaimGroup(body, 'Claims');
  const claimMatches = claimsBody
    ? [
        ...claimsBody.matchAll(
          /<Claim\s+refs="([^"]+)"\s*>([\s\S]*?)<\/Claim>/g,
        ),
      ]
    : [];

  if (claimMatches.length === 0) {
    return { ok: false, reason: 'Specialist produced no <Claim> entries' };
  }

  const claims: SpecialistClaim[] = [];
  for (const m of claimMatches) {
    const text = m[2].trim();
    if (!text) {
      return { ok: false, reason: 'Empty <Claim> text' };
    }
    const rawRefs = expandRefs(m[1]);

    if (rawRefs.length === 0) {
      return { ok: false, reason: 'Claim with no evidence refs' };
    }

    const validRefs = rawRefs.filter((ref) => isValidRef(packet, ref));

    if (validRefs.length === 0) {
      // Every ref the model produced is hallucinated — hard-fail this specialist.
      return {
        ok: false,
        reason: `Claim has no valid evidence refs; all rejected: [${rawRefs.join(', ')}]`,
      };
    }
    // Invalid refs are silently dropped; at least one valid ref remains.
    claims.push({ text, evidenceRefs: validRefs });
  }

  const evidenceRefsBody = matchClaimGroup(body, 'EvidenceRefs');
  const evidenceRefs: EvidenceRef[] = evidenceRefsBody
    ? [...evidenceRefsBody.matchAll(/<Ref>([^<]+)<\/Ref>/g)].flatMap((m) =>
        expandRefs(m[1]),
      )
    : [];

  // Filter invalid refs with a warning instead of failing the whole specialist.
  const validEvidenceRefs = evidenceRefs.filter((ref) => {
    if (!isValidRef(packet, ref)) {
      console.warn(`[specialist-parser] Dropping unknown EvidenceRef "${ref}"`);
      return false;
    }
    return true;
  });

  function canonicalRef(ref: string): string {
    // If it's a section-qualified line ref like "S001-L001", strip the section prefix
    const lineOnlyMatch = ref.match(/^S\d+-(.+)$/);
    return lineOnlyMatch ? lineOnlyMatch[1] : ref;
  }

  // Require that each claim's refs also appear in the top-level EvidenceRefs.
  const topLevelSet = new Set(validEvidenceRefs.map(canonicalRef));
  for (const claim of claims) {
    for (const ref of claim.evidenceRefs) {
      if (!topLevelSet.has(canonicalRef(ref))) {
        console.warn(
          `[specialist-parser] Claim ref "${ref}" not declared in <EvidenceRefs> — continuing`,
        );
      }
    }
  }

  const confidenceMatch = body.match(/<Confidence>([^<]+)<\/Confidence>/);
  const confidenceRaw = confidenceMatch?.[1]?.trim() ?? '';
  if (!VALID_CONFIDENCE.has(confidenceRaw as SpecialistConfidence)) {
    return {
      ok: false,
      reason: `Unsupported <Confidence> value "${confidenceRaw}"`,
    };
  }

  const refusalMatch = body.match(/<RefusalReason>([\s\S]*?)<\/RefusalReason>/);
  const refusalReason = refusalMatch?.[1]?.trim() || undefined;

  return {
    ok: true,
    output: {
      role: expectedRole,
      summary,
      claims,
      evidenceRefs: validEvidenceRefs,
      confidence: confidenceRaw as SpecialistConfidence,
      refusalReason,
    },
  };
}

function matchClaimGroup(body: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const m = body.match(re);
  return m?.[1] ?? null;
}

function expandRefs(raw: string): EvidenceRef[] {
  return raw
    .split(',')
    .flatMap((r) =>
      r
        .trim()
        .split('.')
        .map((p) => p.trim()),
    )
    .filter(Boolean) as EvidenceRef[];
}

function isValidRef(packet: RankedEvidencePacket, ref: string): boolean {
  return (
    packet.refToBlock.has(ref) ||
    packet.refToLine.has(ref) ||
    packet.refToSection.has(ref)
  );
}
