import type {
  NarravoRecoverableError,
  NarravoReviewComplete,
  NarravoReviewMetadata,
} from '@/lib/narravo-review';

export type UrlSubmissionFormProps = {
  defaultValue?: string;
  compact?: boolean;
  showExamples?: boolean;
  autoFocus?: boolean;
  className?: string;
};

export type ReviewState =
  | {
      kind: 'idle-invalid';
      url: string;
    }
  | {
      kind: 'resolving';
      url: string;
      metadata: NarravoReviewMetadata | null;
      reviewText: string;
    }
  | {
      kind: 'streaming-review';
      url: string;
      metadata: NarravoReviewMetadata;
      reviewText: string;
    }
  | {
      kind: 'parsed-complete';
      url: string;
      metadata: NarravoReviewMetadata;
      reviewText: string;
      result: NarravoReviewComplete;
    }
  | {
      kind: 'recoverable-error';
      url: string;
      error: NarravoRecoverableError;
    };

export type ReviewExperienceProps = {
  initialUrl: string;
};
