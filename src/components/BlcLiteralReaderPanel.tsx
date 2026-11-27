import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  Sparkles,
  Upload,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  BlcLiteralBlock,
  BlcLiteralPartSize,
  BlcLiteralReadingPart,
  BlcPlan,
  BlcSessionPillar,
  BlcSessionPlan,
  ParsedPage,
} from '../types/blc';
import {
  detectPrimaryBookLanguage,
  expandPartsWithDedicatedChapterPages,
  extractAdaptiveChaptersFromParts,
  getLiteralPartTargetWords,
  injectDiscussionPromptsIntoParts,
  splitSessionLiteralTextIntoParts,
} from '../utils/blcBookParser';
import {
  loadFormattedSessionParts,
  saveFormattedSessionParts,
} from '../utils/blcLiteralStorage';
import { getBookFontEmbedCss } from '../utils/fontEmbedHelper';
import {
  renderFormattedImportantText,
  stripEditorialMarkers,
} from '../utils/editorialFormatting';
import { paginatePartsToCanvasBoundary } from '../utils/canvasSlidePaginator';

interface BlcLiteralReaderPanelProps {
  plan: BlcPlan;
  session: BlcSessionPlan;
  pages: ParsedPage[] | null;
  isLoadingPages: boolean;
  onAttachBookFile: (file: File) => Promise<void>;
  onChangePartSize?: (size: BlcLiteralPartSize) => void;
  onSyncSessionChapters?: (chapters: string[]) => void;
}

type PngCardTheme = 'parchment' | 'ivory' | 'espresso' | 'slate';
type PngRatio = 'auto' | '4:5' | '9:16' | '16:9';
type ReaderViewMode = 'card_deck' | 'all_parts';
type ScriptKind = 'urdu' | 'arabic' | 'latin';

interface CardThemePalette {
  label: string;
  bg: string;
  innerFrame: string;
  quoteBg: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  subheadingColor: string;
  highlightBg: string;
  highlightText: string;
  underlineColor: string;
  border: string;
  grainAlpha: number;
  isDark: boolean;
}

const THEMES: Record<PngCardTheme, CardThemePalette> = {
  parchment: {
    label: 'Fine Laid Parchment',
    bg: '#F8F3E8',
    innerFrame: '#D5C3AA',
    quoteBg: '#EFE7D6',
    textPrimary: '#241912',
    textSecondary: '#5B4C3E',
    accent: '#824F22',
    subheadingColor: '#9A3412',
    highlightBg: 'transparent',
    highlightText: '#9A3412',
    underlineColor: '#15803D',
    border: '#D8C8B2',
    grainAlpha: 16,
    isDark: false,
  },
  ivory: {
    label: 'Classic Book Ivory',
    bg: '#FCFBF7',
    innerFrame: '#DCD3C4',
    quoteBg: '#F4F0E6',
    textPrimary: '#1A1613',
    textSecondary: '#585049',
    accent: '#7A4E24',
    subheadingColor: '#9A3412',
    highlightBg: 'transparent',
    highlightText: '#9A3412',
    underlineColor: '#15803D',
    border: '#DFD8CA',
    grainAlpha: 12,
    isDark: false,
  },
  espresso: {
    label: 'Gilded Folio Dark',
    bg: '#19120D',
    innerFrame: '#4A3628',
    quoteBg: '#241A13',
    textPrimary: '#F7F1E5',
    textSecondary: '#CBB9A3',
    accent: '#D4A373',
    subheadingColor: '#F0B46E',
    highlightBg: 'transparent',
    highlightText: '#FBBF24',
    underlineColor: '#4ADE80',
    border: '#3C2D22',
    grainAlpha: 18,
    isDark: true,
  },
  slate: {
    label: 'Archival Indigo Ink',
    bg: '#111827',
    innerFrame: '#334155',
    quoteBg: '#1E293B',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    accent: '#93C5FD',
    subheadingColor: '#7DD3FC',
    highlightBg: 'transparent',
    highlightText: '#7DD3FC',
    underlineColor: '#4ADE80',
    border: '#334155',
    grainAlpha: 16,
    isDark: true,
  },
};

const grainTileCache = new Map<string, string>();

// Pure raster PNG paper grain tile so html-to-image renders background color + grain cleanly without SVG filter blackouts
function getRasterPaperGrainUrl(isDark: boolean, alpha: number): string {
  const cacheKey = `${isDark ? 'dark' : 'light'}_${alpha}`;
  const existing = grainTileCache.get(cacheKey);
  if (existing) return existing;

  if (typeof document === 'undefined') return '';
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  // Deterministic PRNG for clean repeatable paper fiber noise
  let seed = 1337;
  const nextRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < data.length; i += 4) {
    const r = nextRand();
    if (isDark) {
      data[i] = 245;
      data[i + 1] = 235;
      data[i + 2] = 220;
      data[i + 3] = r > 0.5 ? Math.round(r * alpha) : 0;
    } else {
      data[i] = 74;
      data[i + 1] = 52;
      data[i + 2] = 34;
      data[i + 3] = r > 0.45 ? Math.round(r * alpha) : 0;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const dataUrl = `url("${canvas.toDataURL('image/png')}")`;
  grainTileCache.set(cacheKey, dataUrl);
  return dataUrl;
}

function hasRtlScript(text: string): boolean {
  const rtlMatches = text.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g);
  const latinMatches = text.match(/[A-Za-z]/g);
  const rtlCount = rtlMatches ? rtlMatches.length : 0;
  const latinCount = latinMatches ? latinMatches.length : 0;
  return rtlCount > 0 && rtlCount >= latinCount * 0.65;
}

function hasAnyUrduLetters(text: string): boolean {
  return /[\u0679\u067E\u0686\u0688\u0691\u0698\u06A9\u06AF\u06BA\u06BE\u06C1-\u06C3\u06CC\u06D2\u06D3\u06D4]/.test(
    text
  );
}

function detectScriptKind(text: string, bookHasUrduContext: boolean): ScriptKind {
  if (!hasRtlScript(text)) return 'latin';
  const isDenseArabicCitation =
    /﴿|﴾/.test(text) || (text.match(/[\u064B-\u0652]/g)?.length || 0) >= 6;
  if (hasAnyUrduLetters(text)) return 'urdu';
  if (isDenseArabicCitation) return 'arabic';
  return bookHasUrduContext ? 'urdu' : 'arabic';
}

function resolveDisplayTitleForPart(
  part: BlcLiteralReadingPart,
  sessionHasUrdu: boolean
): string | undefined {
  const rawTitle = stripEditorialMarkers(part.contextualTitle || part.chapterName || '').trim();
  const partIsRtl =
    hasRtlScript(part.plainText) || (sessionHasUrdu && hasAnyUrduLetters(part.plainText));

  if (!partIsRtl) {
    return rawTitle || undefined;
  }

  // When the content is Urdu/Arabic, only show titles that are actually in Urdu/Arabic script
  if (rawTitle && /[\u0600-\u06FF]/.test(rawTitle)) {
    return rawTitle;
  }

  // Fallback: look for an Urdu/Arabic heading or subheading inside this folio's blocks
  const rtlHeading = part.blocks?.find(
    b => (b.type === 'heading' || b.type === 'subheading') && /[\u0600-\u06FF]/.test(b.text)
  );
  if (rtlHeading) {
    return stripEditorialMarkers(rtlHeading.text).trim();
  }

  // On dedicated chapter title pages, fallback to the first short line of RTL text if needed
  if (part.isChapterTitlePage || part.isSessionCoverPage) {
    const firstBlockText = part.blocks?.[0]?.text ? stripEditorialMarkers(part.blocks[0].text).trim() : '';
    if (firstBlockText && /[\u0600-\u06FF]/.test(firstBlockText)) {
      return firstBlockText;
    }
  }

  return undefined;
}

