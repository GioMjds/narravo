export type NarravoPlatform = 'spotify' | 'youtube-music';

export type NarravoRecoverableErrorCode =
  | 'unsupported_platform'
  | 'private_track'
  | 'rate_limited'
  | 'missing_context'
  | 'resolve_failure';

export type NarravoRecoverableError = {
  code: NarravoRecoverableErrorCode;
  status: number;
  title: string;
  message: string;
  hint: string;
};

export type NarravoReviewMetadata = {
  title: string;
  artist: string;
  album: string;
  releaseLabel: string;
  platform: NarravoPlatform;
  platformLabel: string;
  coverArtUrl: string;
};

export type NarravoEvidenceSection = {
  title: string;
  items: string[];
};

export type NarravoScore = {
  label: string;
  score: number;
  note: string;
};

export type NarravoReviewComplete = {
  reviewText: string;
  evidence: NarravoEvidenceSection[];
  scores: NarravoScore[];
  tags: string[];
  takeaway: string;
  confidence: {
    label: string;
    note: string;
  };
};

export type NarravoReviewStreamEvent =
  | {
      type: 'metadata';
      metadata: NarravoReviewMetadata;
    }
  | {
      type: 'chunk';
      chunk: string;
    }
  | {
      type: 'complete';
      result: NarravoReviewComplete;
    };

type NarravoReviewSeed = {
  key: string;
  metadata: Omit<NarravoReviewMetadata, 'coverArtUrl'> & {
    palette: [string, string, string];
  };
  reviewParagraphs: string[];
  evidence: NarravoEvidenceSection[];
  scores: NarravoScore[];
  tags: string[];
  takeaway: string;
  confidence: {
    label: string;
    note: string;
  };
};

type NarravoResolveResult =
  | {
      ok: true;
      payload: {
        metadata: NarravoReviewMetadata;
        reviewChunks: string[];
        complete: NarravoReviewComplete;
      };
    }
  | {
      ok: false;
      error: NarravoRecoverableError;
    };

export const demoLinks = [
  {
    href: 'https://open.spotify.com/track/demo-someone-like-you',
    label: 'Adele - Someone Like You',
    description: 'A heartbreak reading centered on memory, comparison, and release.',
    platformLabel: 'Spotify demo',
  },
  {
    href: 'https://music.youtube.com/watch?v=demo-fast-car',
    label: 'Tracy Chapman - Fast Car',
    description: 'An escape narrative built from motion, class pressure, and fragile hope.',
    platformLabel: 'YouTube Music demo',
  },
] as const;

