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
    const refs = m[1]
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean) as EvidenceRef[];

    if (refs.length === 0) {
      return { ok: false, reason: 'Claim with no evidence refs' };
    }
    for (const ref of refs) {
      if (!isValidRef(packet, ref)) {
        return {
          ok: false,
          reason: `Claim cites unknown evidence ref "${ref}"`,
        };
      }
    }
    claims.push({ text, evidenceRefs: refs });
  }

  const evidenceRefsBody = matchClaimGroup(body, 'EvidenceRefs');
  const evidenceRefs: EvidenceRef[] = evidenceRefsBody
    ? [...evidenceRefsBody.matchAll(/<Ref>([^<]+)<\/Ref>/g)]
        .map((m) => m[1].trim())
        .filter(Boolean)
    : [];

  for (const ref of evidenceRefs) {
    if (!isValidRef(packet, ref)) {
      return {
        ok: false,
        reason: `Unknown evidence ref "${ref}" in <EvidenceRefs>`,
      };
    }
  }

  function canonicalRef(ref: string): string {
    // If it's a section-qualified line ref like "S001-L001", strip the section prefix
    const lineOnlyMatch = ref.match(/^S\d+-(.+)$/);
    return lineOnlyMatch ? lineOnlyMatch[1] : ref;
  }

  // Require that each claim's refs also appear in the top-level EvidenceRefs.
  const topLevelSet = new Set(evidenceRefs.map(canonicalRef));
  for (const claim of claims) {
    for (const ref of claim.evidenceRefs) {
      if (!topLevelSet.has(canonicalRef(ref))) {
        return {
          ok: false,
          reason: `Claim ref "${ref}" missing from top-level <EvidenceRefs>`,
        };
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
      evidenceRefs,
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

function isValidRef(packet: RankedEvidencePacket, ref: string): boolean {
  if (packet.refToBlock.has(ref)) return true;
  if (packet.refToLine.has(ref)) return true;
  if (packet.refToSection.has(ref)) return true;
  return false;
}