function toRomanNumeral(num: number): string {
  const map: Array<[number, string]> = [
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let n = Math.max(1, Math.min(399, Math.round(num)));
  let out = '';
  for (const [val, sym] of map) {
    while (n >= val) {
      out += sym;
      n -= val;
    }
  }
  return out;
}

function buildPageBatches(sessionPages: ParsedPage[], maxWordsPerBatch = 1150): ParsedPage[][] {
  const batches: ParsedPage[][] = [];
  let currentBatch: ParsedPage[] = [];
  let currentWords = 0;

  for (const page of sessionPages) {
    if (!page.text || !page.text.trim()) continue;
    const w = page.wordCount || page.text.split(/\s+/).filter(Boolean).length;

    if (currentBatch.length > 0 && (currentWords + w > maxWordsPerBatch || currentBatch.length >= 4)) {
      batches.push(currentBatch);
      currentBatch = [page];
      currentWords = w;
    } else {
      currentBatch.push(page);
      currentWords += w;
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }
  return batches;
}

const CARD_SPECS: Record<
  Exclude<PngRatio, 'auto'>,
  { width: number; height: number; aspect: string; label: string }
> = {
  '4:5': { width: 560, height: 700, aspect: '4 / 5', label: '4:5 Feed Card' },
  '9:16': { width: 540, height: 960, aspect: '9 / 16', label: '9:16 Story / Status' },
  '16:9': { width: 800, height: 450, aspect: '16 / 9', label: '16:9 Presentation Slide' },
};

export const BlcLiteralReaderPanel: React.FC<BlcLiteralReaderPanelProps> = ({
  plan,
  session,
  pages,
  isLoadingPages,
  onAttachBookFile,
  onChangePartSize,
  onSyncSessionChapters,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const canvasOuterRef = useRef<HTMLDivElement | null>(null);
  const canvasMeasureRef = useRef<HTMLDivElement | null>(null);
  const [canvasWidth, setCanvasWidth] = useState<number>(0);
  const [isMobileZoomed, setIsMobileZoomed] = useState<boolean>(false);

  const [partSize, setPartSize] = useState<BlcLiteralPartSize>(
    plan.config.literalPartSize || 'standard'
  );
  const [themeKey, setThemeKey] = useState<PngCardTheme>('parchment');
  const [ratio, setRatio] = useState<PngRatio>('auto');
  const [viewMode, setViewMode] = useState<ReaderViewMode>('card_deck');
  const [activePartIdx, setActivePartIdx] = useState<number>(0);

  // Track inner unpadded canvas width to accurately scale fixed aspect-ratio PNG cards on mobile
  useEffect(() => {
    const node = canvasMeasureRef.current || canvasOuterRef.current;
    if (!node) return;
    const updateWidth = () => {
      const target = canvasMeasureRef.current || canvasOuterRef.current;
      if (target && target.clientWidth > 0) {
        setCanvasWidth(target.clientWidth);
      }
    };
    updateWidth();
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setCanvasWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(node);
    window.addEventListener('resize', updateWidth);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [viewMode, ratio, isLoadingPages, isMobileZoomed, pages?.length, activePartIdx]);

  // Cached AI-formatted contextual parts for current session
  const [aiParts, setAiParts] = useState<BlcLiteralReadingPart[] | null>(null);
  const [useAiFormatting, setUseAiFormatting] = useState<boolean>(true);
  const [fixGrammar, setFixGrammar] = useState<boolean>(true);
  const [injectPrompts, setInjectPrompts] = useState<boolean>(
    plan.config.injectDiscussionPrompts !== false
  );
  const [writeContentInUrdu, setWriteContentInUrdu] = useState<boolean>(
    plan.config.planLanguageMode === 'urdu'
  );
  const [isOrganizingAi, setIsOrganizingAi] = useState<boolean>(false);
  const [aiProgress, setAiProgress] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [loadedCacheKey, setLoadedCacheKey] = useState<string>('');
  const autoTriggeredUrduRef = useRef<Set<string>>(new Set());

  const [isAttachingFile, setIsAttachingFile] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  useEffect(() => {
    setPartSize(plan.config.literalPartSize || 'standard');
    setInjectPrompts(plan.config.injectDiscussionPrompts !== false);
    setWriteContentInUrdu(plan.config.planLanguageMode === 'urdu');
  }, [plan.id]);

  // Load cached AI-formatted contextual parts when plan or session changes
  useEffect(() => {
    let cancelled = false;
    const key = `${plan.id}:${session.sessionNumber}`;
    setAiError(null);
    loadFormattedSessionParts(plan.id, session.sessionNumber)
      .then(cached => {
        if (!cancelled) {
          if (cached && cached.parts.length > 0) {
            setAiParts(cached.parts);
            setUseAiFormatting(true);
          } else {
            setAiParts(null);
          }
          setLoadedCacheKey(key);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAiParts(null);
          setLoadedCacheKey(key);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [plan.id, session.sessionNumber]);

  const localParts = useMemo(() => {
    if (!pages || pages.length === 0) return [];
    return splitSessionLiteralTextIntoParts(
      pages,
      session.startPage,
      session.endPage,
      partSize,
      plan.config.readingSpeedWpm
    );
  }, [pages, session.startPage, session.endPage, partSize, plan.config.readingSpeedWpm]);

  const rawParts: BlcLiteralReadingPart[] =
    aiParts && aiParts.length > 0 && useAiFormatting ? aiParts : localParts;

  const sessionHasUrduContext = useMemo(() => {
    if (writeContentInUrdu && aiParts && aiParts.length > 0 && useAiFormatting) {
      return true;
    }
    const sample = rawParts
      .slice(0, 4)
      .map(p => p.plainText)
      .join('\n');
    return (
      hasAnyUrduLetters(`${plan.bookTitle} ${session.title} ${sample}`) ||
      (writeContentInUrdu && hasAnyUrduLetters(session.discussionPrompts?.map(d => d.question).join(' ') || ''))
    );
  }, [rawParts, plan.bookTitle, session.title, session.discussionPrompts, writeContentInUrdu, aiParts, useAiFormatting]);

  // Ensure Folio I is a Whole-Session Summary Cover Slide, chapter titles get dedicated pages, and discussion prompts inject inline
  const baseParts: BlcLiteralReadingPart[] = useMemo(() => {
    if (rawParts.length === 0) return [];

    const priorCover = rawParts.find(p => p.isSessionCoverPage);
    const topicsContainRtl = session.topics.some(t =>
      /[\u0600-\u06FF]/.test(`${t.topicTitle} ${t.summary}`)
    );
    const useSessionCurriculumData = !sessionHasUrduContext || topicsContainRtl;

    const coverTitle = sessionHasUrduContext
      ? /[\u0600-\u06FF]/.test(session.title)
        ? session.title
        : priorCover?.contextualTitle && /[\u0600-\u06FF]/.test(priorCover.contextualTitle)
        ? priorCover.contextualTitle
        : plan.bookTitle
      : session.title;

    const sessionOverview = useSessionCurriculumData
      ? (session.sessionSummary || session.preSessionPrep?.readingMindset || '').trim() ||
        priorCover?.sessionOverview
      : priorCover?.sessionOverview;

    const sessionPillars: BlcSessionPillar[] | undefined =
      useSessionCurriculumData && session.topics.length > 0
        ? session.topics.map(t => ({
            title: t.topicTitle,
            summary: t.summary,
          }))
        : priorCover?.sessionPillars;

    const expanded = expandPartsWithDedicatedChapterPages(
      rawParts,
      plan.config.readingSpeedWpm,
      {
        sessionNumber: session.sessionNumber,
        sessionTitle: coverTitle,
        bookTitle: plan.bookTitle,
        author: plan.author,
        startPage: session.startPage,
        endPage: session.endPage,
        estimatedReadingMinutes: session.estimatedReadingMinutes,
        chaptersCovered: session.chaptersCovered,
        sessionOverview,
        sessionPillars,
      }
    );

    if (injectPrompts && session.discussionPrompts && session.discussionPrompts.length > 0) {
      return injectDiscussionPromptsIntoParts(
        expanded,
        session.discussionPrompts,
        writeContentInUrdu || sessionHasUrduContext
      );
    }
    return expanded;
  }, [
    rawParts,
    plan.config.readingSpeedWpm,
    sessionHasUrduContext,
    session.sessionNumber,
    session.title,
    session.sessionSummary,
    session.preSessionPrep,
    session.topics,
    session.startPage,
    session.endPage,
    session.estimatedReadingMinutes,
    session.chaptersCovered,
    session.discussionPrompts,
    plan.bookTitle,
    plan.author,
    injectPrompts,
    writeContentInUrdu,
  ]);

  // Keep session.chaptersCovered adaptive whenever organized content introduces new/translated chapter headings
  const lastSyncedChaptersRef = useRef<string>('');
  useEffect(() => {
    if (!onSyncSessionChapters || baseParts.length === 0) return;
    const isUsingOrganized = Boolean(aiParts && aiParts.length > 0 && useAiFormatting);
    if (!isUsingOrganized) return;

    const adaptiveChapters = extractAdaptiveChaptersFromParts(baseParts);
    if (adaptiveChapters.length === 0) return;

    const sig = `${plan.id}:${session.sessionNumber}:${adaptiveChapters.join('|')}`;
    const existingSig = `${plan.id}:${session.sessionNumber}:${(session.chaptersCovered || []).join('|')}`;
    if (sig !== existingSig && sig !== lastSyncedChaptersRef.current) {
      lastSyncedChaptersRef.current = sig;
      onSyncSessionChapters(adaptiveChapters);
    }
  }, [
    baseParts,
    aiParts,
    useAiFormatting,
    plan.id,
    session.sessionNumber,
    session.chaptersCovered,
    onSyncSessionChapters,
  ]);

  const hasLegacyEnglishTitlesOnUrdu = useMemo(() => {
    if (!sessionHasUrduContext || !aiParts || !useAiFormatting) return false;
    return aiParts.some(
      p =>
        hasAnyUrduLetters(p.plainText) &&
        p.contextualTitle &&
        /[A-Za-z]{3,}/.test(p.contextualTitle) &&
        !/[\u0600-\u06FF]/.test(p.contextualTitle)
    );
  }, [sessionHasUrduContext, aiParts, useAiFormatting]);

  useEffect(() => {
    setActivePartIdx(0);
  }, [session.sessionNumber, partSize, plan.id, useAiFormatting, aiParts?.length]);

  const theme = THEMES[themeKey];
  const paperGrainBg = useMemo(
    () => getRasterPaperGrainUrl(theme.isDark, theme.grainAlpha),
    [theme.isDark, theme.grainAlpha]
  );

  // Re-run real-time boundary pagination once web fonts settle so Arabic/Urdu metrics are exact
  const [fontsReadyTick, setFontsReadyTick] = useState(0);
  useEffect(() => {
    let active = true;
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (active) setFontsReadyTick(t => t + 1);
      });
    }
    return () => {
      active = false;
    };
  }, []);

  const [adaptiveSlides, setAdaptiveSlides] = useState<BlcLiteralReadingPart[]>(baseParts);

  // Real-time adaptive canvas-boundary reflowing whenever frame sizing or content changes (no AI re-formatting needed)
  useLayoutEffect(() => {
    if (ratio === 'auto' || baseParts.length === 0) {
      setAdaptiveSlides(baseParts);
      return;
    }

    const spec = CARD_SPECS[ratio];
    const slides = paginatePartsToCanvasBoundary({
      parts: baseParts,
      ratio,
      spec,
      palette: theme,
      bookTitle: plan.bookTitle,
      sessionNumber: session.sessionNumber,
      sessionHasUrduContext,
      wpm: plan.config.readingSpeedWpm,
      resolveTitle: p => resolveDisplayTitleForPart(p, sessionHasUrduContext),
    });

    setAdaptiveSlides(slides);
  }, [
    baseParts,
    ratio,
    theme,
    plan.bookTitle,
    session.sessionNumber,
    sessionHasUrduContext,
    plan.config.readingSpeedWpm,
    fontsReadyTick,
  ]);

  const parts = ratio === 'auto' ? baseParts : adaptiveSlides;
  const activePart = parts[Math.min(activePartIdx, Math.max(0, parts.length - 1))] || null;

  // Preserve reading position across ratio switches (4:5 <-> 9:16 <-> 16:9 <-> auto)
  const lastTrackedSourceFolioRef = useRef<number>(1);
  useEffect(() => {
    if (activePart) {
      lastTrackedSourceFolioRef.current = activePart.sourceFolioNumber || activePart.partNumber;
    }
  }, [activePart]);

  useEffect(() => {
    if (parts.length === 0) return;
    const targetFolio = lastTrackedSourceFolioRef.current;
    const matchIdx = parts.findIndex(
      p => (p.sourceFolioNumber || p.partNumber) === targetFolio
    );
    if (matchIdx >= 0 && matchIdx !== activePartIdx) {
      setActivePartIdx(matchIdx);
    } else if (activePartIdx >= parts.length) {
      setActivePartIdx(Math.max(0, parts.length - 1));
    }
  }, [ratio, parts.length]);

  const showTempFeedback = (msg: string) => {
    setStatusFeedback(msg);
    setTimeout(() => {
      setStatusFeedback(prev => (prev === msg ? null : prev));
    }, 2800);
  };

  const handleSizeChange = (newSize: BlcLiteralPartSize) => {
    setPartSize(newSize);
    if (aiParts && useAiFormatting) {
      setUseAiFormatting(false);
    }
    if (onChangePartSize) {
      onChangePartSize(newSize);
    }
  };

  const handleOrganizeContextually = async () => {
    if (!pages || pages.length === 0 || isOrganizingAi) return;

    const sessionPages = pages.filter(
      p => p.pageNumber >= session.startPage && p.pageNumber <= session.endPage
    );
    const batches = buildPageBatches(sessionPages, 1150);
    if (batches.length === 0) return;

    setIsOrganizingAi(true);
    setAiError(null);

    const targetWordsPerPart = getLiteralPartTargetWords(partSize);
    const collectedParts: Omit<BlcLiteralReadingPart, 'partNumber' | 'totalParts'>[] = [];
    const collectedBatchSummaries: string[] = [];
    const collectedBatchTitles: string[] = [];

    try {
      for (let bIdx = 0; bIdx < batches.length; bIdx++) {
        const batch = batches[bIdx];
        const bStart = batch[0].pageNumber;
        const bEnd = batch[batch.length - 1].pageNumber;
        setAiProgress(
          batches.length === 1
            ? `Typesetting & organizing Pages ${bStart}–${bEnd}...`
            : `Organizing batch ${bIdx + 1}/${batches.length} (Pages ${bStart}–${bEnd})...`
        );

        const response = await fetch('/api/blc-format-literal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookTitle: plan.bookTitle,
            author: plan.author,
            sessionNumber: session.sessionNumber,
            sessionTitle: session.title,
            targetWordsPerPart,
            readingSpeedWpm: plan.config.readingSpeedWpm,
            focusGoals: plan.config.focusGoals || '',
            contentLanguage: writeContentInUrdu ? 'Urdu' : detectPrimaryBookLanguage(pages),
            writeInUrdu: writeContentInUrdu,
            fixGrammarAndTranscription: fixGrammar,
            pages: batch.map(p => ({ pageNumber: p.pageNumber, text: p.text })),
          }),
        });

        const rawText = await response.text();
        let data: any = {};
        try {
          data = rawText ? JSON.parse(rawText) : {};
        } catch {
          data = { error: rawText || `Server error (${response.status})` };
        }

        if (!response.ok) {
          throw new Error(data?.error || `Formatting failed (${response.status})`);
        }

        if (Array.isArray(data.parts)) {
          collectedParts.push(...data.parts);
        }
        if (typeof data.batchSummary === 'string' && data.batchSummary.trim()) {
          collectedBatchSummaries.push(data.batchSummary.trim());
        }
        if (typeof data.batchSessionTitle === 'string' && data.batchSessionTitle.trim()) {
          collectedBatchTitles.push(data.batchSessionTitle.trim());
        }

        if (bIdx + 1 < batches.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      if (collectedParts.length === 0) {
        throw new Error('No contextual reading parts were generated.');
      }

      const prelim: BlcLiteralReadingPart[] = collectedParts.map((part, idx) => ({
        ...part,
        partNumber: idx + 1,
        totalParts: collectedParts.length,
      }));
      const topicsContainRtl = session.topics.some(t =>
        /[\u0600-\u06FF]/.test(`${t.topicTitle} ${t.summary}`)
      );
      const useSessionTopics = !writeContentInUrdu || topicsContainRtl;
      const organizedOverview =
        collectedBatchSummaries.length > 0
          ? collectedBatchSummaries.slice(0, 2).join(' ')
          : useSessionTopics
          ? (session.sessionSummary || session.preSessionPrep?.readingMindset || '').trim()
          : undefined;
      const organizedSessionTitle =
        writeContentInUrdu && !/[\u0600-\u06FF]/.test(session.title)
          ? collectedBatchTitles[0] || session.title
          : session.title;

      const expandedParts = expandPartsWithDedicatedChapterPages(
        prelim,
        plan.config.readingSpeedWpm,
        {
          sessionNumber: session.sessionNumber,
          sessionTitle: organizedSessionTitle,
          bookTitle: plan.bookTitle,
          author: plan.author,
          startPage: session.startPage,
          endPage: session.endPage,
          estimatedReadingMinutes: session.estimatedReadingMinutes,
          chaptersCovered: session.chaptersCovered,
          sessionOverview: organizedOverview,
          sessionPillars:
            useSessionTopics && session.topics.length > 0
              ? session.topics.map(t => ({
                  title: t.topicTitle,
                  summary: t.summary,
                }))
              : undefined,
        }
      );

      await saveFormattedSessionParts(plan.id, session.sessionNumber, partSize, expandedParts);
      const adaptiveChapters = extractAdaptiveChaptersFromParts(expandedParts);
      if (adaptiveChapters.length > 0 && onSyncSessionChapters) {
        onSyncSessionChapters(adaptiveChapters);
      }
      setAiParts(expandedParts);
      setUseAiFormatting(true);
      setActivePartIdx(0);
      showTempFeedback(`Organized into ${expandedParts.length} book-formatted folios`);
    } catch (err: any) {
      setAiError(err?.message || 'Could not contextually format this session.');
    } finally {
      setAiProgress(null);
      setIsOrganizingAi(false);
    }
  };

  // Auto-render reading folios in Urdu once per session when "Write in Urdu" was chosen in planning phase
  useEffect(() => {
    const key = `${plan.id}:${session.sessionNumber}`;
    if (
      plan.config.planLanguageMode !== 'urdu' ||
      loadedCacheKey !== key ||
      isLoadingPages ||
      !pages ||
      pages.length === 0 ||
      (aiParts && aiParts.length > 0) ||
      isOrganizingAi ||
      autoTriggeredUrduRef.current.has(key)
    ) {
      return;
    }

    autoTriggeredUrduRef.current.add(key);
    handleOrganizeContextually();
  }, [
    plan.id,
    plan.config.planLanguageMode,
    session.sessionNumber,
    loadedCacheKey,
    isLoadingPages,
    pages,
    aiParts,
    isOrganizingAi,
  ]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachError(null);
    setIsAttachingFile(true);
    try {
      await onAttachBookFile(file);
    } catch (err: any) {
      setAttachError(err?.message || 'Could not read the uploaded book file.');
    } finally {
      setIsAttachingFile(false);
      e.target.value = '';
    }
  };

  const buildSafeSlug = () =>
    (plan.bookTitle || 'book')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/(^_|_$)/g, '')
      .slice(0, 28) || 'BLC_Reading';

  const captureCardPngDataUrl = async (partForExport?: BlcLiteralReadingPart): Promise<string> => {
    if (!cardRef.current) {
      throw new Error('Card preview node is not ready.');
    }
    const targetText = partForExport?.plainText || activePart?.plainText || '';
    const includeUrdu = sessionHasUrduContext || hasAnyUrduLetters(targetText);
    const fontEmbedCSS = await getBookFontEmbedCss({ includeUrdu });

    const spec = ratio !== 'auto' ? CARD_SPECS[ratio] : null;

    return toPng(cardRef.current, {
      backgroundColor: theme.bg,
      pixelRatio: 2.5,
      cacheBust: true,
      skipFonts: fontEmbedCSS ? false : true,
      fontEmbedCSS,
      width: spec ? spec.width : undefined,
      height: spec ? spec.height : undefined,
      style: {
        margin: '0',
        transform: 'none',
        position: 'static',
        width: spec ? `${spec.width}px` : undefined,
        height: spec ? `${spec.height}px` : undefined,
      },
    });
  };

  const triggerDownloadDataUrl = (dataUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadCurrentPng = async () => {
    if (!activePart || isExporting) return;
    setViewMode('card_deck');
    setIsExporting(true);
    try {
      await new Promise(r => setTimeout(r, 150));
      const dataUrl = await captureCardPngDataUrl(activePart);
      const fileName = `${buildSafeSlug()}_Session_${String(session.sessionNumber).padStart(
        2,
        '0'
      )}_Folio_${String(activePart.partNumber).padStart(2, '0')}_of_${String(
        activePart.totalParts
      ).padStart(2, '0')}.png`;
      triggerDownloadDataUrl(dataUrl, fileName);
      showTempFeedback(`Downloaded Folio ${toRomanNumeral(activePart.partNumber)} PNG`);
    } catch (err) {
      console.error('Failed to generate PNG:', err);
      showTempFeedback('Could not generate PNG image. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyCurrentPng = async () => {
    if (!activePart || isExporting) return;
    setViewMode('card_deck');
    setIsExporting(true);
    try {
      await new Promise(r => setTimeout(r, 150));
      const dataUrl = await captureCardPngDataUrl(activePart);
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      if (navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
        showTempFeedback(`Copied Folio ${toRomanNumeral(activePart.partNumber)} PNG to clipboard`);
      } else {
        const fileName = `${buildSafeSlug()}_Session_${String(session.sessionNumber).padStart(
          2,
          '0'
        )}_Folio_${String(activePart.partNumber).padStart(2, '0')}.png`;
        triggerDownloadDataUrl(dataUrl, fileName);
        showTempFeedback('Clipboard image copy unavailable — downloaded PNG instead');
      }
    } catch (err) {
      console.error('Clipboard PNG error:', err);
      showTempFeedback('Could not copy PNG image to clipboard.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadAllPngs = async () => {
    if (parts.length === 0 || isExporting) return;
    setViewMode('card_deck');
    setIsExporting(true);
    const originalIdx = activePartIdx;
    const slug = buildSafeSlug();
    const sessionPad = String(session.sessionNumber).padStart(2, '0');
    const totalPad = String(parts.length).padStart(2, '0');

    try {
      for (let i = 0; i < parts.length; i++) {
        setActivePartIdx(i);
        setExportProgress(`Typesetting PNG ${i + 1} of ${parts.length}...`);
        await new Promise(r => setTimeout(r, 260));
        const dataUrl = await captureCardPngDataUrl(parts[i]);
        const partPad = String(i + 1).padStart(2, '0');
        triggerDownloadDataUrl(
          dataUrl,
          `${slug}_Session_${sessionPad}_Folio_${partPad}_of_${totalPad}.png`
        );
        await new Promise(r => setTimeout(r, 180));
      }
      showTempFeedback(`Exported all ${parts.length} book folio PNGs`);
    } catch (err) {
      console.error('Batch PNG export error:', err);
      showTempFeedback('Batch PNG export interrupted. You can download remaining parts individually.');
    } finally {
      setActivePartIdx(originalIdx);
      setExportProgress(null);
      setIsExporting(false);
    }
  };

  const handleExportSingleFromList = async (basePartIndex: number) => {
    if (isExporting) return;
    const basePart = baseParts[basePartIndex];
    if (!basePart) return;
    const targetIdx = Math.max(
      0,
      parts.findIndex(p => (p.sourceFolioNumber || p.partNumber) === basePart.partNumber)
    );
    setIsExporting(true);
    setActivePartIdx(targetIdx);
    setViewMode('card_deck');
    try {
      await new Promise(r => setTimeout(r, 240));
      const p = parts[targetIdx] || basePart;
      const dataUrl = await captureCardPngDataUrl(p);
      const fileName = `${buildSafeSlug()}_Session_${String(session.sessionNumber).padStart(
        2,
        '0'
      )}_Folio_${String(p.partNumber).padStart(2, '0')}_of_${String(p.totalParts).padStart(
        2,
        '0'
      )}.png`;
      triggerDownloadDataUrl(dataUrl, fileName);
      showTempFeedback(`Downloaded Folio ${toRomanNumeral(p.partNumber)} PNG`);
    } catch {
      showTempFeedback('Could not generate PNG for this part.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyPartText = async (partIndex: number, useBaseParts = false) => {
    const sourceList = useBaseParts ? baseParts : parts;
    const p = sourceList[partIndex];
    if (!p) return;
    const validTitle = resolveDisplayTitleForPart(p, sessionHasUrduContext);
    const titleSuffix = validTitle ? ` · ${validTitle}` : '';
    const cleanBody = stripEditorialMarkers(p.plainText);
    const formatted = `${plan.bookTitle} — Session ${session.sessionNumber} (Folio ${toRomanNumeral(p.partNumber)}/${toRomanNumeral(p.totalParts)}${titleSuffix})\n\n${cleanBody}`;
    try {
      await navigator.clipboard.writeText(formatted);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = formatted;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showTempFeedback(`Copied Folio ${toRomanNumeral(p.partNumber)} literal text`);
  };

  const handleDownloadSessionTxt = () => {
    if (baseParts.length === 0) return;
    const header = [
      `The Wisdom Lounge`,
      `Book: ${plan.bookTitle}${plan.author ? ` by ${plan.author}` : ''}`,
      `Session ${session.sessionNumber}: ${session.title}`,
      `Pages ${session.startPage}–${session.endPage} (${baseParts.length} Book Folios)`,
      '================================================================',
      '',
    ].join('\n');

    const body = baseParts
      .map(p => {
        const validTitle = resolveDisplayTitleForPart(p, sessionHasUrduContext);
        return `--- FOLIO ${toRomanNumeral(p.partNumber)} OF ${toRomanNumeral(p.totalParts)}${
          validTitle ? `: ${validTitle}` : ''
        } ---\n\n${stripEditorialMarkers(p.plainText)}`;
      })
      .join('\n\n\n');

    const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${buildSafeSlug()}_Session_${String(session.sessionNumber).padStart(
      2,
      '0'
    )}_Reading.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showTempFeedback('Downloaded full session literal reading (.txt)');
  };

  const renderSessionCoverGraphic = (
    part: BlcLiteralReadingPart,
    palette: CardThemePalette,
    bookHasUrdu: boolean
  ) => {
    const blocks = part.blocks || [];
    const titleBlock = blocks.find(b => b.type === 'heading');

    const coverTitle =
      resolveDisplayTitleForPart(part, bookHasUrdu) || titleBlock?.text || session.title;
    const scriptKind = detectScriptKind(coverTitle, bookHasUrdu);
    const isFixedRatio = ratio !== 'auto';
    const isLandscape = ratio === '16:9';
    const isTall = ratio === '9:16';

    const overviewRaw = (part.sessionOverview || '').trim();
    const overviewScript = overviewRaw ? detectScriptKind(overviewRaw, bookHasUrdu) : scriptKind;
    const pillars = (part.sessionPillars || []).filter(p => p.title && p.title.trim()).slice(0, isLandscape ? 2 : 3);

    const crestSvg = (
      <svg
        viewBox="0 0 240 92"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={
          isLandscape
            ? 'w-28 h-auto mx-auto shrink-0'
            : isTall
            ? 'w-48 h-auto mx-auto shrink-0'
            : isFixedRatio
            ? 'w-40 h-auto mx-auto shrink-0'
            : 'w-36 sm:w-48 h-auto mx-auto shrink-0'
        }
        aria-hidden="true"
      >
        {/* Outer Architectural Double Arch & Corner Filigree */}
        <path
          d="M22 84 V38 C22 14 66 4 120 4 C174 4 218 14 218 38 V84"
          stroke={palette.border}
          strokeWidth="1.2"
        />
        <path
          d="M32 84 V40 C32 20 72 10 120 10 C168 10 208 20 208 40 V84"
          stroke={palette.innerFrame}
          strokeWidth="0.9"
          strokeDasharray="4 3"
        />
        {/* 8-Pointed Geometric Seal / Star Rosette */}
        <rect
          x="109"
          y="20"
          width="22"
          height="22"
          transform="rotate(45 120 31)"
          stroke={palette.accent}
          strokeWidth="1.2"
        />
        <rect
          x="109"
          y="20"
          width="22"
          height="22"
          stroke={palette.accent}
          strokeWidth="1.1"
          opacity="0.7"
        />
        <circle cx="120" cy="31" r="3" fill={palette.accent} />
        {/* Symmetric Botanical Laurel Wings */}
        <path
          d="M84 40 C72 34 64 26 62 17 M95 35 C88 29 87 23 90 18 M72 31 C65 30 60 25 58 20"
          stroke={palette.accent}
          strokeWidth="1.15"
          strokeLinecap="round"
        />
        <path
          d="M156 40 C168 34 176 26 178 17 M145 35 C152 29 153 23 150 18 M168 31 C175 30 180 25 182 20"
          stroke={palette.accent}
          strokeWidth="1.15"
          strokeLinecap="round"
        />
        {/* Open Illuminated Codex */}
        <path
          d="M68 74 C90 65 106 65 120 74 C134 65 150 65 172 74 V51 C150 44 134 44 120 53 C106 44 90 44 68 51 Z"
          stroke={palette.accent}
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <line x1="120" y1="53" x2="120" y2="74" stroke={palette.accent} strokeWidth="1.3" />
        <path
          d="M80 57 C92 54 103 55 111 59 M80 64 C92 61 103 62 111 66 M160 57 C148 54 137 55 129 59 M160 64 C148 61 137 62 129 66"
          stroke={palette.textSecondary}
          strokeWidth="0.95"
          strokeLinecap="round"
        />
      </svg>
    );

    if (isLandscape) {
      return (
        <div
          dir={scriptKind === 'latin' ? 'ltr' : 'rtl'}
          className="flex-1 grid grid-cols-12 items-center gap-6 px-6 py-2 overflow-hidden"
        >
          {/* Left Frontispiece Plaque */}
          <div className="col-span-7 flex flex-col items-center justify-center text-center space-y-2.5 pr-4 border-r" style={{ borderColor: palette.border }}>
            <p
              style={{ color: palette.textSecondary }}
              className="text-[10px] font-serif-body uppercase tracking-[0.22em] font-semibold line-clamp-1"
            >
              {plan.bookTitle}
            </p>
            {crestSvg}
            <div
              style={{ color: palette.accent }}
              className="flex items-center justify-center gap-2.5 text-[10px] font-serif-body uppercase tracking-[0.26em] font-semibold"
            >
              <span style={{ backgroundColor: palette.border }} className="h-px w-10" />
              <span>
                {scriptKind === 'urdu'
                  ? `نشست ${session.sessionNumber}`
                  : `Session ${toRomanNumeral(session.sessionNumber)}`}
              </span>
              <span style={{ backgroundColor: palette.border }} className="h-px w-10" />
            </div>
            <h4
              style={{ color: palette.textPrimary }}
              className={`max-w-lg mx-auto line-clamp-2 ${
                scriptKind === 'urdu'
                  ? 'font-urdu text-[24px] leading-[1.6] font-normal'
                  : scriptKind === 'arabic'
                  ? 'font-arabic text-[22px] leading-[1.55] font-bold'
                  : 'font-serif-display text-[25px] leading-[1.14] font-semibold tracking-tight [text-wrap:balance]'
              }`}
            >
              {stripEditorialMarkers(coverTitle)}
            </h4>
            {plan.author && (
              <p
                style={{ color: palette.textSecondary }}
                className="text-[10.5px] font-serif-body tracking-wide"
              >
                {plan.author}
              </p>
            )}
          </div>

          {/* Right Synopsis & Key Pillars Column */}
          <div className="col-span-5 flex flex-col justify-center space-y-3 text-left overflow-hidden" dir={overviewScript === 'latin' ? 'ltr' : 'rtl'}>
            <div className="space-y-1">
              <p
                style={{ color: palette.accent }}
                className="text-[9.5px] font-serif-body uppercase tracking-[0.2em] font-semibold"
              >
                {overviewScript === 'urdu' ? 'خلاصۂ نشست' : 'Session Frontispiece'}
              </p>
              {overviewRaw ? (
                <p
                  style={{ color: palette.textPrimary }}
                  className={
                    overviewScript === 'urdu'
                      ? 'font-urdu text-[13.5px] leading-[1.85] text-right line-clamp-4'
                      : overviewScript === 'arabic'
                      ? 'font-arabic text-[13px] leading-[1.75] text-right line-clamp-4'
                      : 'font-serif-body text-[12px] leading-[1.55] italic line-clamp-4'
                  }
                >
                  {overviewRaw}
                </p>
              ) : (
                <p style={{ color: palette.textSecondary }} className="font-serif-body text-[12px] italic">
                  {plan.bookTitle}
                </p>
              )}
            </div>

            {pillars.length > 0 && (
              <div className="pt-2 border-t space-y-1.5" style={{ borderColor: palette.border }}>
                <p
                  style={{ color: palette.accent }}
                  className="text-[9.5px] font-serif-body uppercase tracking-[0.18em] font-semibold"
                >
                  {overviewScript === 'urdu' ? 'اہم مباحث' : 'In This Reading'}
                </p>
                <ul className="space-y-1">
                  {pillars.map((pil, idx) => (
                    <li
                      key={idx}
                      style={{ color: palette.textPrimary }}
                      className={`flex items-baseline gap-1.5 ${
                        detectScriptKind(pil.title, bookHasUrdu) === 'urdu'
                          ? 'font-urdu text-[13px] leading-[1.7]'
                          : 'font-serif-body text-[11.5px] leading-[1.35]'
                      }`}
                    >
                      <span style={{ color: palette.accent }} className="text-[9px] shrink-0">◆</span>
                      <span className="line-clamp-1">{stripEditorialMarkers(pil.title)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        dir={scriptKind === 'latin' ? 'ltr' : 'rtl'}
        className={`flex-1 flex flex-col items-center justify-between text-center ${
          isTall
            ? 'px-8 py-8 space-y-5'
            : isFixedRatio
            ? 'px-8 py-5 space-y-3.5'
            : 'px-3 sm:px-10 py-6 sm:py-10 space-y-5 sm:space-y-6'
        }`}
      >
        {/* Top Book & Author Plaque */}
        <div className="w-full space-y-1.5 pt-1">
          <p
            style={{ color: palette.textSecondary }}
            className={`font-serif-display italic tracking-wide line-clamp-1 ${
              isFixedRatio ? 'text-[14px]' : 'text-[13px] sm:text-[15px]'
            }`}
          >
            {plan.bookTitle}
            {plan.author ? ` — ${plan.author}` : ''}
          </p>
          <div
            style={{ backgroundColor: palette.border }}
            className="h-px w-24 mx-auto opacity-80"
            aria-hidden="true"
          />
        </div>

        {/* Center Illuminated Crest & Session Hero Title */}
        <div className={`flex flex-col items-center ${isTall ? 'space-y-5' : 'space-y-3'}`}>
          {crestSvg}

          <div className="space-y-2">
            <div
              style={{ color: palette.accent }}
              className="flex items-center justify-center gap-3 text-[11px] font-serif-body uppercase tracking-[0.28em] font-semibold"
            >
              <span style={{ backgroundColor: palette.border }} className="h-px w-10 sm:w-16" />
              <span>
                {scriptKind === 'urdu'
                  ? `نشست ${session.sessionNumber}`
                  : `Session ${toRomanNumeral(session.sessionNumber)}`}
              </span>
              <span style={{ backgroundColor: palette.border }} className="h-px w-10 sm:w-16" />
            </div>

            <h4
              style={{ color: palette.textPrimary }}
              className={`max-w-xl mx-auto ${
                scriptKind === 'urdu'
                  ? isTall
                    ? 'font-urdu text-[38px] leading-[1.82] font-normal'
                    : isFixedRatio
                    ? 'font-urdu text-[32px] leading-[1.78] font-normal'
                    : 'font-urdu text-[28px] sm:text-[40px] leading-[1.85] font-normal'
                  : scriptKind === 'arabic'
                  ? isTall
                    ? 'font-arabic text-[36px] leading-[1.78] font-bold'
                    : isFixedRatio
                    ? 'font-arabic text-[30px] leading-[1.72] font-bold'
                    : 'font-arabic text-[28px] sm:text-[38px] leading-[1.8] font-bold'
                  : isTall
                  ? 'font-serif-display text-[38px] leading-[1.08] font-semibold tracking-tight [text-wrap:balance]'
                  : isFixedRatio
                  ? 'font-serif-display text-[32px] leading-[1.1] font-semibold tracking-tight [text-wrap:balance]'
                  : 'font-serif-display text-[28px] sm:text-[40px] leading-[1.1] font-semibold tracking-tight [text-wrap:balance]'
              }`}
            >
              {stripEditorialMarkers(coverTitle)}
            </h4>
          </div>

          {overviewRaw && (
            <div
              style={{
                backgroundColor: palette.quoteBg,
                borderColor: palette.border,
              }}
              dir={overviewScript === 'latin' ? 'ltr' : 'rtl'}
              className={`max-w-md mx-auto border-y px-4 py-2.5 ${
                isFixedRatio && !isTall ? 'line-clamp-3' : ''
              }`}
            >
              <p
                style={{ color: palette.textSecondary }}
                className={
                  overviewScript === 'urdu'
                    ? 'font-urdu text-[14.5px] leading-[1.95] text-center line-clamp-3'
                    : overviewScript === 'arabic'
                    ? 'font-arabic text-[13.5px] leading-[1.85] text-center line-clamp-3'
                    : 'font-serif-body text-[12.5px] leading-[1.58] italic text-center line-clamp-3'
                }
              >
                {overviewRaw}
              </p>
            </div>
          )}
        </div>

        {/* Bottom Chapter/Topic Highlights */}
        {pillars.length > 0 && (
          <div className="w-full pb-1">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 max-w-md mx-auto">
              {pillars.map((pil, idx) => (
                <span
                  key={idx}
                  style={{ color: palette.subheadingColor }}
                  className={`inline-flex items-center gap-1.5 ${
                    detectScriptKind(pil.title, bookHasUrdu) === 'urdu'
                      ? 'font-urdu text-[13.5px] leading-[1.7]'
                      : 'font-serif-body text-[11.5px] font-medium'
                  }`}
                >
                  {idx > 0 && (
                    <span style={{ color: palette.border }} aria-hidden="true">·</span>
                  )}
                  <span style={{ color: palette.accent }} className="text-[9px]" aria-hidden="true">◆</span>
                  <span className="truncate max-w-[200px]">{stripEditorialMarkers(pil.title)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderChapterTitleFolio = (
    part: BlcLiteralReadingPart,
    palette: CardThemePalette,
    bookHasUrdu: boolean
  ) => {
    const blocks = part.blocks || [];
    const headingBlock = blocks.find(b => b.type === 'heading') || blocks[0];
    const subheadingBlock = blocks.find(b => b.type === 'subheading');
    const headingText =
      resolveDisplayTitleForPart(part, bookHasUrdu) || headingBlock?.text || part.plainText;
    const scriptKind = detectScriptKind(headingText, bookHasUrdu);
    const isFixedRatio = ratio !== 'auto';
    const isLandscape = ratio === '16:9';

    const eyebrowText =
      part.chapterEyebrow ||
      (scriptKind === 'urdu'
        ? `باب / فصل · صفحہ ${part.startPage}`
        : scriptKind === 'arabic'
        ? `فصل · صفحة ${part.startPage}`
        : `Section Opening · Page ${part.startPage}`);

    const captionText =
      part.chapterCaption ||
      (subheadingBlock?.text ? stripEditorialMarkers(subheadingBlock.text) : '') ||
      (scriptKind === 'urdu'
        ? `صفحہ ${part.startPage} سے تسلسلِ مطالعہ`
        : scriptKind === 'arabic'
        ? `متابعة القراءة من صفحة ${part.startPage}`
        : `Reading commences on Page ${part.startPage}`);
    const captionScript = detectScriptKind(captionText, bookHasUrdu);

    return (
      <div
        dir={scriptKind === 'latin' ? 'ltr' : 'rtl'}
        className={`flex-1 flex flex-col items-center justify-center text-center px-4 ${
          isLandscape
            ? 'py-4 space-y-3'
            : isFixedRatio
            ? 'py-12 space-y-5'
            : 'py-10 sm:py-16 space-y-5'
        }`}
      >
        <div
          style={{ color: palette.accent }}
          className="flex items-center justify-center gap-3 text-sm opacity-85"
          aria-hidden="true"
        >
          <span style={{ backgroundColor: palette.border }} className="h-px w-12" />
          <span>❦</span>
          <span style={{ backgroundColor: palette.border }} className="h-px w-12" />
        </div>

        <p
          style={{ color: palette.accent }}
          className={
            scriptKind === 'urdu'
              ? 'font-urdu text-[13.5px] leading-[1.6] tracking-wide'
              : scriptKind === 'arabic'
              ? 'font-arabic text-[13px] leading-[1.6] font-semibold'
              : 'font-serif-body text-[10.5px] uppercase tracking-[0.24em] font-semibold'
          }
        >
          {stripEditorialMarkers(eyebrowText)}
        </p>

        <h5
          style={{ color: palette.textPrimary }}
          className={
            scriptKind === 'urdu'
              ? `${isLandscape ? 'text-[28px]' : isFixedRatio ? 'text-[34px]' : 'text-[28px] sm:text-[36px]'} font-urdu leading-[1.95] font-normal max-w-md`
              : scriptKind === 'arabic'
              ? `${isLandscape ? 'text-[26px]' : isFixedRatio ? 'text-[30px]' : 'text-[26px] sm:text-[32px]'} font-arabic leading-[1.9] font-bold max-w-md`
              : `${isLandscape ? 'text-[28px]' : isFixedRatio ? 'text-[34px]' : 'text-[28px] sm:text-[36px]'} font-serif-display leading-[1.18] font-semibold tracking-tight max-w-md [text-wrap:balance]`
          }
        >
          {stripEditorialMarkers(headingText)}
        </h5>

        <p
          dir={captionScript === 'latin' ? 'ltr' : 'rtl'}
          style={{ color: palette.subheadingColor }}
          className={
            captionScript === 'urdu'
              ? `${isLandscape ? 'text-[17px]' : isFixedRatio ? 'text-[19px]' : 'text-[16.5px] sm:text-[19px]'} font-urdu leading-[1.95] max-w-md line-clamp-2`
              : captionScript === 'arabic'
              ? `${isLandscape ? 'text-[15.5px]' : isFixedRatio ? 'text-[17.5px]' : 'text-[15.5px] sm:text-[17.5px]'} font-arabic font-semibold leading-[1.85] max-w-md line-clamp-2`
              : `${isFixedRatio ? 'text-[13.5px]' : 'text-[13px] sm:text-[14px]'} font-serif-body italic leading-relaxed max-w-md line-clamp-2`
          }
        >
          {stripEditorialMarkers(captionText)}
        </p>

        <div
          style={{ backgroundColor: palette.border }}
          className="h-px w-16 opacity-80"
          aria-hidden="true"
        />
      </div>
    );
  };

  const renderContextualBlocks = (
    part: BlcLiteralReadingPart,
    palette: CardThemePalette,
    partIsRtl: boolean,
    bookHasUrdu: boolean
  ) => {
    const blocks: BlcLiteralBlock[] =
      part.blocks && part.blocks.length > 0
        ? part.blocks
        : part.paragraphs.map(p => ({
            type: 'paragraph' as const,
            pageNumber: p.pageNumber,
            text: p.text,
          }));

    let hasRenderedDropCap = false;
    const isFixedRatio = ratio !== 'auto';

    return (
      <div dir={partIsRtl ? 'rtl' : 'ltr'} className="flow-root">
        {blocks.map((block, idx) => {
          const prevBlock = idx > 0 ? blocks[idx - 1] : null;
          const blockSample =
            block.type === 'list' && block.items
              ? `${block.text} ${block.items.join(' ')}`
              : block.text;

          const scriptKind = detectScriptKind(blockSample, bookHasUrdu);
          const blockRtl = scriptKind !== 'latin';
          const scriptFontClass =
            scriptKind === 'urdu'
              ? 'font-urdu'
              : scriptKind === 'arabic'
              ? 'font-arabic'
              : 'font-serif-body';

          if (block.type === 'prompt_callout') {
            const side = block.promptSide === 'left' ? 'left' : 'right';
            const titleText =
              block.promptTitle ||
              (scriptKind === 'urdu'
                ? 'نکتۂ غور'
                : scriptKind === 'arabic'
                ? 'وقفة تأمل'
                : 'Point to Ponder');

            return (
              <aside
                key={idx}
                dir={blockRtl ? 'rtl' : 'ltr'}
                style={{
                  backgroundColor: palette.quoteBg,
                  borderColor: palette.innerFrame,
                  color: palette.textPrimary,
                }}
                className={`border rounded-[2px] p-3 mt-1 mb-3 ${
                  isFixedRatio
                    ? `${ratio === '16:9' ? 'w-[224px]' : 'w-[205px]'} ${
                        side === 'left' ? 'float-left mr-4' : 'float-right ml-4'
                      }`
                    : `w-full sm:w-[205px] ${
                        side === 'left' ? 'sm:float-left sm:mr-4' : 'sm:float-right sm:ml-4'
                      }`
                }`}
              >
                <div
                  style={{
                    color: palette.accent,
                    borderColor: palette.border,
                  }}
                  className={`pb-1.5 mb-1.5 border-b flex items-center gap-1.5 ${
                    scriptKind === 'urdu'
                      ? 'font-urdu text-[13px] leading-[1.6] justify-start'
                      : scriptKind === 'arabic'
                      ? 'font-arabic text-[12px] leading-[1.5] justify-start font-bold'
                      : 'font-serif-body text-[10px] uppercase tracking-[0.14em] font-semibold'
                  }`}
                >
                  <span aria-hidden="true">✦</span>
                  <span>{titleText}</span>
                </div>
                <p
                  className={`${scriptFontClass} ${
                    scriptKind === 'urdu'
                      ? 'text-[14.5px] leading-[1.95] text-right'
                      : scriptKind === 'arabic'
                      ? 'text-[13.5px] leading-[1.85] text-right'
                      : 'text-[12.5px] leading-[1.55] italic text-left'
                  }`}
                >
                  {stripEditorialMarkers(block.text)}
                </p>
              </aside>
            );
          }

          const cleanBlockText = stripEditorialMarkers(block.text);
          const wordTotal = cleanBlockText.split(/\s+/).filter(Boolean).length;
          const canDropCap =
            block.type === 'paragraph' &&
            !block.isContinuation &&
            scriptKind === 'latin' &&
            !hasRenderedDropCap &&
            wordTotal >= 20 &&
            /^[A-Za-z]/.test(cleanBlockText.trim()) &&
            (idx === 0 || prevBlock?.type === 'heading' || prevBlock?.type === 'subheading');
          if (canDropCap) {
            hasRenderedDropCap = true;
          }

          const isConsecutiveLatinParagraph =
            block.type === 'paragraph' &&
            !block.isContinuation &&
            scriptKind === 'latin' &&
            !canDropCap &&
            prevBlock?.type === 'paragraph';
          const isWidescreenCard = isFixedRatio && ratio === '16:9';

          return (
            <div
              key={idx}
              dir={blockRtl ? 'rtl' : 'ltr'}
              className={`${isWidescreenCard ? 'mt-2.5' : 'mt-3.5'} first:mt-0 space-y-2 ${
                block.type === 'heading' || block.type === 'subheading' ? 'clear-both' : ''
              }`}
            >
              {block.type === 'heading' && (
                <div className="pt-2 pb-1 text-center space-y-1.5">
                  <h6
                    style={{ color: palette.textPrimary }}
                    className={
                      scriptKind === 'urdu'
                        ? isFixedRatio
                          ? 'font-urdu text-[22px] leading-[1.95] font-normal'
                          : 'font-urdu text-[22px] sm:text-[24px] leading-[1.95] font-normal'
                        : scriptKind === 'arabic'
                        ? isFixedRatio
                          ? 'font-arabic text-[20px] leading-[1.9] font-bold'
                          : 'font-arabic text-[20px] sm:text-[22px] leading-[1.9] font-bold'
                        : isFixedRatio
                        ? 'font-serif-display text-[20px] leading-[1.28] font-semibold tracking-tight'
                        : 'font-serif-display text-[20px] sm:text-[22px] leading-[1.28] font-semibold tracking-tight'
                    }
                  >
                    {cleanBlockText}
                  </h6>
                  <div
                    style={{ color: palette.accent }}
                    className="flex items-center justify-center gap-2 text-[11px] opacity-80"
                    aria-hidden="true"
                  >
                    <span style={{ backgroundColor: palette.border }} className="h-px w-10" />
                    <span>❦</span>
                    <span style={{ backgroundColor: palette.border }} className="h-px w-10" />
                  </div>
                </div>
              )}

              {block.type === 'subheading' && (
                <p
                  style={{ color: palette.subheadingColor, borderColor: palette.border }}
                  className={`${isWidescreenCard ? 'pt-1 pb-1' : 'pt-2 pb-1'} border-b flex items-center gap-2 ${
                    scriptKind === 'urdu'
                      ? 'font-urdu text-[18.5px] leading-[1.95] text-right font-normal'
                      : scriptKind === 'arabic'
                      ? 'font-arabic text-[16.5px] leading-[1.85] text-right font-bold'
                      : 'font-serif-display italic text-[16.5px] leading-[1.42] font-semibold text-left'
                  }`}
                >
                  <span style={{ color: palette.subheadingColor }} className="text-[10px] shrink-0 opacity-80" aria-hidden="true">
                    ◆
                  </span>
                  <span>{cleanBlockText}</span>
                </p>
              )}

              {block.type === 'quote' && (
                <blockquote
                  style={{
                    backgroundColor: palette.quoteBg,
                    borderColor: palette.border,
                    color: palette.textPrimary,
                  }}
                  className={`${isFixedRatio ? 'my-1.5 mx-2 px-4 py-2.5' : 'my-2 mx-2 sm:mx-5 px-4 py-3'} border-t border-b ${
                    scriptKind === 'urdu'
                      ? `${isFixedRatio ? 'text-[18px] leading-[2.12]' : 'text-[18.5px] leading-[2.18]'} font-urdu text-right`
                      : scriptKind === 'arabic'
                      ? `${isFixedRatio ? 'text-[16.5px] leading-[2.0]' : 'text-[17px] leading-[2.05]'} font-arabic text-center`
                      : `${isFixedRatio ? 'text-[14px] leading-[1.72]' : 'text-[14.5px] leading-[1.78]'} font-serif-body italic text-left`
                  }`}
                >
                  {renderFormattedImportantText(block.text, palette, scriptKind)}
                </blockquote>
              )}

              {block.type === 'list' && (
                <div className="space-y-1.5 py-0.5">
                  {block.text && (
                    <p
                      style={{ color: palette.textPrimary }}
                      className={`${scriptFontClass} ${
                        scriptKind === 'urdu'
                          ? `${isFixedRatio ? 'text-[18px] leading-[2.1]' : 'text-[18.5px] leading-[2.15]'} text-right`
                          : scriptKind === 'arabic'
                          ? `${isFixedRatio ? 'text-[16px] leading-[1.9]' : 'text-[16.5px] leading-[1.95]'} text-right`
                          : `${isFixedRatio ? 'text-[14.5px] leading-[1.7]' : 'text-[15px] leading-[1.75]'} font-medium text-left`
                      }`}
                    >
                      {renderFormattedImportantText(block.text, palette, scriptKind)}
                    </p>
                  )}
                  <ul
                    className={`${isFixedRatio ? 'space-y-1.5' : 'space-y-2'} ${scriptFontClass} ${
                      scriptKind === 'urdu'
                        ? `pr-4 ${isFixedRatio ? 'text-[18px] leading-[2.1]' : 'text-[18.5px] leading-[2.15]'} text-right`
                        : scriptKind === 'arabic'
                        ? `pr-4 ${isFixedRatio ? 'text-[16px] leading-[1.9]' : 'text-[16.5px] leading-[1.95]'} text-right`
                        : `pl-4 ${isFixedRatio ? 'text-[14px] leading-[1.72]' : 'text-[14.5px] leading-[1.76]'} text-left`
                    }`}
                  >
                    {(block.items && block.items.length > 0 ? block.items : [block.text]).map(
                      (item, iIdx) => (
                        <li
                          key={iIdx}
                          style={{ color: palette.textPrimary }}
                          className={`flex items-start ${isFixedRatio ? 'gap-2' : 'gap-2.5'}`}
                        >
                          <span
                            style={{ color: palette.accent }}
                            className={`shrink-0 ${
                              scriptKind === 'urdu' ? 'mt-1 text-xs' : 'mt-1.5 text-[10px]'
                            }`}
                            aria-hidden="true"
                          >
                            ❖
                          </span>
                          <span className="flex-1">
                            {renderFormattedImportantText(item, palette, detectScriptKind(item, bookHasUrdu))}
                          </span>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

              {block.type === 'paragraph' && (
                <p
                  style={{ color: palette.textPrimary }}
                  className={`${scriptFontClass} ${
                    scriptKind === 'urdu'
                      ? isFixedRatio
                        ? `${isWidescreenCard ? 'text-[18.5px] leading-[2.12]' : 'text-[19px] leading-[2.2]'} text-right`
                        : 'text-[19px] sm:text-[20px] leading-[2.22] text-right'
                      : scriptKind === 'arabic'
                      ? isFixedRatio
                        ? `${isWidescreenCard ? 'text-[16.5px] leading-[1.95]' : 'text-[17px] leading-[2.02]'} text-right`
                        : 'text-[17px] sm:text-[18px] leading-[2.05] text-right'
                      : `${
                          isFixedRatio
                            ? isWidescreenCard
                              ? 'text-[14.5px] leading-[1.76]'
                              : 'text-[15px] leading-[1.82]'
                            : 'text-[15px] sm:text-[15.5px] leading-[1.84]'
                        } ${wordTotal >= 22 ? 'text-justify' : 'text-left'} ${
                          canDropCap ? 'book-drop-cap' : ''
                        } ${isConsecutiveLatinParagraph ? 'indent-5' : ''}`
                  }`}
                >
                  {renderFormattedImportantText(block.text, palette, scriptKind)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoadingPages) {
    return (
      <div className="bg-[#FBF7EE] bg-paper-grain border border-[#E2D4C3] rounded-xl p-10 text-center space-y-3">
        <Loader2 className="w-7 h-7 text-[#8C5A2B] animate-spin mx-auto" />
        <p className="text-sm font-serif-body text-[#2A1E17]">
          Loading literal reading text for Pages {session.startPage}–{session.endPage}...
        </p>
      </div>
    );
  }

  if (!pages || pages.length === 0) {
    return (
      <div className="bg-[#FBF7EE] bg-paper-grain border border-[#E2D4C3] rounded-xl p-8 text-center space-y-4">
        <div className="w-11 h-11 rounded-xl bg-[#F4EDE2] border border-[#E2D4C3] text-[#8C5A2B] flex items-center justify-center mx-auto">
          <BookOpen className="w-5 h-5" />
        </div>
        <div className="max-w-lg mx-auto space-y-1.5">
          <h4 className="text-lg font-serif-display font-bold text-[#2A1E17]">
            Attach Book File to Load Literal Reading Text
          </h4>
          <p className="text-xs text-[#5E5043] leading-relaxed">
            This saved BLC circle does not have its literal book pages stored in the database yet. Select the PDF/TXT file once to typeset and save Pages {session.startPage}–{session.endPage} into book-formatted reading folios and PNG cards.
          </p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.epub"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            disabled={isAttachingFile}
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 text-xs font-semibold text-[#FBF7EE] bg-[#2A1E17] hover:bg-[#3D2C22] disabled:opacity-50 rounded-lg inline-flex items-center gap-2 transition-colors"
          >
            {isAttachingFile ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4A373]" />
                <span>Indexing book pages...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5 text-[#D4A373]" />
                <span>Attach Book File ({plan.fileName})</span>
              </>
            )}
          </button>
        </div>

        {attachError && <p className="text-xs text-red-700">{attachError}</p>}
      </div>
    );
  }

  if (parts.length === 0) {
    return (
      <div className="bg-[#FBF7EE] bg-paper-grain border border-[#E2D4C3] rounded-xl p-8 text-center text-sm font-serif-body text-[#5E5043]">
        No extractable literal text was found inside Pages {session.startPage}–{session.endPage}.
      </div>
    );
  }

  const isPartRtl = activePart ? hasRtlScript(activePart.plainText) : false;
  const activeDisplayTitle = activePart
    ? resolveDisplayTitleForPart(activePart, sessionHasUrduContext)
    : undefined;
  const activeTitleScript = activeDisplayTitle
    ? detectScriptKind(activeDisplayTitle, sessionHasUrduContext)
    : 'latin';

  const getCardContainerStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      backgroundColor: theme.bg,
      backgroundImage: paperGrainBg || undefined,
      backgroundRepeat: 'repeat',
      color: theme.textPrimary,
      borderColor: theme.border,
    };
    if (ratio === 'auto') {
      if (activePart?.isChapterTitlePage || activePart?.isSessionCoverPage) {
        base.minHeight = '560px';
      }
      return base;
    }
    const spec = CARD_SPECS[ratio];
    base.width = `${spec.width}px`;
    base.height = `${spec.height}px`;
    base.aspectRatio = spec.aspect;
    base.overflow = 'hidden';
    return base;
  };

  return (
    <div className="space-y-5">
      {/* Control Strip */}
      <section className="bg-[#FBF7EE]/90 border border-[#E2D4C3] rounded-xl p-3.5 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#E8DDCB]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#8C5A2B]">
              Book Folio Edition · Literal Session Reading
            </p>
            <h4 className="text-lg sm:text-xl font-serif-display font-bold text-[#2A1E17] mt-0.5 tabular-nums">
              Pages {session.startPage}–{session.endPage} ·{' '}
              {ratio !== 'auto'
                ? `${parts.length} Adaptive Folios (${ratio})`
                : `${parts.length} Book Folios`}
            </h4>
          </div>

          <div className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex p-1 bg-[#F4EDE2] border border-[#D8C8B4] rounded-lg self-start">
            <button
              type="button"
              onClick={() => setViewMode('card_deck')}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                viewMode === 'card_deck'
                  ? 'bg-[#2A1E17] text-[#FBF7EE]'
                  : 'text-[#5E5043] hover:text-[#2A1E17]'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Book Folio &amp; PNG</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all_parts')}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                viewMode === 'all_parts'
                  ? 'bg-[#2A1E17] text-[#FBF7EE]'
                  : 'text-[#5E5043] hover:text-[#2A1E17]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Full Book View ({baseParts.length})</span>
            </button>
          </div>
        </div>

        {/* Contextual Organization Toolbar */}
        <div className="bg-[#F4EDE2]/70 border border-[#E2D4C3] rounded-lg p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-[#2A1E17]">
              {aiParts && useAiFormatting
                ? 'Book-Typeset Contextual AI Active (Jameel Noori Nastaliq / Serif · Dedicated Chapter Pages)'
                : 'Book-Typeset Local Structuring Active (Jameel Noori Nastaliq & Serif)'}
            </p>
            <p className="text-[11px] text-[#5E5043]">
              {isOrganizingAi && aiProgress
                ? aiProgress
                : hasLegacyEnglishTitlesOnUrdu
                ? 'Click "Re-organize Like a Book" to refresh earlier saved page titles into Urdu script.'
                : 'Structures literal passages into book folios with dedicated full chapter title pages, language-matched titles, and Nastaliq / Serif typography.'}
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-0.5">
              <label className="inline-flex items-center gap-2 cursor-pointer text-[11px] font-medium text-[#2A1E17]">
                <input
                  type="checkbox"
                  checked={fixGrammar}
                  disabled={isOrganizingAi || isExporting}
                  onChange={e => setFixGrammar(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#8C5A2B] rounded"
                />
                <span>Fix transcription, OCR &amp; grammar errors</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer text-[11px] font-medium text-[#2A1E17]">
                <input
                  type="checkbox"
                  checked={writeContentInUrdu}
                  disabled={isOrganizingAi || isExporting}
                  onChange={e => setWriteContentInUrdu(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#8C5A2B] rounded"
                />
                <span>Write content in Urdu (اردو)</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer text-[11px] font-medium text-[#2A1E17]">
                <input
                  type="checkbox"
                  checked={injectPrompts}
                  disabled={isExporting}
                  onChange={e => setInjectPrompts(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#8C5A2B] rounded"
                />
                <span>Inject discussion prompts in reading</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {aiParts && aiParts.length > 0 && (
              <div className="inline-flex p-0.5 bg-[#E8DDCB] border border-[#D8C8B4] rounded-md text-[11px]">
                <button
                  type="button"
                  disabled={isOrganizingAi || isExporting}
                  onClick={() => setUseAiFormatting(true)}
                  className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                    useAiFormatting
                      ? 'bg-[#2A1E17] text-[#FBF7EE]'
                      : 'text-[#5E5043] hover:text-[#2A1E17]'
                  }`}
                >
                  Contextual AI
                </button>
                <button
                  type="button"
                  disabled={isOrganizingAi || isExporting}
                  onClick={() => setUseAiFormatting(false)}
                  className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                    !useAiFormatting
                      ? 'bg-[#2A1E17] text-[#FBF7EE]'
                      : 'text-[#5E5043] hover:text-[#2A1E17]'
                  }`}
                >
                  Local Smart
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={isOrganizingAi || isExporting}
              onClick={handleOrganizeContextually}
              className="px-3 py-1.5 text-xs font-semibold text-[#FBF7EE] bg-[#8C5A2B] hover:bg-[#74481F] disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5"
            >
              {isOrganizingAi ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Formatting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{aiParts ? 'Re-organize Like a Book' : 'Organize Like a Book (AI)'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {aiError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <span>{aiError}</span>
          </div>
        )}

        {/* Configuration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
          <div>
            <label className="block font-semibold text-[#2A1E17] mb-1">
              Folio Length (Words / Page)
            </label>
            <select
              value={partSize}
              disabled={isExporting || isOrganizingAi}
              onChange={e => handleSizeChange(e.target.value as BlcLiteralPartSize)}
              className="w-full min-h-[42px] px-3 py-2 bg-white border border-[#D8C8B4] rounded-lg text-[#2A1E17] font-medium text-xs sm:text-sm"
            >
              <option value="compact">Pocket Folio (~145 words · Mobile PNG)</option>
              <option value="standard">Octavo Page (~230 words · Balanced)</option>
              <option value="extended">Study Leaf (~340 words · Long Reading)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#2A1E17] mb-1">
              Paper &amp; Ink Palette
            </label>
            <select
              value={themeKey}
              disabled={isExporting}
              onChange={e => setThemeKey(e.target.value as PngCardTheme)}
              className="w-full min-h-[42px] px-3 py-2 bg-white border border-[#D8C8B4] rounded-lg text-[#2A1E17] font-medium text-xs sm:text-sm"
            >
              {Object.entries(THEMES).map(([k, val]) => (
                <option key={k} value={k}>
                  {val.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#2A1E17] mb-1">
              PNG Frame Sizing &amp; Aspect Ratio
            </label>
            <select
              value={ratio}
              disabled={isExporting}
              onChange={e => {
                setRatio(e.target.value as PngRatio);
                setIsMobileZoomed(false);
              }}
              className="w-full min-h-[42px] px-3 py-2 bg-white border border-[#D8C8B4] rounded-lg text-[#2A1E17] font-medium text-xs sm:text-sm"
            >
              <option value="auto">Auto-Fit Book Page (Zero Cutoff)</option>
              <option value="4:5">4:5 Tall Folio (Instagram / Feed)</option>
              <option value="9:16">9:16 Vertical (WhatsApp Status)</option>
              <option value="16:9">16:9 Widescreen (Presentation / Slide)</option>
            </select>
          </div>
        </div>

        {/* Batch & Session Export Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-[#E8DDCB]">
          <div className="grid grid-cols-1 sm:flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              disabled={isExporting || isOrganizingAi}
              onClick={handleDownloadAllPngs}
              className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-[#FBF7EE] bg-[#2A1E17] hover:bg-[#3D2C22] disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-1.5 active:bg-[#1A120E]"
            >
              {isExporting && exportProgress ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4A373]" />
                  <span>{exportProgress}</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-[#D4A373]" />
                  <span>Download All {parts.length} Folios as PNGs</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isExporting || isOrganizingAi}
              onClick={handleDownloadSessionTxt}
              className="min-h-[40px] px-3 py-2 text-xs font-semibold text-[#2A1E17] bg-[#F4EDE2] hover:bg-[#E8DDCB] border border-[#D8C8B4] rounded-lg transition-colors flex items-center justify-center gap-1.5 active:bg-[#E8DDCB]"
            >
              <FileText className="w-3.5 h-3.5 text-[#8C5A2B]" />
              <span>Download Text (.txt)</span>
            </button>
          </div>

          {statusFeedback && (
            <span className="text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-md flex items-center gap-1.5 self-start sm:self-auto">
              <Check className="w-3.5 h-3.5" />
              {statusFeedback}
            </span>
          )}
        </div>
      </section>

      {/* VIEW MODE 1: Book Folio Studio & PNG Export */}
      {viewMode === 'card_deck' && activePart && (
        <div className="space-y-4">
          {/* Part Jumper & Single-Part Actions */}
          <div className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                disabled={isExporting || activePartIdx === 0}
                onClick={() => setActivePartIdx(prev => Math.max(0, prev - 1))}
                className="min-h-[38px] min-w-[38px] p-2 rounded-lg bg-[#FBF7EE] border border-[#D8C8B4] text-[#2A1E17] disabled:opacity-40 hover:bg-[#E8DDCB] shrink-0 flex items-center justify-center active:bg-[#E8DDCB]"
                aria-label="Previous reading folio"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="min-w-0 flex-1">
                <span className="text-xs sm:text-sm font-serif-display font-bold text-[#2A1E17] tabular-nums block truncate">
                  Folio {toRomanNumeral(activePart.partNumber)} of {toRomanNumeral(activePart.totalParts)}
                  {activePart.slideSplitTotal && activePart.slideSplitTotal > 1
                    ? ` · Part ${activePart.slideSplitIndex}/${activePart.slideSplitTotal}`
                    : ''}
                  {activePart.isSessionCoverPage
                    ? ' · Session Summary'
                    : activePart.isChapterTitlePage
                    ? ' · Chapter Title Page'
                    : ''}
                  {activeDisplayTitle ? ` · ${activeDisplayTitle}` : ''}
                </span>
                <span className="text-[10.5px] sm:text-[11px] text-[#5E5043] tabular-nums block">
                  {activePart.startPage === activePart.endPage
                    ? `Page ${activePart.startPage}`
                    : `Pages ${activePart.startPage}–${activePart.endPage}`} · {activePart.wordCount} words
                  {ratio !== 'auto' ? ` · ${ratio} Adaptive Boundary` : ''}
                </span>
              </div>

              <button
                type="button"
                disabled={isExporting || activePartIdx >= parts.length - 1}
                onClick={() => setActivePartIdx(prev => Math.min(parts.length - 1, prev + 1))}
                className="min-h-[38px] min-w-[38px] p-2 rounded-lg bg-[#FBF7EE] border border-[#D8C8B4] text-[#2A1E17] disabled:opacity-40 hover:bg-[#E8DDCB] shrink-0 flex items-center justify-center active:bg-[#E8DDCB]"
                aria-label="Next reading folio"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full sm:w-auto grid grid-cols-3 sm:flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={isExporting}
                onClick={() => handleCopyPartText(activePartIdx)}
                className="min-h-[38px] px-2 py-1.5 text-xs font-medium text-[#2A1E17] bg-[#FBF7EE] hover:bg-[#E8DDCB] border border-[#D8C8B4] rounded-lg flex items-center justify-center gap-1.5 active:bg-[#E8DDCB]"
              >
                <Copy className="w-3.5 h-3.5 text-[#8C5A2B] shrink-0" />
                <span className="truncate">Copy Text</span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={handleCopyCurrentPng}
                className="min-h-[38px] px-2 py-1.5 text-xs font-medium text-[#2A1E17] bg-[#FBF7EE] hover:bg-[#E8DDCB] border border-[#D8C8B4] rounded-lg flex items-center justify-center gap-1.5 active:bg-[#E8DDCB]"
              >
                <ImageIcon className="w-3.5 h-3.5 text-[#8C5A2B] shrink-0" />
                <span className="truncate">Copy PNG</span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={handleDownloadCurrentPng}
                className="min-h-[38px] px-2.5 py-1.5 text-xs font-semibold text-[#FBF7EE] bg-[#2A1E17] hover:bg-[#3D2C22] disabled:opacity-50 rounded-lg flex items-center justify-center gap-1.5 active:bg-[#1A120E]"
              >
                <Download className="w-3.5 h-3.5 text-[#D4A373] shrink-0" />
                <span className="truncate">Save PNG</span>
              </button>
            </div>
          </div>

          {/* Chapter / Folio Selector Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none touch-pan-x">
            {parts.map((part, idx) => {
              const isSelected = idx === activePartIdx;
              const chipTitle = resolveDisplayTitleForPart(part, sessionHasUrduContext);
              return (
                <button
                  key={part.partNumber}
                  type="button"
                  disabled={isExporting}
                  onClick={() => setActivePartIdx(idx)}
                  className={`min-h-[34px] px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 tabular-nums max-w-[200px] sm:max-w-[240px] truncate ${
                    isSelected
                      ? 'bg-[#2A1E17] text-[#FBF7EE] border-[#2A1E17]'
                      : 'bg-[#FBF7EE] text-[#5E5043] border-[#D8C8B4] hover:border-[#8C5A2B]'
                  }`}
                  title={chipTitle || `Folio ${toRomanNumeral(part.partNumber)}`}
                >
                  {toRomanNumeral(part.partNumber)}
                  {part.slideSplitTotal && part.slideSplitTotal > 1
                    ? ` (${part.slideSplitIndex}/${part.slideSplitTotal})`
                    : ''}
                  {part.isSessionCoverPage
                    ? ' [Summary]'
                    : part.isChapterTitlePage
                    ? ' [Title]'
                    : ''}
                  {chipTitle ? ` · ${chipTitle}` : ''}
                </button>
              );
            })}
          </div>

          {/* Book Folio Canvas & Capture Target */}
          <div
            ref={canvasOuterRef}
            className="bg-[#E4D7C4]/55 bg-paper-grain border border-[#D8C8B2] rounded-xl p-2.5 sm:p-6 overflow-hidden"
          >
            <div
              ref={canvasMeasureRef}
              className="w-full flex flex-col items-center justify-start space-y-2.5"
            >
            {ratio !== 'auto' && CARD_SPECS[ratio] && (
              <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs font-sans-ui text-[#7A6B5D] px-0.5">
                <span className="font-semibold text-[#8C5A2B] uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>{CARD_SPECS[ratio].label}</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#FBF7EE] border border-[#D8C8B4] text-[#2A1E17]">
                    {CARD_SPECS[ratio].aspect}
                  </span>
                </span>

                {(() => {
                  const effW = canvasWidth > 0 ? canvasWidth : (typeof window !== 'undefined' ? Math.max(260, window.innerWidth - 56) : CARD_SPECS[ratio].width);
                  return effW < CARD_SPECS[ratio].width ? (
                    <button
                      type="button"
                      onClick={() => setIsMobileZoomed(prev => !prev)}
                      className="min-h-[32px] px-2.5 py-1 text-[11px] font-semibold text-[#2A1E17] bg-[#FBF7EE] hover:bg-[#E8DDCB] border border-[#D8C8B4] rounded-md transition-colors flex items-center gap-1 active:bg-[#E8DDCB]"
                    >
                      {isMobileZoomed ? (
                        <>
                          <Minimize2 className="w-3 h-3 text-[#8C5A2B]" />
                          <span>Fit Ratio</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="w-3 h-3 text-[#8C5A2B]" />
                          <span>Inspect 100%</span>
                        </>
                      )}
                    </button>
                  ) : null;
                })()}
              </div>
            )}

            {/* If Mobile Zoomed: Horizontally scrollable unscaled canvas */}
            {ratio !== 'auto' && CARD_SPECS[ratio] && isMobileZoomed ? (
              <div className="w-full overflow-x-auto overflow-y-hidden pb-2 flex justify-start sm:justify-center touch-pan-x scrollbar-none">
                <div
                  style={{
                    width: `${CARD_SPECS[ratio].width}px`,
                    height: `${CARD_SPECS[ratio].height}px`,
                    aspectRatio: CARD_SPECS[ratio].aspect,
                  }}
                  className="book-folio-shadow rounded-[3px] overflow-hidden shrink-0"
                >
                  <div
                    ref={cardRef}
                    style={getCardContainerStyle()}
                    className="w-full h-full border p-4 flex flex-col justify-between select-text"
                  >
                    {/* Fine-Press Inner Margin Frame */}
                    <div
                      style={{ borderColor: theme.innerFrame }}
                      className={`border flex-1 flex flex-col justify-between overflow-hidden ${
                        ratio === '16:9' ? 'px-8 py-4' : 'px-8 py-6'
                      }`}
                    >
                      {activePart.isSessionCoverPage ? (
                        renderSessionCoverGraphic(activePart, theme, sessionHasUrduContext)
                      ) : activePart.isChapterTitlePage ? (
                        renderChapterTitleFolio(activePart, theme, sessionHasUrduContext)
                      ) : (
                        <>
                          {activeDisplayTitle && (
                            <div
                              className={`${ratio === '16:9' ? 'pb-2 mb-2' : 'pb-3 mb-3'} border-b text-center shrink-0`}
                              style={{ borderColor: theme.border }}
                            >
                              <h5
                                style={{ color: theme.textPrimary }}
                                dir={activeTitleScript === 'latin' ? 'ltr' : 'rtl'}
                                className={
                                  activeTitleScript === 'urdu'
                                    ? `${ratio === '16:9' ? 'text-[21px] leading-[1.82]' : 'text-[24px] leading-[1.95]'} font-urdu font-normal`
                                    : activeTitleScript === 'arabic'
                                    ? `${ratio === '16:9' ? 'text-[19.5px] leading-[1.75]' : 'text-[22px] leading-[1.85]'} font-arabic font-bold`
                                    : `${ratio === '16:9' ? 'text-[21px] leading-[1.2]' : 'text-[24px] leading-[1.22]'} font-serif-display font-semibold tracking-tight`
                                }
                              >
                                {activeDisplayTitle}
                              </h5>
                            </div>
                          )}

                          <div className="py-0.5 flex-1 overflow-hidden">
                            {renderContextualBlocks(activePart, theme, isPartRtl, sessionHasUrduContext)}
                          </div>
                        </>
                      )}

                      {/* Book Folio Footer */}
                      <div
                        style={{
                          borderColor: theme.border,
                          color: theme.textSecondary,
                        }}
                        className={`${
                          ratio === '16:9' ? 'pt-2 mt-2' : 'pt-3 mt-3'
                        } border-t ${
                          activePart.isSessionCoverPage
                            ? 'flex items-center justify-between gap-2'
                            : 'grid grid-cols-3 items-center gap-2'
                        } text-[10.5px] font-serif-body tabular-nums shrink-0`}
                      >
                        <span
                          style={{ color: theme.accent }}
                          className="text-left font-semibold tracking-wide whitespace-nowrap"
                        >
                          The Wisdom Lounge
                        </span>
                        <span className={`truncate font-medium ${activePart.isSessionCoverPage ? 'text-right' : 'text-center'}`}>
                          {plan.bookTitle}
                        </span>
                        {!activePart.isSessionCoverPage && (
                          <span className="text-right whitespace-nowrap">
                            Session {session.sessionNumber} · Folio {toRomanNumeral(activePart.partNumber)} / {toRomanNumeral(activePart.totalParts)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : ratio !== 'auto' && CARD_SPECS[ratio] ? (
              /* Sticking Mathematically to Aspect Ratio on all devices */
              (() => {
                const spec = CARD_SPECS[ratio];
                const fallbackW =
                  typeof window !== 'undefined'
                    ? Math.max(260, window.innerWidth - 56)
                    : spec.width;
                const availW = canvasWidth > 0 ? canvasWidth : fallbackW;
                const scale = Math.min(1, availW / spec.width);
                const displayW = Math.floor(scale < 1 ? availW : spec.width);
                const scaledHeight = Math.round((displayW * spec.height) / spec.width);

                return (
                  <div
                    style={{
                      width: `${displayW}px`,
                      height: `${scaledHeight}px`,
                      aspectRatio: spec.aspect,
                    }}
                    className="book-folio-shadow rounded-[3px] overflow-hidden relative shrink-0 transition-all duration-200"
                  >
                    <div
                      ref={cardRef}
                      style={{
                        ...getCardContainerStyle(),
                        transform: scale < 1 ? `scale(${displayW / spec.width})` : undefined,
                        transformOrigin: 'top left',
                      }}
                      className={`border p-4 flex flex-col justify-between select-text ${
                        scale < 1 ? 'absolute top-0 left-0' : 'w-full h-full'
                      }`}
                    >
                      {/* Fine-Press Inner Margin Frame */}
                      <div
                        style={{ borderColor: theme.innerFrame }}
                        className={`border flex-1 flex flex-col justify-between overflow-hidden ${
                          ratio === '16:9' ? 'px-8 py-4' : 'px-8 py-6'
                        }`}
                      >
                        {activePart.isSessionCoverPage ? (
                          renderSessionCoverGraphic(activePart, theme, sessionHasUrduContext)
                        ) : activePart.isChapterTitlePage ? (
                          renderChapterTitleFolio(activePart, theme, sessionHasUrduContext)
                        ) : (
                          <>
                            {activeDisplayTitle && (
                              <div
                                className={`${ratio === '16:9' ? 'pb-2 mb-2' : 'pb-3 mb-3'} border-b text-center shrink-0`}
                                style={{ borderColor: theme.border }}
                              >
                                <h5
                                  style={{ color: theme.textPrimary }}
                                  dir={activeTitleScript === 'latin' ? 'ltr' : 'rtl'}
                                  className={
                                    activeTitleScript === 'urdu'
                                      ? `${ratio === '16:9' ? 'text-[21px] leading-[1.82]' : 'text-[24px] leading-[1.95]'} font-urdu font-normal`
                                      : activeTitleScript === 'arabic'
                                      ? `${ratio === '16:9' ? 'text-[19.5px] leading-[1.75]' : 'text-[22px] leading-[1.85]'} font-arabic font-bold`
                                      : `${ratio === '16:9' ? 'text-[21px] leading-[1.2]' : 'text-[24px] leading-[1.22]'} font-serif-display font-semibold tracking-tight`
                                  }
                                >
                                  {activeDisplayTitle}
                                </h5>
                              </div>
                            )}

                            <div className="py-0.5 flex-1 overflow-hidden">
                              {renderContextualBlocks(activePart, theme, isPartRtl, sessionHasUrduContext)}
                            </div>
                          </>
                        )}

                        {/* Book Folio Footer */}
                        <div
                          style={{
                            borderColor: theme.border,
                            color: theme.textSecondary,
                          }}
                          className={`${
                            ratio === '16:9' ? 'pt-2 mt-2' : 'pt-3 mt-3'
                          } border-t ${
                            activePart.isSessionCoverPage
                              ? 'flex items-center justify-between gap-2'
                              : 'grid grid-cols-3 items-center gap-2'
                          } text-[10.5px] font-serif-body tabular-nums shrink-0`}
                        >
                          <span
                            style={{ color: theme.accent }}
                            className="text-left font-semibold tracking-wide whitespace-nowrap"
                          >
                            The Wisdom Lounge
                          </span>
                          <span className={`truncate font-medium ${activePart.isSessionCoverPage ? 'text-right' : 'text-center'}`}>
                            {plan.bookTitle}
                          </span>
                          {!activePart.isSessionCoverPage && (
                            <span className="text-right whitespace-nowrap">
                              Session {session.sessionNumber} · Folio {toRomanNumeral(activePart.partNumber)} / {toRomanNumeral(activePart.totalParts)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              /* Auto-Fit Book Page: Flowing naturally with zero cutoff */
              <div className="w-full max-w-[560px] book-folio-shadow rounded-[3px] overflow-hidden">
                <div
                  ref={cardRef}
                  style={getCardContainerStyle()}
                  className="w-full border p-3 sm:p-4 flex flex-col justify-between select-text"
                >
                  {/* Fine-Press Inner Margin Frame */}
                  <div
                    style={{ borderColor: theme.innerFrame }}
                    className="border flex-1 flex flex-col justify-between px-4 sm:px-8 py-4 sm:py-7"
                  >
                    {activePart.isSessionCoverPage ? (
                      renderSessionCoverGraphic(activePart, theme, sessionHasUrduContext)
                    ) : activePart.isChapterTitlePage ? (
                      renderChapterTitleFolio(activePart, theme, sessionHasUrduContext)
                    ) : (
                      <>
                        {activeDisplayTitle && (
                          <div
                            className="pb-3.5 mb-4 border-b text-center"
                            style={{ borderColor: theme.border }}
                          >
                            <h5
                              style={{ color: theme.textPrimary }}
                              dir={activeTitleScript === 'latin' ? 'ltr' : 'rtl'}
                              className={
                                activeTitleScript === 'urdu'
                                  ? 'font-urdu text-[21px] sm:text-[24px] leading-[1.95] font-normal'
                                  : activeTitleScript === 'arabic'
                                  ? 'font-arabic text-[19px] sm:text-[22px] leading-[1.85] font-bold'
                                  : 'font-serif-display text-[20px] sm:text-[24px] leading-[1.22] font-semibold tracking-tight'
                              }
                            >
                              {activeDisplayTitle}
                            </h5>
                          </div>
                        )}

                        <div className="py-1 flex-1">
                          {renderContextualBlocks(activePart, theme, isPartRtl, sessionHasUrduContext)}
                        </div>
                      </>
                    )}

                    {/* Minimal Book Folio Footer (responsive on narrow mobile) */}
                    <div
                      style={{
                        borderColor: theme.border,
                        color: theme.textSecondary,
                      }}
                      className={`pt-3 mt-4 border-t ${
                        activePart.isSessionCoverPage
                          ? 'flex items-center justify-between gap-2'
                          : 'flex flex-wrap sm:grid sm:grid-cols-3 items-center justify-between gap-x-2 gap-y-1'
                      } text-[9.5px] sm:text-[10.5px] font-serif-body tabular-nums`}
                    >
                      <span
                        style={{ color: theme.accent }}
                        className="text-left font-semibold tracking-wide whitespace-nowrap"
                      >
                        The Wisdom Lounge
                      </span>
                      <span
                        className={`truncate font-medium ${
                          activePart.isSessionCoverPage
                            ? 'text-right max-w-[180px] sm:max-w-none'
                            : 'text-center max-w-[140px] sm:max-w-none'
                        }`}
                      >
                        {plan.bookTitle}
                      </span>
                      {!activePart.isSessionCoverPage && (
                        <span className="text-right whitespace-nowrap">
                          Session {session.sessionNumber} · Folio {toRomanNumeral(activePart.partNumber)} / {toRomanNumeral(activePart.totalParts)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: Continuous Book & Table of Contents */}
      {viewMode === 'all_parts' && (
        <div className="space-y-6 max-w-3xl mx-auto">
          {/* Book Table of Contents / Index Card */}
          <nav
            aria-label="Session book contents"
            style={{
              backgroundColor: THEMES.parchment.bg,
              backgroundImage: getRasterPaperGrainUrl(false, THEMES.parchment.grainAlpha) || undefined,
              borderColor: THEMES.parchment.border,
            }}
            className="border rounded-[4px] book-folio-shadow p-4 sm:p-8 space-y-4"
          >
            <div className="text-center border-b border-[#D8C8B2] pb-4 space-y-1">
              <p className="text-[10px] font-serif-body uppercase tracking-[0.18em] text-[#824F22]">
                {plan.bookTitle}
                {plan.author ? ` · ${plan.author}` : ''}
              </p>
              <h5 className="text-2xl font-serif-display font-semibold text-[#241912]">
                Contents — Session {session.sessionNumber}
              </h5>
              <p className="text-xs font-serif-body italic text-[#5B4C3E] tabular-nums">
                {baseParts.length} Book Folios
              </p>
            </div>

            <ol className="space-y-2.5">
              {baseParts.map(part => {
                const validTitle = resolveDisplayTitleForPart(part, sessionHasUrduContext);
                const titleIsUrdu =
                  hasAnyUrduLetters(validTitle || '') ||
                  (hasRtlScript(validTitle || '') && sessionHasUrduContext);
                return (
                  <li key={part.partNumber}>
                    <a
                      href={`#blc-book-folio-${part.partNumber}`}
                      className="group flex items-baseline gap-2.5 text-sm hover:text-[#824F22] transition-colors"
                    >
                      <span className="font-serif-display font-semibold text-[#824F22] w-8 shrink-0 tabular-nums">
                        {toRomanNumeral(part.partNumber)}.
                      </span>
                      <span
                        dir={titleIsUrdu ? 'rtl' : 'ltr'}
                        className={`text-[#241912] group-hover:text-[#824F22] ${
                          titleIsUrdu
                            ? 'font-urdu text-[17px] leading-[1.8]'
                            : 'font-serif-body font-medium'
                        }`}
                      >
                        {validTitle || `Folio ${toRomanNumeral(part.partNumber)}`}
                      </span>
                      <span className="flex-1 border-b border-dotted border-[#CBBAA3] mx-1" />
                      <span className="text-xs font-serif-body italic text-[#5B4C3E] tabular-nums shrink-0">
                        {part.isSessionCoverPage
                          ? 'Session Summary'
                          : part.isChapterTitlePage
                          ? 'Chapter Title'
                          : `Folio ${toRomanNumeral(part.partNumber)}`}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Bound Folios */}
          {baseParts.map((part, idx) => {
            const partRtl = hasRtlScript(part.plainText);
            const validTitle = resolveDisplayTitleForPart(part, sessionHasUrduContext);
            const titleScript = validTitle
              ? detectScriptKind(validTitle, sessionHasUrduContext)
              : 'latin';

            return (
              <article
                id={`blc-book-folio-${part.partNumber}`}
                key={part.partNumber}
                style={{
                  backgroundColor: theme.bg,
                  backgroundImage: paperGrainBg || undefined,
                  borderColor: theme.border,
                  color: theme.textPrimary,
                }}
                className="border rounded-[4px] book-folio-shadow p-2.5 sm:p-5 scroll-mt-24"
              >
                <div
                  style={{ borderColor: theme.innerFrame }}
                  className="border px-3.5 sm:px-8 py-4 sm:py-7 space-y-5"
                >
                  {/* Quick Actions Row */}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyPartText(idx, true)}
                      className="px-2.5 py-1 text-xs font-medium text-[#2A1E17] bg-[#FBF7EE] hover:bg-[#E8DDCB] border border-[#D8C8B4] rounded-md flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3 text-[#8C5A2B]" />
                      <span>Copy</span>
                    </button>
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => handleExportSingleFromList(idx)}
                      className="px-2.5 py-1 text-xs font-semibold text-[#FBF7EE] bg-[#2A1E17] hover:bg-[#3D2C22] disabled:opacity-50 rounded-md flex items-center gap-1"
                    >
                      <Download className="w-3 h-3 text-[#D4A373]" />
                      <span>Save PNG</span>
                    </button>
                  </div>

                  {part.isSessionCoverPage ? (
                    renderSessionCoverGraphic(part, theme, sessionHasUrduContext)
                  ) : part.isChapterTitlePage ? (
                    renderChapterTitleFolio(part, theme, sessionHasUrduContext)
                  ) : (
                    <>
                      {validTitle && (
                        <h5
                          style={{ color: theme.textPrimary, borderColor: theme.border }}
                          dir={titleScript === 'latin' ? 'ltr' : 'rtl'}
                          className={`text-center pb-3 border-b ${
                            titleScript === 'urdu'
                              ? 'font-urdu text-[22px] sm:text-[24px] leading-[1.95]'
                              : titleScript === 'arabic'
                              ? 'font-arabic text-[20px] leading-[1.85] font-bold'
                              : 'font-serif-display text-2xl font-semibold tracking-tight'
                          }`}
                        >
                          {validTitle}
                        </h5>
                      )}

                      {renderContextualBlocks(part, theme, partRtl, sessionHasUrduContext)}
                    </>
                  )}

                  {/* Minimal Book Folio Footer */}
                  <div
                    style={{
                      borderColor: theme.border,
                      color: theme.textSecondary,
                    }}
                    className={`pt-3 border-t ${
                      part.isSessionCoverPage
                        ? 'flex items-center justify-between gap-2'
                        : 'flex flex-wrap sm:grid sm:grid-cols-3 items-center justify-between gap-x-2 gap-y-1'
                    } text-[10px] sm:text-[11px] font-serif-body tabular-nums`}
                  >
                    <span style={{ color: theme.accent }} className="text-left font-semibold whitespace-nowrap">
                      The Wisdom Lounge
                    </span>
                    <span
                      className={`truncate font-medium ${
                        part.isSessionCoverPage
                          ? 'text-right max-w-[180px] sm:max-w-none'
                          : 'text-center max-w-[140px] sm:max-w-none'
                      }`}
                    >
                      {plan.bookTitle}
                    </span>
                    {!part.isSessionCoverPage && (
                      <span className="text-right whitespace-nowrap">
                        Session {session.sessionNumber} · Folio {toRomanNumeral(part.partNumber)} / {toRomanNumeral(part.totalParts)}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