const reviewSeeds: Record<string, NarravoReviewSeed> = {
  'spotify:demo-someone-like-you': {
    key: 'spotify:demo-someone-like-you',
    metadata: {
      title: 'Someone Like You',
      artist: 'Adele',
      album: '21',
      releaseLabel: '21 · 2011 · Spotify demo source',
      platform: 'spotify',
      platformLabel: 'Spotify',
      palette: ['#2c1f1b', '#a05343', '#ecd8c6'],
    },
    reviewParagraphs: [
      'Narravo reads this song as heartbreak after the loud part is already over. The voice is not arguing for reunion so much as trying to survive the shock of seeing someone else move on first, which gives the review its mixture of grace and humiliation.',
      'What makes the meaning land is the song\'s refusal to dramatize itself into revenge. The emotional center is comparison: one life keeps moving, while the other keeps circling the memory of what almost became permanent. That makes the grief feel adult, because it is less about explosion than about learning how to stand inside a changed reality.',
      'The sparse arrangement matters to the reading. The piano and open space keep the lyric from hiding behind production tricks, so the feeling is exposed in a nearly conversational way. Narravo therefore scores the track highest when the song\'s emotional restraint and lyrical plainness start reinforcing each other.',
    ],
    evidence: [
      {
        title: 'Lyrical themes',
        items: [
          'Letting go is present, but it arrives as discipline rather than closure.',
          'The song keeps returning to memory and comparison instead of direct accusation.',
          'Its meaning depends on accepting another person\'s future while still grieving your own.',
        ],
      },
      {
        title: 'Emotional cues',
        items: [
          'The vocal delivery feels wounded but controlled, which keeps the grief believable.',
          'Restraint is the song\'s strongest cue: it sounds like someone trying not to fracture in public.',
          'The track moves from ache toward reluctant acceptance without pretending the pain is finished.',
        ],
      },
      {
        title: 'Tonal atmosphere',
        items: [
          'Piano-led minimalism leaves a lot of air around the lyric.',
          'The spacious mix prevents sentiment from becoming melodrama.',
          'The atmosphere feels intimate and late-night, which sharpens the sense of private reckoning.',
        ],
      },
    ],
    scores: [
      {
        label: 'Theme clarity',
        score: 95,
        note: 'The song is unmistakably about post-breakup recognition and the work of release.',
      },
      {
        label: 'Emotional impact',
        score: 96,
        note: 'Restraint makes the pain hit harder than a larger or angrier performance would.',
      },
      {
        label: 'Lyrical depth',
        score: 88,
        note: 'The language stays plain, but the emotional framing gives it durable weight.',
      },
      {
        label: 'Sonic atmosphere',
        score: 90,
        note: 'Minimal arrangement and empty space help the lyric carry the full room.',
      },
      {
        label: 'Replay pull',
        score: 84,
        note: 'The track invites repeat listening because its emotional precision survives familiarity.',
      },
    ],
    tags: ['heartbreak', 'acceptance', 'memory', 'restraint', 'piano-ballad'],
    takeaway:
      'Narravo hears the song less as a plea for return than as a dignified struggle to survive someone else\'s future.',
    confidence: {
      label: 'High confidence',
      note:
        'This demo review is grounded in curated lyrical and tonal cues for the track, so the interpretation can stay specific without bluffing.',
    },
  },
  'youtube-music:demo-fast-car': {
    key: 'youtube-music:demo-fast-car',
    metadata: {
      title: 'Fast Car',
      artist: 'Tracy Chapman',
      album: 'Tracy Chapman',
      releaseLabel: 'Tracy Chapman · 1988 · YouTube Music demo source',
      platform: 'youtube-music',
      platformLabel: 'YouTube Music',
      palette: ['#112334', '#456d88', '#dbb77a'],
    },
    reviewParagraphs: [
      'Narravo reads this song as a story about motion becoming a temporary theology. The car is never just transportation; it is the object onto which freedom, class escape, tenderness, and self-invention are all projected at once.',
      'The song\'s meaning sharpens because every promise of movement collides with inherited hardship. That contrast keeps the review from flattening the track into optimism. It is a song about wanting velocity badly enough to believe that momentum might rewrite a life, even when the old patterns keep chasing the speaker.',
      'The acoustic atmosphere matters as much as the narrative. The performance stays calm, almost documentary in tone, which stops the song from romanticizing poverty or struggle. Narravo\'s critic read therefore treats the track as a clear-eyed account of hope under pressure rather than a simple anthem of escape.',
    ],
    evidence: [
      {
        title: 'Lyrical themes',
        items: [
          'Escape is framed as practical need, not fantasy for its own sake.',
          'Family history and economic limitation remain attached to every dream of departure.',
          'The lyric keeps asking whether movement can actually break a cycle or only delay it.',
        ],
      },
      {
        title: 'Emotional cues',
        items: [
          'The delivery is weary but never defeated, which keeps hope alive without making it naive.',
          'Tenderness and frustration coexist, giving the song emotional complexity.',
          'Its calm tone makes the desperation feel more truthful, not less urgent.',
        ],
      },
      {
        title: 'Tonal atmosphere',
        items: [
          'Acoustic motion creates a sense of road and forward pull without sounding triumphant.',
          'The arrangement leaves enough negative space for the narrative details to stay exposed.',
          'The song feels nocturnal and mobile, like a plan being held together in real time.',
        ],
      },
    ],
    scores: [
      {
        label: 'Theme clarity',
        score: 94,
        note: 'The song is sharply focused on escape, inheritance, and the fragile economics of hope.',
      },
      {
        label: 'Emotional impact',
        score: 93,
        note: 'Its quiet delivery makes the longing and exhaustion land with unusual force.',
      },
      {
        label: 'Lyrical depth',
        score: 97,
        note: 'Narrative details and social pressure stay concrete without losing universality.',
      },
      {
        label: 'Sonic atmosphere',
        score: 91,
        note: 'The arrangement keeps movement present while preserving realism and restraint.',
      },
      {
        label: 'Replay pull',
        score: 89,
        note: 'Repeated listens keep revealing how tightly the emotional and material stakes are intertwined.',
      },
    ],
    tags: ['escape', 'class pressure', 'hope', 'acoustic', 'narrative songwriting'],
    takeaway:
      'Narravo hears the song as a study of how people invest movement with the power to rescue them, even when the old conditions remain close behind.',
    confidence: {
      label: 'High confidence',
      note:
        'This demo review uses curated lyrical and tonal cues for the track, which allows a specific reading without pretending the evidence is broader than it is.',
    },
  },
};

