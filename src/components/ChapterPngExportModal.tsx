import React, { useState, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import { BookAnalysis, ChapterSummary } from '../types/book';
import { 
  X, 
  Download, 
  Sparkles, 
  Check, 
  Copy, 
  Loader2, 
  Image as ImageIcon, 
  Layers, 
  Quote, 
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Palette,
  Type,
  Maximize2,
  Columns,
  Grid,
  ListFilter
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { useLanguage } from '../context/LanguageContext';
import { getSynchronousUrduContent, translateParagraphToUrdu } from '../utils/urduContentTranslator';
import {
  EditorialScriptKind,
  renderFormattedImportantText,
} from '../utils/editorialFormatting';
import {
  ModalSlideChunk,
  paginateModalChunksToCanvasBoundary,
} from '../utils/canvasSlidePaginator';
import { getBookFontEmbedCss } from '../utils/fontEmbedHelper';
import { dataUrlToBlob } from '../utils/fetchWithRetry';

interface ChapterPngExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: BookAnalysis;
  initialChapterNumber?: number;
}

type CardTheme = 'espresso' | 'parchment' | 'midnight' | 'emerald';
type DensityMode = 'compact' | 'normal' | 'relaxed';
type LayoutMode = 'full_infographic' | 'multi_part';
type AspectRatioMode = '3:4' | '4:5' | '1:1' | '16:9';

const MODAL_CARD_SPECS: Record<
  AspectRatioMode,
  { width: number; height: number; aspect: string }
> = {
  '3:4': { width: 540, height: 720, aspect: '3 / 4' },
  '4:5': { width: 560, height: 700, aspect: '4 / 5' },
  '1:1': { width: 600, height: 600, aspect: '1 / 1' },
  '16:9': { width: 800, height: 450, aspect: '16 / 9' },
};

const THEMES_CONFIG: Record<
  CardTheme,
  {
    name: string;
    bgStyle: string;
    cardBg: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
    accentBg: string;
    border: string;
    quoteBg: string;
    badgeBg: string;
    subheadingColor: string;
    highlightBg: string;
    highlightText: string;
    underlineColor: string;
  }
> = {
  espresso: {
    name: 'Royal Espresso',
    bgStyle: 'bg-[#1C140E]',
    cardBg: '#1C140E',
    textPrimary: '#FAF5EC',
    textSecondary: '#D8C8B4',
    accent: '#D4A373',
    accentBg: '#2A1E17',
    border: '#423126',
    quoteBg: '#281B13',
    badgeBg: '#3D2A1F',
    subheadingColor: '#F0B46E',
    highlightBg: 'transparent',
    highlightText: '#FBBF24',
    underlineColor: '#4ADE80',
  },
  parchment: {
    name: 'Parchment Sand',
    bgStyle: 'bg-[#FBF7EE]',
    cardBg: '#FBF7EE',
    textPrimary: '#2A1E17',
    textSecondary: '#5E5043',
    accent: '#8C5A2B',
    accentBg: '#F4EDE2',
    border: '#D8C8B4',
    quoteBg: '#F2E9D8',
    badgeBg: '#E8DDCB',
    subheadingColor: '#9A3412',
    highlightBg: 'transparent',
    highlightText: '#9A3412',
    underlineColor: '#15803D',
  },
  midnight: {
    name: 'Midnight Slate',
    bgStyle: 'bg-[#0F172A]',
    cardBg: '#0F172A',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    accent: '#38BDF8',
    accentBg: '#1E293B',
    border: '#334155',
    quoteBg: '#1E293B',
    badgeBg: '#1E293B',
    subheadingColor: '#7DD3FC',
    highlightBg: 'transparent',
    highlightText: '#7DD3FC',
    underlineColor: '#4ADE80',
  },
  emerald: {
    name: 'Emerald Wisdom',
    bgStyle: 'bg-[#064E3B]',
    cardBg: '#064E3B',
    textPrimary: '#F0FDF4',
    textSecondary: '#A7F3D0',
    accent: '#FBBF24',
    accentBg: '#022C22',
    border: '#047857',
    quoteBg: '#023E2F',
    badgeBg: '#065F46',
    subheadingColor: '#FCD34D',
    highlightBg: 'transparent',
    highlightText: '#FDE047',
    underlineColor: '#86EFAC',
  },
};

function detectModalScriptKind(text: string, isUrduContext: boolean): EditorialScriptKind {
  const rtlMatches = text.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g);
  const latinMatches = text.match(/[A-Za-z]/g);
  const rtlCount = rtlMatches ? rtlMatches.length : 0;
  const latinCount = latinMatches ? latinMatches.length : 0;
  if (!(rtlCount > 0 && rtlCount >= latinCount * 0.65)) return 'latin';
  const hasUrduLetters = /[\u0679\u067E\u0686\u0688\u0691\u0698\u06A9\u06AF\u06BA\u06BE\u06C1-\u06C3\u06CC\u06D2\u06D3\u06D4]/.test(
    text
  );
  if (hasUrduLetters) return 'urdu';
  const isDenseArabicCitation =
    /﴿|﴾/.test(text) || (text.match(/[\u064B-\u0652]/g)?.length || 0) >= 6;
  if (isDenseArabicCitation) return 'arabic';
  return isUrduContext ? 'urdu' : 'arabic';
}

