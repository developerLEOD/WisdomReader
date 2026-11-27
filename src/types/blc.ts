/**
 * Types for the Wisdom Lounge BLC (Book Learning Circle) Session Planner
 */

export interface ParsedPage {
  pageNumber: number;
  text: string;
  wordCount: number;
}

export interface DetectedChapter {
  title: string;
  startPage: number;
  endPage: number;
  wordCount: number;
}

export interface ParsedBookForBlc {
  title: string;
  author: string;
  fileName: string;
  totalPages: number;
  totalWords: number;
  pages: ParsedPage[];
  chapters: DetectedChapter[];
}

export type BlcPacingMode = 'by_reading_minutes' | 'by_duration';

export type BlcCadence = 'weekly' | 'twice_weekly' | 'biweekly' | 'custom';

export type BlcLiteralPartSize = 'compact' | 'standard' | 'extended';

export type BlcPlanLanguageMode = 'auto' | 'urdu';

export type BlcLiteralBlockType =
  | 'heading'
  | 'subheading'
  | 'paragraph'
  | 'quote'
  | 'list'
  | 'prompt_callout';

export interface BlcLiteralBlock {
  type: BlcLiteralBlockType;
  pageNumber: number;
  text: string;
  items?: string[];
  promptTitle?: string;
  promptSide?: 'left' | 'right';
  isContinuation?: boolean;
}

export interface BlcSessionPillar {
  title: string;
  summary: string;
}

export interface BlcLiteralReadingPart {
  partNumber: number;
  totalParts: number;
  contextualTitle?: string;
  chapterName?: string;
  isSessionCoverPage?: boolean;
  isChapterTitlePage?: boolean;
  sessionOverview?: string;
  sessionPillars?: BlcSessionPillar[];
  startPage: number;
  endPage: number;
  wordCount: number;
  estimatedReadingMinutes: number;
  paragraphs: Array<{ pageNumber: number; text: string }>;
  blocks: BlcLiteralBlock[];
  plainText: string;
  isAiOrganized?: boolean;
  sourceFolioNumber?: number;
  slideSplitIndex?: number;
  slideSplitTotal?: number;
}

export interface BlcScheduleConfig {
  circleName: string;
  pacingMode: BlcPacingMode;
  targetReadingMinutes: number;
  durationWeeks: number;
  cadence: BlcCadence;
  sessionsPerWeek: number;
  meetingDurationMinutes: number;
  readingSpeedWpm: number;
  startDate?: string;
  focusGoals?: string;
  planLanguageMode?: BlcPlanLanguageMode;
  injectDiscussionPrompts?: boolean;
  includeLiteralText?: boolean;
  literalPartSize?: BlcLiteralPartSize;
}

export interface SessionPartitionPreview {
  sessionNumber: number;
  startPage: number;
  endPage: number;
  chaptersCovered: string[];
  wordCount: number;
  estimatedReadingMinutes: number;
  scheduledDate?: string;
}

export interface BlcTopicPassage {
  quote: string;
  pageRef: string;
}

export interface BlcTopicExtraction {
  topicTitle: string;
  summary: string;
  keyExtractions: string[];
  keyPassages: BlcTopicPassage[];
}

export interface BlcDiscussionPrompt {
  question: string;
  category: 'Comprehension' | 'Critical Reflection' | 'Practical Application';
  facilitatorCue: string;
}

export interface BlcAgendaSegment {
  segmentTitle: string;
  durationMinutes: number;
  activityDescription: string;
}

export interface BlcPreSessionPrep {
  readingMindset: string;
  reflectionQuestions: string[];
}

export interface BlcSessionPlan {
  sessionNumber: number;
  title: string;
  sessionSummary?: string;
  scheduledDate?: string;
  startPage: number;
  endPage: number;
  chaptersCovered: string[];
  wordCount: number;
  estimatedReadingMinutes: number;
  topics: BlcTopicExtraction[];
  preSessionPrep: BlcPreSessionPrep;
  discussionPrompts: BlcDiscussionPrompt[];
  agenda: BlcAgendaSegment[];
  completed: boolean;
  facilitatorNotes: string;
}

export interface BlcPlan {
  id: string;
  userId?: string;
  circleName: string;
  bookTitle: string;
  author: string;
  fileName: string;
  totalPages: number;
  totalWords: number;
  overallSummary: string;
  learningArcOutcomes: string[];
  config: BlcScheduleConfig;
  sessions: BlcSessionPlan[];
  createdAt: number;
  updatedAt: number;
}
