export type ScalarAnswer = string | number | boolean | null;
export type Answer = ScalarAnswer | string[];
export type ResponseType = "AG5" | "YN3" | "ORD" | "CAT" | "MULTI";
export type Classification =
  | "aligned"
  | "slight"
  | "conversation"
  | "major"
  | "major_conversation";

export interface ResponseOption {
  value: string | number;
  label?: string;
}

export interface FollowUpCondition {
  answerMin?: number | null;
  importanceMin?: number | null;
  followUpCode: string;
}

export interface HiddenUnlessParent {
  code: string;
  answerMin?: number;
}

export interface ScoringQuestion {
  code: string;
  section?: string;
  responseType?: ResponseType;
  type?: ResponseType;
  responseOptions?: ResponseOption[];
  compatibilityMatrix?: Record<string, Record<string, number>> | null;
  distanceMode?: string;
  specialScoring?: string;
  special?: string;
  parentCode?: string | null;
  followUpWhen?: FollowUpCondition | null;
  hiddenUnlessParent?: HiddenUnlessParent;
}

export interface ParticipantAnswer {
  answer: Answer;
  importance: number;
  hardLine?: boolean;
}

export interface ScoringInput extends ScoringQuestion {
  a: ParticipantAnswer;
  b: ParticipantAnswer;
}

export interface ScoredQuestion {
  code: string;
  section?: string;
  distance: number;
  weight: number;
  questionScore: number;
  classification: Classification;
  hardLineCollision: boolean;
  impact: number;
}

export interface ScoreCounts {
  aligned: number;
  minor: number;
  conversation: number;
  major: number;
  hardLineCollisions: number;
}

export interface ScoringResult {
  algorithmVersion: "1.0.0";
  alignmentIndex: number;
  categoryScores: Record<string, number>;
  counts: ScoreCounts;
  conversationCount: number;
  items: ScoredQuestion[];
}

export type AnswerCollection =
  | Record<string, ParticipantAnswer | Answer | undefined>
  | Array<{ code: string; answer: Answer; importance?: number; hardLine?: boolean }>;

export interface CompletenessResult {
  requiredCount: number;
  answerCount: number;
  complete: boolean;
  followUpsPending: string[];
}