export function validateNarravoUrlInput(url: string):
  | { ok: true }
  | { ok: false; message: string } {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return {
      ok: false,
      message: 'Paste a Spotify or YouTube Music track URL to continue.',
    };
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmedUrl);
  } catch {
    return {
      ok: false,
      message: 'That link is not a valid URL yet.',
    };
  }

  const host = parsed.hostname.toLowerCase();

  if (
    host.includes('spotify.com') ||
    host === 'music.youtube.com' ||
    host === 'www.music.youtube.com'
  ) {
    return { ok: true };
  }

  if (host.includes('youtube.com') || host === 'youtu.be') {
    return {
      ok: false,
      message:
        'Use a YouTube Music track link for this MVP. Standard YouTube video URLs are not supported yet.',
    };
  }

  return {
    ok: false,
    message:
      'Narravo currently supports Spotify and YouTube Music track links only.',
  };
}

export function resolveNarravoReview(url: string): NarravoResolveResult {
  const trimmedUrl = url.trim();
  const validation = validateNarravoUrlInput(trimmedUrl);

  if (!validation.ok) {
    return {
      ok: false,
      error: unsupportedPlatformError(validation.message),
    };
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmedUrl);
  } catch {
    return {
      ok: false,
      error: unsupportedPlatformError('Narravo could not parse that URL.'),
    };
  }

  const host = parsed.hostname.toLowerCase();
  const spotifyMatch = parsed.pathname.match(/\/track\/([^/?]+)/);
  const youtubeId = parsed.searchParams.get('v');

  let key: string | null = null;

  if (host.includes('spotify.com')) {
    if (!spotifyMatch?.[1]) {
      return {
        ok: false,
        error: resolveFailureError(
          'This Spotify link does not point to a track.',
          'Use a direct Spotify track URL such as open.spotify.com/track/...',
        ),
      };
    }

    key = `spotify:${spotifyMatch[1]}`;
  } else if (host === 'music.youtube.com' || host === 'www.music.youtube.com') {
    if (!youtubeId) {
      return {
        ok: false,
        error: resolveFailureError(
          'This YouTube Music link is missing a track identifier.',
          'Use a direct music.youtube.com/watch?v=... track URL.',
        ),
      };
    }

    key = `youtube-music:${youtubeId}`;
  } else if (host.includes('youtube.com') || host === 'youtu.be') {
    return {
      ok: false,
      error: unsupportedPlatformError(
        'Standard YouTube video links are outside the supported MVP scope.',
      ),
    };
  }

  if (!key) {
    return {
      ok: false,
      error: unsupportedPlatformError(
        'Narravo could not identify the platform for this link.',
      ),
    };
  }

  if (key.endsWith(':private-track')) {
    return {
      ok: false,
      error: {
        code: 'private_track',
        status: 403,
        title: 'The track could not be accessed',
        message:
          'This link behaves like a private or unavailable track, so Narravo cannot gather grounded evidence from it.',
        hint: 'Try a public track instead, or use one of the demo links to preview the full flow.',
      },
    };
  }

  if (key.endsWith(':rate-limited')) {
    return {
      ok: false,
      error: {
        code: 'rate_limited',
        status: 429,
        title: 'Narravo hit a temporary limit',
        message:
          'The resolver or reviewer is being asked to do too much at once right now.',
        hint: 'Wait a moment and retry the same link.',
      },
    };
  }

  if (key.endsWith(':missing-context')) {
    return {
      ok: false,
      error: {
        code: 'missing_context',
        status: 422,
        title: 'Grounded context is incomplete',
        message:
          'Narravo resolved the link, but the lyrical or tonal context was not complete enough for a responsible interpretation.',
        hint: 'Try another song or use a curated demo while live context coverage is still limited.',
      },
    };
  }

  const seed = reviewSeeds[key];

  if (!seed) {
    return {
      ok: false,
      error: resolveFailureError(
        'This MVP does not have live song resolution wired for arbitrary tracks yet.',
        'Try one of the curated demo links to verify the page flow, streaming prose, and evidence states.',
      ),
    };
  }

  const metadata: NarravoReviewMetadata = {
    ...seed.metadata,
    coverArtUrl: createCoverArt(
      seed.metadata.title,
      seed.metadata.artist,
      seed.metadata.palette,
    ),
  };

  return {
    ok: true,
    payload: {
      metadata,
      reviewChunks: seed.reviewParagraphs.map((paragraph, index) =>
        `${paragraph}${index === seed.reviewParagraphs.length - 1 ? '' : '\n\n'}`,
      ),
      complete: {
        reviewText: seed.reviewParagraphs.join('\n\n'),
        evidence: seed.evidence,
        scores: seed.scores,
        tags: seed.tags,
        takeaway: seed.takeaway,
        confidence: seed.confidence,
      },
    },
  };
}

