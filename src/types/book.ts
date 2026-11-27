/**
 * Types for Wisdom Reader by The Wisdom Lounge
 */

export type ExplanationLevel = 1 | 2 | 3 | 4;

export interface ExplanationLevelConfig {
  level: ExplanationLevel;
  name: string;
  badgeLabel: string;
  tagline: string;
  description: string;
  color: string;
}

export const EXPLANATION_LEVELS: ExplanationLevelConfig[] = [
  {
    level: 1,
    name: 'Essential Overview',
    badgeLabel: 'Level 1 · Essential',
    tagline: 'Quick & Executive',
    description: 'Concise, high-level executive thesis and key bullet points for rapid reading.',
    color: '#3B82F6' // Blue
  },
  {
    level: 2,
    name: 'Standard Scholar',
    badgeLabel: 'Level 2 · Standard',
    tagline: 'Balanced Analysis',
    description: 'Balanced scholarly breakdown with chapter outlines, core themes, and key quotes.',
    color: '#8C5A2B' // Gold/Brown
  },
  {
    level: 3,
    name: 'Deep Analytical',
    badgeLabel: 'Level 3 · Deep Analytical',
    tagline: 'In-Depth Study',
    description: 'Comprehensive analysis with detailed contextual breakdown, philosophical nuances, and textual evidence.',
    color: '#D97706' // Amber
  },
  {
    level: 4,
    name: 'Exhaustive Commentary',
    badgeLabel: 'Level 4 · Exhaustive',
    tagline: 'Mastery Commentary',
    description: 'Exhaustive commentary with maximum chapter depth, cross-references, linguistic nuances, and historical context.',
    color: '#DC2626' // Crimson
  }
];

export interface Quote {
  quote: string;
  context: string;
}

export interface ChapterAnalysisSteps {
  step1CloseReading: string;
  step2PremiseDeconstruction: string;
  step3Synthesis: string;
}

export interface ChapterSummary {
  number: number;
  title: string;
  summary: string; // 3-5 comprehensive paragraphs
  detailedAnalysis?: string;
  keyEvents: string[];
  keyQuotes: string[]; // Direct textual citations from user-provided book text
  historicalContext?: string;
  readTimeMinutes: number;
  sectionAnalysisSteps?: ChapterAnalysisSteps;
  paragraphBreakdown?: string[];
}

export interface EntityOrConcept {
  name: string;
  role: string; // e.g., "Historical Scholar", "Central Concept", "Key Figure"
  description: string;
  keyRelationships?: string;
  keyQuotesOrPassages: string[];
}

export interface BookTheme {
  title: string;
  explanation: string;
  evidence: string[];
}

export interface ExecutiveSummary {
  thesis: string;
  overview: string;
  keyTakeaways: string[];
  targetAudience: string;
  toneAndStyle: string;
  famousQuotes: Quote[];
}

export type RemedySlideType = 
  | 'hook' 
  | 'diagnosis' 
  | 'textual_insight' 
  | 'solution' 
  | 'quote' 
  | 'action'
  | 'intervention_individual'
  | 'intervention_community'
  | 'intervention_institutional';

export interface InterventionDetail {
  title: string;
  actions: string[];
  mechanism: string;
}

export interface LevelsOfIntervention {
  individual: InterventionDetail;
  community: InterventionDetail;
  institutional: InterventionDetail;
}

export interface ModernRemedySlide {
  slideNumber: number;
  title: string;
  content: string;
  type: RemedySlideType;
  interventionLevel?: 'individual' | 'community' | 'institutional';
  actionableSteps?: string[];
  quoteRef?: string;
  highlightText?: string;
}

export interface ModernRemedy {
  id: string;
  problemTitle: string;
  questionHook: string;
  category: string;
  isMisconceptionFix?: boolean;
  misconceptionStatement?: string;
  problemAnalysis?: string;
  sourceContribution?: string;
  reasoningConnection?: string;
  actionSteps?: string[];
  limitations?: string;
  responsibleParty?: string;
  mechanism?: string;
  levelsOfIntervention?: LevelsOfIntervention;
  slides: ModernRemedySlide[];
  keyTakeawaySummary: string;
}

export interface SourceDocument {
  id: string;
  title: string;
  author?: string;
  fileName?: string;
  wordCount: number;
  previewText?: string;
  keyStanceOrTheme?: string;
}

export interface CrossDocumentTheme {
  theme: string;
  perspectiveByDoc: { [docTitle: string]: string };
  synthesis: string;
}

export interface DialecticalTension {
  issue: string;
  opposingViews: { docTitle: string; stance: string; quote?: string }[];
  resolutionOrInsight: string;
}

export interface CrossDocumentMatrixRow {
  topic: string;
  docPositions: { docTitle: string; position: string }[];
  consensusOrDivergence: 'Consensus' | 'Divergence' | 'Complementary';
  synthesisNote: string;
}

export interface ComparativeSynthesis {
  crossDocumentThemes: CrossDocumentTheme[];
  dialecticalTensions: DialecticalTension[];
  crossDocumentMatrix: CrossDocumentMatrixRow[];
  combinedRemediesSummary?: string;
}

export interface TranslatedContent {
  title?: string;
  author?: string;
  executiveSummary: {
    thesis: string;
    overview: string;
    keyTakeaways: string[];
    famousQuotes?: Quote[];
  };
  chapters?: {
    number: number;
    title: string;
    summary: string;
    detailedAnalysis?: string;
    sectionAnalysisSteps?: ChapterAnalysisSteps;
    keyQuotes?: string[];
  }[];
  modernRemedies?: {
    id: string;
    problemTitle: string;
    questionHook: string;
    slides: {
      slideNumber: number;
      title: string;
      content: string;
      actionableSteps?: string[];
    }[];
  }[];
}

export interface BookAnalysis {
  id: string;
  title: string;
  author: string;
  category: string; // e.g. "Classical Islamic Thought", "Philosophy & Ethics", "Literature & History", "Strategy"
  explanationLevel?: ExplanationLevel;
  wordCount: number;
  estimatedReadTime: number; // in minutes
  coverImage?: string;
  executiveSummary: ExecutiveSummary;
  chapters: ChapterSummary[];
  charactersOrEntities: EntityOrConcept[];
  themes: BookTheme[];
  modernRemedies?: ModernRemedy[];
  rawTextPreview: string;
  createdAt: number;
  isCustomUpload?: boolean;
  // Multi-document & combined analysis support
  isCombinedAnalysis?: boolean;
  sourceDocuments?: SourceDocument[];
  comparativeSynthesis?: ComparativeSynthesis;
  // Content language translation
  urduContent?: TranslatedContent;
  // Custom user directives & focus topics
  customInstructions?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations?: { chapter: string; excerpt: string }[];
  timestamp: number;
}

export type StudioTab = 'executive' | 'remedies' | 'chapters' | 'entities' | 'comparative' | 'chat' | 'reader';