export const ChapterPngExportModal: React.FC<ChapterPngExportModalProps> = ({
  isOpen,
  onClose,
  book,
  initialChapterNumber = 1
}) => {
  const { isUrdu } = useLanguage();
  const [selectedChapterNum, setSelectedChapterNum] = useState<number>(initialChapterNumber);
  const [selectedTheme, setSelectedTheme] = useState<CardTheme>('espresso');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('full_infographic');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>('3:4');
  const [activePartIndex, setActivePartIndex] = useState<number>(0);
  const [paragraphsPerPart, setParagraphsPerPart] = useState<number>(2);
  const [density, setDensity] = useState<DensityMode>('normal');
  const [includeCitations, setIncludeCitations] = useState<boolean>(true);
  const [includeKeyEvents, setIncludeKeyEvents] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const previewMeasureRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState<number>(0);

  useEffect(() => {
    setSelectedChapterNum(initialChapterNumber);
    setActivePartIndex(0);
  }, [initialChapterNumber, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const updateWidth = () => {
      const node = previewMeasureRef.current;
      if (node && node.clientWidth > 0) {
        setPreviewWidth(node.clientWidth);
      }
    };
    updateWidth();
    const node = previewMeasureRef.current;
    if (!node) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setPreviewWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(node);
    window.addEventListener('resize', updateWidth);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [isOpen, layoutMode, aspectRatio, activePartIndex, selectedChapterNum]);

  const currentUrdu = isUrdu ? getSynchronousUrduContent(book) : null;
  const chapters = book?.chapters || [];
  const currentChapter = chapters.find(c => c.number === selectedChapterNum) || chapters[0] || {
    number: selectedChapterNum || 1,
    title: '',
    summary: '',
    keyQuotes: [],
    keyEvents: []
  };

  // Resolve localized / translated chapter title and summary
  const chUrdu = currentUrdu?.chapters?.find(c => c.number === currentChapter?.number);
  const displayTitle = isUrdu
    ? (chUrdu?.title || translateParagraphToUrdu(currentChapter?.title || 'Chapter Breakdown'))
    : (currentChapter?.title || 'Chapter Breakdown');

  const rawSummary = isUrdu
    ? (chUrdu?.summary || translateParagraphToUrdu(currentChapter?.summary || ''))
    : (currentChapter?.summary || '');

  const summaryParagraphs = useMemo(
    () => (rawSummary ? rawSummary.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean) : []),
    [rawSummary]
  );

  const paragraphLabels = [
    '01 · Foundational Setting & Thesis',
    '02 · Core Arguments & Mechanisms',
    '03 · Dialectical Counter-Arguments',
    '04 · Ethical & Philosophical Ramifications',
    '05 · Practical Synthesis & Roadmap',
  ];

  const theme = THEMES_CONFIG[selectedTheme];
  const isFixedRatio = layoutMode === 'multi_part';
  const spec = MODAL_CARD_SPECS[aspectRatio];
  const isWidescreen = isFixedRatio && aspectRatio === '16:9';

  const densityStyles = useMemo(() => {
    if (isWidescreen) {
      return {
        title: density === 'relaxed' ? 'text-[22px]' : density === 'compact' ? 'text-[17px]' : 'text-[19px]',
        paragraph: density === 'relaxed' ? 'text-[13px] leading-[1.55]' : density === 'compact' ? 'text-[11px] leading-[1.45]' : 'text-[12px] leading-[1.5]',
        headerPadding: 'py-2.5 px-5',
        bodyPadding: 'p-4 space-y-2',
        footerPadding: 'py-2 px-5',
      };
    }
    if (isFixedRatio) {
      switch (density) {
        case 'compact':
          return {
            title: 'text-[19px]',
            paragraph: 'text-[11.5px] leading-[1.58]',
            headerPadding: 'py-3 px-5',
            bodyPadding: 'p-4 space-y-2.5',
            footerPadding: 'py-2.5 px-5',
          };
        case 'relaxed':
          return {
            title: 'text-[24px]',
            paragraph: 'text-[14px] leading-[1.68]',
            headerPadding: 'py-4 px-6',
            bodyPadding: 'p-6 space-y-3.5',
            footerPadding: 'py-3 px-6',
          };
        default:
          return {
            title: 'text-[21px]',
            paragraph: 'text-[13px] leading-[1.62]',
            headerPadding: 'py-3.5 px-5',
            bodyPadding: 'p-5 space-y-3',
            footerPadding: 'py-2.5 px-5',
          };
      }
    }
    switch (density) {
      case 'compact':
        return {
          title: 'text-base sm:text-xl',
          paragraph: 'text-[11.5px] leading-relaxed',
          headerPadding: 'py-2.5 px-3.5 sm:px-4',
          bodyPadding: 'p-3.5 sm:p-4 space-y-2.5',
          footerPadding: 'py-2 px-3.5 sm:px-4',
        };
      case 'relaxed':
        return {
          title: 'text-xl sm:text-3xl',
          paragraph: 'text-sm sm:text-base leading-relaxed',
          headerPadding: 'py-3.5 sm:py-4 px-4 sm:px-6',
          bodyPadding: 'p-4 sm:p-6 space-y-4',
          footerPadding: 'py-3 px-4 sm:px-6',
        };
      default:
        return {
          title: 'text-lg sm:text-2xl',
          paragraph: 'text-xs sm:text-sm leading-relaxed',
          headerPadding: 'py-3 sm:py-3.5 px-4 sm:px-5',
          bodyPadding: 'p-4 sm:p-5 space-y-3.5',
          footerPadding: 'py-2.5 sm:py-3 px-4 sm:px-5',
        };
    }
  }, [isWidescreen, isFixedRatio, density]);

  const [fontsReadyTick, setFontsReadyTick] = useState<number>(0);
  useEffect(() => {
    if (typeof document === 'undefined' || !('fonts' in document)) return;
    let active = true;
    document.fonts.ready
      .then(() => {
        if (active) setFontsReadyTick(t => t + 1);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const fullInfographicChunks = useMemo<ModalSlideChunk[]>(() => {
    return [
      {
        partIndex: 0,
        totalParts: 1,
        paragraphs: (summaryParagraphs.length > 0 ? summaryParagraphs : [rawSummary].filter(Boolean)).map(
          (p, idx) => ({
            text: p,
            label: paragraphLabels[idx] || `Paragraph ${idx + 1}`,
          })
        ),
        quotes: includeCitations ? currentChapter.keyQuotes || [] : [],
        keyEvents: includeKeyEvents ? currentChapter.keyEvents || [] : [],
      },
    ];
  }, [summaryParagraphs, rawSummary, includeCitations, includeKeyEvents, currentChapter]);

  const [measuredMultiPartChunks, setMeasuredMultiPartChunks] =
    useState<ModalSlideChunk[]>(fullInfographicChunks);

  useLayoutEffect(() => {
    if (!isOpen || layoutMode !== 'multi_part') return;
    const paragraphsInput =
      summaryParagraphs.length > 0 ? summaryParagraphs : [rawSummary].filter(Boolean);
    const adaptive = paginateModalChunksToCanvasBoundary({
      paragraphs: paragraphsInput,
      paragraphLabels,
      quotes: includeCitations ? currentChapter.keyQuotes || [] : [],
      keyEvents: includeKeyEvents ? currentChapter.keyEvents || [] : [],
      paragraphsPerPart,
      spec,
      isWidescreen,
      isUrdu,
      density,
      densityStyles,
      theme,
      chapterNumber: currentChapter.number,
      totalChapters: chapters.length,
      displayTitle,
      bookTitle: book.title,
      bookAuthor: book.author,
      aspectRatioLabel: aspectRatio,
    });
    setMeasuredMultiPartChunks(adaptive);
  }, [
    isOpen,
    layoutMode,
    summaryParagraphs,
    rawSummary,
    includeCitations,
    includeKeyEvents,
    currentChapter,
    paragraphsPerPart,
    spec,
    isWidescreen,
    isUrdu,
    density,
    densityStyles,
    theme,
    chapters.length,
    displayTitle,
    book.title,
    book.author,
    aspectRatio,
    fontsReadyTick,
  ]);

  const partChunks =
    layoutMode === 'full_infographic' ? fullInfographicChunks : measuredMultiPartChunks;

  useEffect(() => {
    if (activePartIndex >= partChunks.length) {
      setActivePartIndex(Math.max(0, partChunks.length - 1));
    }
  }, [partChunks.length, activePartIndex]);

  if (!isOpen) return null;

  const themesConfig = THEMES_CONFIG;
  const activeChunk = partChunks[Math.min(activePartIndex, partChunks.length - 1)] || partChunks[0];

  // Responsive mathematical scaling for fixed-ratio preview cards so ratio never breaks on narrow phones
  const maxDisplayW = isWidescreen ? 560 : 480;
  const fallbackViewportW =
    typeof window !== 'undefined' ? Math.max(260, window.innerWidth - 40) : 340;
  const availableW =
    previewWidth > 0
      ? Math.min(previewWidth, maxDisplayW)
      : Math.min(fallbackViewportW, maxDisplayW);
  const displayW = isFixedRatio ? availableW : 0;
  const scale = isFixedRatio ? displayW / spec.width : 1;
  const scaledH = isFixedRatio ? Math.round(spec.height * scale) : undefined;

  const buildCaptureOptions = async () => {
    const hasUrduScript =
      isUrdu ||
      /[\u0679\u067E\u0686\u0688\u0691\u0698\u06A9\u06AF\u06BA\u06BE\u06C1-\u06C3\u06CC\u06D2\u06D3\u06D4]/.test(
        rawSummary
      );
    const fontEmbedCSS = await getBookFontEmbedCss({ includeUrdu: hasUrduScript }).catch(() => '');
    return {
      pixelRatio: 2.5,
      cacheBust: true,
      ...(fontEmbedCSS ? { fontEmbedCSS } : { fontEmbedCSS: '', skipFonts: true }),
      ...(isFixedRatio ? { width: spec.width, height: spec.height } : {}),
      style: {
        margin: '0',
        transform: 'none',
        position: 'static',
        ...(isFixedRatio ? { width: `${spec.width}px`, height: `${spec.height}px` } : {}),
      },
    };
  };

  // Export single PNG
  const handleDownloadSinglePng = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    setExportNotice(null);

    try {
      await new Promise(r => setTimeout(r, 120));

      const dataUrl = await toPng(cardRef.current, await buildCaptureOptions());

      const sanitizeTitle = book.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 25);
      const partSuffix = layoutMode === 'multi_part' ? `_Part_${activeChunk.partIndex + 1}_of_${activeChunk.totalParts}` : '_Full_Infographic';
      const fileName = `${sanitizeTitle}_Ch_${currentChapter.number}${partSuffix}.png`;

      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export PNG:', err);
      setExportNotice('Could not render PNG image. Please try another ratio or refresh.');
    } finally {
      setIsExporting(false);
    }
  };

  // Copy PNG to Clipboard
  const handleCopyPngToClipboard = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    setExportNotice(null);

    try {
      await new Promise(r => setTimeout(r, 120));
      const dataUrl = await toPng(cardRef.current, await buildCaptureOptions());
      const blob = dataUrlToBlob(dataUrl);

      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setCopiedSuccess(true);
        setTimeout(() => setCopiedSuccess(false), 2500);
      } else {
        setExportNotice('Clipboard image copy unsupported here — downloading PNG instead.');
        handleDownloadSinglePng();
      }
    } catch (err) {
      console.error('Clipboard error:', err);
      handleDownloadSinglePng();
    } finally {
      setIsExporting(false);
    }
  };

  // Batch Export All Parts of Selected Chapter
  const handleDownloadAllParts = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    setExportNotice(null);

    const sanitizeTitle = book.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 25);
    const originalPart = activePartIndex;

    try {
      const captureOpts = await buildCaptureOptions();
      for (let p = 0; p < partChunks.length; p++) {
        setActivePartIndex(p);
        setBatchProgress(`Exporting Part ${p + 1} of ${partChunks.length}...`);

        await new Promise(r => setTimeout(r, 300));

        if (cardRef.current) {
          const dataUrl = await toPng(cardRef.current, captureOpts);
          const link = document.createElement('a');
          link.download = `${sanitizeTitle}_Ch_${currentChapter.number}_Part_${p + 1}_of_${partChunks.length}.png`;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        await new Promise(r => setTimeout(r, 200));
      }
    } catch (err) {
      console.error('Batch export error:', err);
      setExportNotice('Batch export encountered an interruption. Some parts may need retry.');
    } finally {
      setActivePartIndex(originalPart);
      setBatchProgress(null);
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-[#120D0A]/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-[#FBF7EE] border border-[#D8C8B4] rounded-xl sm:rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[96vh]">
        
        {/* Modal Header Bar */}
        <div className="flex items-center justify-between gap-3 px-3.5 sm:px-6 py-3 sm:py-3.5 border-b border-[#E8DDCB] bg-[#F4EDE2] shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#2A1E17] text-[#D4A373] flex items-center justify-center shadow-sm shrink-0">
              <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif-display font-bold text-sm sm:text-lg text-[#2A1E17] truncate">
                  Chapter Breakdown PNG Generator
                </h2>
                <span className="px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-sans-ui font-bold uppercase tracking-wider bg-[#8C5A2B] text-[#FBF7EE] shrink-0">
                  Zero Cutoff
                </span>
              </div>
              <p className="hidden sm:block text-xs font-sans-ui text-[#7A6B5D] truncate">
                Generate full-length unclipped infographics or multi-part carousel cards for social posts &amp; study notes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isExporting}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center text-[#7A6B5D] hover:text-[#2A1E17] hover:bg-[#E8DDCB] rounded-lg transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Left Controls, Right Interactive Canvas Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-[#E8DDCB]">
          
          {/* Left Column: Customization Controls */}
          <div className="lg:col-span-5 p-3.5 sm:p-5 md:p-6 space-y-4 sm:space-y-5 bg-[#F8F2E8]/60 lg:overflow-y-auto">
            
            {/* 1. Format Mode: Full Infographic vs Multi-Part Carousel */}
            <div className="space-y-2">
              <label className="text-xs font-sans-ui font-semibold uppercase tracking-wider text-[#8C5A2B] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Export Layout Format</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setLayoutMode('full_infographic');
                    setActivePartIndex(0);
                  }}
                  disabled={isExporting}
                  className={`p-2.5 sm:p-3 rounded-xl border text-left space-y-1 transition-all cursor-pointer min-h-[44px] ${
                    layoutMode === 'full_infographic'
                      ? 'border-[#8C5A2B] bg-[#2A1E17] text-[#FAF5EC] shadow-sm'
                      : 'border-[#D8C8B4] bg-[#FBF7EE] text-[#2A1E17] hover:bg-[#E8DDCB]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-sans-ui font-bold text-xs">
                    <Maximize2 className={`w-3.5 h-3.5 shrink-0 ${layoutMode === 'full_infographic' ? 'text-[#D4A373]' : 'text-[#8C5A2B]'}`} />
                    <span>Full Infographic</span>
                  </div>
                  <p className={`text-[10px] leading-tight ${layoutMode === 'full_infographic' ? 'text-[#D8C8B4]' : 'text-[#7A6B5D]'}`}>
                    Auto-height card that fits 100% of text without cutting any paragraph.
                  </p>
                </button>

                <button
                  onClick={() => {
                    setLayoutMode('multi_part');
                    setActivePartIndex(0);
                  }}
                  disabled={isExporting}
                  className={`p-2.5 sm:p-3 rounded-xl border text-left space-y-1 transition-all cursor-pointer min-h-[44px] ${
                    layoutMode === 'multi_part'
                      ? 'border-[#8C5A2B] bg-[#2A1E17] text-[#FAF5EC] shadow-sm'
                      : 'border-[#D8C8B4] bg-[#FBF7EE] text-[#2A1E17] hover:bg-[#E8DDCB]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-sans-ui font-bold text-xs">
                    <Columns className={`w-3.5 h-3.5 shrink-0 ${layoutMode === 'multi_part' ? 'text-[#D4A373]' : 'text-[#8C5A2B]'}`} />
                    <span>Multi-Part Carousel</span>
                  </div>
                  <p className={`text-[10px] leading-tight ${layoutMode === 'multi_part' ? 'text-[#D8C8B4]' : 'text-[#7A6B5D]'}`}>
                    Splits chapters into balanced, fixed-ratio cards (Part 1/2, 2/2).
                  </p>
                </button>
              </div>
            </div>

            {/* 2. Aspect Ratio Selector (When in Multi-Part Mode) */}
            {layoutMode === 'multi_part' && (
              <div className="space-y-2.5 bg-[#FBF7EE] p-3 sm:p-3.5 rounded-xl border border-[#D8C8B4]">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-sans-ui font-semibold uppercase tracking-wider text-[#8C5A2B] flex items-center gap-1.5">
                    <Grid className="w-3.5 h-3.5" />
                    <span>Card Aspect Ratio</span>
                  </label>
                  <span className="text-[10px] font-mono font-bold text-[#8C5A2B]">
                    {partChunks.length} {partChunks.length === 1 ? 'Part' : 'Parts'}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {(['3:4', '4:5', '1:1', '16:9'] as AspectRatioMode[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setAspectRatio(r)}
                      disabled={isExporting}
                      className={`min-h-[38px] py-1.5 text-center text-xs font-mono font-bold rounded-lg transition-all cursor-pointer ${
                        aspectRatio === r
                          ? 'bg-[#8C5A2B] text-[#FAF5EC]'
                          : 'bg-[#F4EDE2] text-[#5E5043] hover:bg-[#E8DDCB]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                {/* Paragraphs Per Card selector */}
                <div className="pt-2 border-t border-[#E8DDCB] flex items-center justify-between gap-3 text-xs font-sans-ui text-[#5E5043]">
                  <span>Paragraphs Per Card:</span>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3].map(n => (
                      <button
                        key={n}
                        onClick={() => {
                          setParagraphsPerPart(n);
                          setActivePartIndex(0);
                        }}
                        className={`w-8 h-8 rounded-lg text-xs font-mono font-bold flex items-center justify-center transition-all cursor-pointer ${
                          paragraphsPerPart === n
                            ? 'bg-[#2A1E17] text-[#FBF7EE]'
                            : 'bg-[#E8DDCB] text-[#5E5043] hover:bg-[#D8C8B4]'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Chapter & Part Navigation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-sans-ui font-semibold uppercase tracking-wider text-[#8C5A2B] flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Select Chapter</span>
                </label>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setSelectedChapterNum(prev => Math.max(1, prev - 1));
                      setActivePartIndex(0);
                    }}
                    disabled={selectedChapterNum <= 1 || isExporting}
                    className="p-1 rounded bg-[#E8DDCB] hover:bg-[#D8C8B4] disabled:opacity-40 text-[#2A1E17] cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-mono text-[#2A1E17] font-semibold px-1.5">
                    {selectedChapterNum} / {chapters.length}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedChapterNum(prev => Math.min(chapters.length, prev + 1));
                      setActivePartIndex(0);
                    }}
                    disabled={selectedChapterNum >= chapters.length || isExporting}
                    className="p-1 rounded bg-[#E8DDCB] hover:bg-[#D8C8B4] disabled:opacity-40 text-[#2A1E17] cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {chapters.map(ch => (
                  <button
                    key={ch.number}
                    onClick={() => {
                      setSelectedChapterNum(ch.number);
                      setActivePartIndex(0);
                    }}
                    disabled={isExporting}
                    className={`px-3 py-1.5 rounded-lg text-xs font-sans-ui font-medium whitespace-nowrap transition-all cursor-pointer ${
                      selectedChapterNum === ch.number
                        ? 'bg-[#2A1E17] text-[#FBF7EE] shadow-sm font-semibold'
                        : 'bg-[#FBF7EE] text-[#5E5043] border border-[#D8C8B4] hover:bg-[#E8DDCB]'
                    }`}
                  >
                    Ch {ch.number}
                  </button>
                ))}
              </div>
            </div>

            {/* If Multi-Part, Part Picker Bar */}
            {layoutMode === 'multi_part' && partChunks.length > 1 && (
              <div className="space-y-1.5 bg-[#EFE7D8] p-3 rounded-xl border border-[#D8C8B4]">
                <span className="text-[11px] font-sans-ui font-semibold text-[#8C5A2B] block">
                  Select Card Part to View & Export:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {partChunks.map((_, pIdx) => (
                    <button
                      key={pIdx}
                      onClick={() => setActivePartIndex(pIdx)}
                      className={`px-3 py-1 rounded-lg text-xs font-sans-ui font-bold whitespace-nowrap transition-all cursor-pointer ${
                        activePartIndex === pIdx
                          ? 'bg-[#8C5A2B] text-[#FBF7EE] shadow-xs'
                          : 'bg-[#FBF7EE] text-[#5E5043] border border-[#D8C8B4] hover:bg-[#E8DDCB]'
                      }`}
                    >
                      Part {pIdx + 1} of {partChunks.length}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Theme Selector */}
            <div className="space-y-2">
              <label className="text-xs font-sans-ui font-semibold uppercase tracking-wider text-[#8C5A2B] flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" />
                <span>Card Theme</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(themesConfig) as CardTheme[]).map(tKey => {
                  const tConf = themesConfig[tKey];
                  const isSelected = selectedTheme === tKey;
                  return (
                    <button
                      key={tKey}
                      onClick={() => setSelectedTheme(tKey)}
                      disabled={isExporting}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#8C5A2B] ring-2 ring-[#8C5A2B]/20 bg-[#FBF7EE]'
                          : 'border-[#D8C8B4] bg-[#FBF7EE]/60 hover:bg-[#FBF7EE]'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-full border border-black/20 shrink-0 shadow-xs"
                        style={{ backgroundColor: tConf.cardBg }}
                      />
                      <span className="text-xs font-sans-ui font-medium text-[#2A1E17]">
                        {tConf.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Typography & Density Control */}
            <div className="space-y-2">
              <label className="text-xs font-sans-ui font-semibold uppercase tracking-wider text-[#8C5A2B] flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5" />
                <span>Text Scaling</span>
              </label>

              <div className="grid grid-cols-3 gap-2">
                {(['compact', 'normal', 'relaxed'] as DensityMode[]).map(d => (
                  <button
                    key={d}
                    onClick={() => setDensity(d)}
                    disabled={isExporting}
                    className={`py-1.5 px-2 rounded-lg text-xs font-sans-ui capitalize text-center transition-all cursor-pointer ${
                      density === d
                        ? 'bg-[#2A1E17] text-[#FBF7EE] font-semibold'
                        : 'bg-[#FBF7EE] text-[#5E5043] border border-[#D8C8B4] hover:bg-[#E8DDCB]'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* 6. Options Toggle */}
            <div className="space-y-2 pt-2 border-t border-[#E8DDCB]">
              <label className="flex items-center gap-2 text-xs font-sans-ui text-[#2A1E17] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCitations}
                  onChange={e => setIncludeCitations(e.target.checked)}
                  disabled={isExporting}
                  className="rounded text-[#8C5A2B] focus:ring-[#8C5A2B]"
                />
                <span>Include Source Text Citations</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-sans-ui text-[#2A1E17] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeKeyEvents}
                  onChange={e => setIncludeKeyEvents(e.target.checked)}
                  disabled={isExporting}
                  className="rounded text-[#8C5A2B] focus:ring-[#8C5A2B]"
                />
                <span>Include Key Arguments & Events</span>
              </label>
            </div>

              {/* 7. Action Buttons */}
            <div className="space-y-2.5 pt-3.5 border-t border-[#E8DDCB]">
              <button
                onClick={handleDownloadSinglePng}
                disabled={isExporting}
                className="w-full min-h-[44px] py-3 bg-[#2A1E17] hover:bg-[#3D2C22] active:bg-[#1A120E] text-[#FBF7EE] font-sans-ui font-medium text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#423126]"
              >
                {isExporting && !batchProgress ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#D4A373]" />
                    <span>Rendering PNG Card...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-[#D4A373]" />
                    <span>
                      {layoutMode === 'multi_part'
                        ? `Download Part ${activeChunk.partIndex + 1} (${aspectRatio} PNG)`
                        : `Download Full Infographic PNG`}
                    </span>
                  </>
                )}
              </button>

              <div className={`grid gap-2 ${layoutMode === 'multi_part' && partChunks.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <button
                  onClick={handleCopyPngToClipboard}
                  disabled={isExporting}
                  className="min-h-[40px] py-2.5 bg-[#FBF7EE] hover:bg-[#E8DDCB] border border-[#D8C8B4] text-[#2A1E17] font-sans-ui font-medium text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied Image!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#8C5A2B]" />
                      <span>Copy PNG</span>
                    </>
                  )}
                </button>

                {layoutMode === 'multi_part' && partChunks.length > 1 && (
                  <button
                    onClick={handleDownloadAllParts}
                    disabled={isExporting}
                    className="min-h-[40px] py-2.5 bg-[#FBF7EE] hover:bg-[#E8DDCB] border border-[#D8C8B4] text-[#2A1E17] font-sans-ui font-medium text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Export all parts of this chapter sequentially"
                  >
                    <Download className="w-3.5 h-3.5 text-[#8C5A2B]" />
                    <span>Export All ({partChunks.length})</span>
                  </button>
                )}
              </div>

              {batchProgress && (
                <div className="p-2.5 bg-[#8C5A2B]/10 border border-[#8C5A2B]/30 rounded-xl text-center text-xs font-sans-ui text-[#8C5A2B] flex items-center justify-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8C5A2B]" />
                  <span>{batchProgress}</span>
                </div>
              )}

              {exportNotice && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-center text-xs font-sans-ui text-amber-900">
                  {exportNotice}
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Live Card Canvas Preview */}
          <div className="lg:col-span-7 p-3 sm:p-6 flex flex-col items-center justify-start bg-[#2A1E17]/10 lg:overflow-y-auto min-h-[280px] sm:min-h-[480px]">
            
            {/* Unpadded measurement rail so mobile aspect-ratio scale never includes padding */}
            <div ref={previewMeasureRef} className="w-full">
              {/* Live Indicator Banner */}
              <div className="w-full max-w-[560px] mx-auto flex flex-wrap items-center justify-between gap-2 text-[11px] font-sans-ui font-semibold text-[#8C5A2B] uppercase tracking-wider mb-3">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#8C5A2B]" />
                  {layoutMode === 'full_infographic' ? 'Full Infographic Preview' : `Part ${activeChunk.partIndex + 1} of ${activeChunk.totalParts} (${aspectRatio})`}
                </span>
                <span className="text-[10px] text-[#7A6B5D] bg-[#FBF7EE] px-2 py-0.5 rounded border border-[#D8C8B4]">
                  {isFixedRatio ? `${spec.width}×${spec.height}px Ratio Locked` : '100% Complete Text'}
                </span>
              </div>

              {/* Canvas Outer Wrapper — locked to exact mathematical aspect ratio in multi_part mode */}
              <div
                style={
                  isFixedRatio
                    ? {
                        width: `${displayW}px`,
                        height: `${scaledH}px`,
                        aspectRatio: spec.aspect,
                      }
                    : undefined
                }
                className={`${isFixedRatio ? 'mx-auto' : 'w-full max-w-[520px] mx-auto'} shadow-2xl rounded-2xl overflow-hidden border border-black/20 my-auto relative`}
              >
                {/* Target Capture DOM Node for html-to-image */}
                <div
                  ref={cardRef}
                  style={
                    isFixedRatio
                      ? {
                          width: `${spec.width}px`,
                          height: `${spec.height}px`,
                          transform: `scale(${scale})`,
                          transformOrigin: 'top left',
                          backgroundColor: theme.cardBg,
                          color: theme.textPrimary,
                        }
                      : {
                          backgroundColor: theme.cardBg,
                          color: theme.textPrimary,
                        }
                  }
                  className={`w-full flex flex-col justify-between overflow-hidden relative font-serif-body select-none transition-colors ${
                    isUrdu ? 'font-urdu' : ''
                  }`}
                >
                  
                  {/* 1. Card Top Header */}
                  <div
                    style={{
                      backgroundColor: theme.accentBg,
                      borderColor: theme.border
                    }}
                    className={`border-b ${densityStyles.headerPadding} flex flex-col space-y-1 shrink-0`}
                  >
                    {/* Top Branding Row */}
                    <div className="flex items-center justify-between text-[10px] uppercase font-sans-ui tracking-wider opacity-80">
                      <span style={{ color: theme.accent }} className="font-bold flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> WISDOM READER
                      </span>
                      <span
                        style={{ backgroundColor: theme.badgeBg, color: theme.textPrimary }}
                        className="px-2 py-0.5 rounded font-mono font-bold"
                      >
                        {layoutMode === 'multi_part' && activeChunk.totalParts > 1
                          ? `CHAPTER ${String(currentChapter.number).padStart(2, '0')} · PART ${activeChunk.partIndex + 1}/${activeChunk.totalParts}`
                          : `CHAPTER ${String(currentChapter.number).padStart(2, '0')} OF ${String(chapters.length).padStart(2, '0')}`}
                      </span>
                    </div>

                    {/* Book Title & Author */}
                    <div className="flex items-center justify-between gap-2">
                      <span style={{ color: theme.textSecondary }} className="text-[11px] font-sans-ui truncate">
                        "{book.title}" by {book.author}
                      </span>
                      <span style={{ color: theme.accent }} className="text-[10px] font-mono shrink-0">
                        {layoutMode === 'full_infographic' ? 'INFOGRAPHIC' : aspectRatio}
                      </span>
                    </div>

                    {/* Chapter Main Title */}
                    <h3
                      dir={isUrdu ? 'rtl' : 'ltr'}
                      style={{ color: theme.textPrimary }}
                      className={`font-serif-display font-bold leading-snug tracking-tight ${densityStyles.title}`}
                    >
                      Chapter {currentChapter.number}: {displayTitle}
                    </h3>
                  </div>

                  {/* 2. Card Middle Body (Paragraph Breakdown) */}
                  <div className={`flex-1 ${densityStyles.bodyPadding} overflow-hidden flex flex-col justify-start`}>
                    
                    {/* Paragraph Summaries in this Chunk */}
                    {activeChunk.paragraphs.length > 0 && (
                      <div className={isWidescreen && activeChunk.paragraphs.length >= 2 ? 'grid grid-cols-2 gap-3 items-start' : 'space-y-2.5'}>
                        {activeChunk.paragraphs.map((pObj, pIdx) => {
                          const pScript = detectModalScriptKind(pObj.text, isUrdu);
                          const pRtl = pScript !== 'latin';
                          return (
                            <div
                              key={pIdx}
                              style={{
                                borderColor: theme.border,
                                backgroundColor: theme.quoteBg
                              }}
                              className={`border rounded-xl ${isFixedRatio ? 'p-3' : 'p-3 sm:p-3.5'} space-y-1 shadow-xs`}
                            >
                              <span
                                style={{ color: theme.subheadingColor }}
                                className="text-[9.5px] font-sans-ui font-bold uppercase tracking-wider block"
                              >
                                {pObj.label}
                              </span>
                              <p
                                dir={pRtl ? 'rtl' : 'ltr'}
                                style={{ color: theme.textPrimary }}
                                className={`${
                                  pScript === 'urdu'
                                    ? 'font-urdu text-right leading-loose'
                                    : pScript === 'arabic'
                                    ? 'font-arabic text-right leading-[1.85]'
                                    : `font-serif-body ${isFixedRatio ? 'text-left' : 'text-justify'}`
                                } ${densityStyles.paragraph}`}
                              >
                                {renderFormattedImportantText(pObj.text, theme, pScript)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Key Arguments / Events (if included) */}
                    {activeChunk.keyEvents && activeChunk.keyEvents.length > 0 && (
                      <div
                        style={{
                          backgroundColor: theme.accentBg,
                          borderColor: theme.border
                        }}
                        className="border rounded-xl p-2.5 space-y-1 shrink-0 mt-2"
                      >
                        <span style={{ color: theme.subheadingColor }} className="text-[9.5px] font-sans-ui font-bold uppercase tracking-wider block">
                          Core Premises & Key Arguments
                        </span>
                        <ul className="space-y-1">
                          {activeChunk.keyEvents.slice(0, isWidescreen ? 2 : 3).map((ev, eIdx) => {
                            const evScript = detectModalScriptKind(ev, isUrdu);
                            return (
                              <li
                                key={eIdx}
                                dir={evScript === 'latin' ? 'ltr' : 'rtl'}
                                style={{ color: theme.textSecondary }}
                                className={`text-[10px] flex items-start gap-1.5 leading-snug ${
                                  evScript === 'urdu'
                                    ? 'font-urdu text-right'
                                    : evScript === 'arabic'
                                    ? 'font-arabic text-right'
                                    : 'font-serif-body'
                                }`}
                              >
                                <span style={{ color: theme.accent }}>•</span>
                                <span>{renderFormattedImportantText(ev, theme, evScript)}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {/* Verbatim Source Citation (if included) */}
                    {activeChunk.quotes && activeChunk.quotes.length > 0 && (() => {
                      const qText = `"${activeChunk.quotes[0].replace(/^["']|["']$/g, '')}"`;
                      const qScript = detectModalScriptKind(qText, isUrdu);
                      return (
                        <div
                          style={{
                            backgroundColor: theme.quoteBg,
                            borderColor: theme.border
                          }}
                          className="border rounded-xl p-2.5 space-y-1 shrink-0 relative mt-2"
                        >
                          <div className="flex items-center justify-between text-[9px] font-sans-ui uppercase tracking-wider font-bold">
                            <span style={{ color: theme.subheadingColor }} className="flex items-center gap-1">
                              <Quote className="w-3 h-3" /> Source Text Citation
                            </span>
                            <span style={{ color: theme.textSecondary }}>Direct Excerpt</span>
                          </div>
                          <p
                            dir={qScript === 'latin' ? 'ltr' : 'rtl'}
                            style={{ color: theme.textPrimary }}
                            className={`text-[11px] leading-snug ${
                              qScript === 'urdu'
                                ? 'text-right font-urdu'
                                : qScript === 'arabic'
                                ? 'text-right font-arabic'
                                : 'font-serif-body italic'
                            }`}
                          >
                            {renderFormattedImportantText(qText, theme, qScript)}
                          </p>
                        </div>
                      );
                    })()}

                  </div>

                  {/* 3. Card Bottom Footer */}
                  <div
                    style={{
                      backgroundColor: theme.accentBg,
                      borderColor: theme.border
                    }}
                    className={`border-t ${densityStyles.footerPadding} flex items-center justify-between gap-2 text-[10px] font-sans-ui shrink-0`}
                  >
                    <span style={{ color: theme.textSecondary }} className="truncate">
                      The Wisdom Lounge · Classical Knowledge Extraction
                    </span>
                    <span style={{ color: theme.accent }} className="font-mono font-bold shrink-0">
                      WISDOM READER
                    </span>
                  </div>

                </div>

              </div>
            </div>

            <p className="text-[11px] font-sans-ui text-[#7A6B5D] mt-3 text-center max-w-xs">
              {layoutMode === 'full_infographic'
                ? 'Full-length infographic mode adjusts height dynamically so zero text is ever cut off.'
                : `Part ${activeChunk.partIndex + 1} of ${activeChunk.totalParts} locked to ${aspectRatio} (${spec.width}×${spec.height}px) social ratio.`}
            </p>

          </div>

        </div>

      </div>
    </div>
  );
};