export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function unsupportedPlatformError(message: string): NarravoRecoverableError {
  return {
    code: 'unsupported_platform',
    status: 400,
    title: 'Unsupported music link',
    message,
    hint: 'Paste a Spotify track URL or a YouTube Music track URL.',
  };
}

function resolveFailureError(
  message: string,
  hint: string,
): NarravoRecoverableError {
  return {
    code: 'resolve_failure',
    status: 424,
    title: 'Narravo could not ground this review',
    message,
    hint,
  };
}

function createCoverArt(
  title: string,
  artist: string,
  palette: [string, string, string],
) {
  const initials = title
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette[0]}" />
          <stop offset="55%" stop-color="${palette[1]}" />
          <stop offset="100%" stop-color="${palette[2]}" />
        </linearGradient>
      </defs>
      <rect width="640" height="640" rx="56" fill="url(#bg)" />
      <circle cx="500" cy="140" r="90" fill="rgba(255,255,255,0.13)" />
      <circle cx="140" cy="520" r="120" fill="rgba(255,255,255,0.1)" />
      <text x="60" y="408" fill="white" font-family="Georgia, serif" font-size="172" font-weight="700">${initials}</text>
      <text x="64" y="486" fill="rgba(255,255,255,0.88)" font-family="Arial, sans-serif" font-size="36">${escapeSvg(title)}</text>
      <text x="64" y="530" fill="rgba(255,255,255,0.78)" font-family="Arial, sans-serif" font-size="24">${escapeSvg(artist)}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeSvg(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
