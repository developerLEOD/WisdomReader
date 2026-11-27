import React, { useState, useEffect } from 'react';
import { BookAnalysis, StudioTab, ExplanationLevel, EXPLANATION_LEVELS, ChapterSummary, TranslatedContent } from '../types/book';
import {
  BookOpen,
  ListOrdered,
  Users,
  MessageSquare,
  BookText,
  Clock,
  FileText,
  Download,
  Share2,
  Check,
  Search,
  Quote,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  Layers,
  Loader2,
  Flame,
  RefreshCw,
  FileCheck,
  ScrollText,
  Target,
  BookMarked,
  Languages,
  Image as ImageIcon
} from 'lucide-react';
import { AudioDigestPlayer } from './AudioDigestPlayer';
import { AskWisdomChat } from './AskWisdomChat';
import { ExportModal } from './ExportModal';
import { ChapterPngExportModal } from './ChapterPngExportModal';
import { ExplanationLevelSelector } from './ExplanationLevelSelector';
import { ModernRemediesView } from './ModernRemediesView';
import { createLocalManuscriptAnalysis } from '../utils/localTextAnalyzer';
import { useLanguage } from '../context/LanguageContext';
import { getCachedUrduContent, getOrTranslateUrduContent, getSynchronousUrduContent, translateParagraphToUrdu } from '../utils/urduContentTranslator';

interface AnalysisStudioProps {
  book: BookAnalysis;
  onBackToLibrary: () => void;
}

export const AnalysisStudio: React.FC<AnalysisStudioProps> = ({
  book,
  onBackToLibrary
}) => {
  const { isUrdu, t, toggleLanguage } = useLanguage();
  const [currentBook, setCurrentBook] = useState<BookAnalysis>(book);
  const [urduData, setUrduData] = useState<TranslatedContent | null>(() => {
    return isUrdu ? getSynchronousUrduContent(book) : null;
  });
  const [isTranslatingContent, setIsTranslatingContent] = useState(false);

  useEffect(() => {
    if (book) {
      setCurrentBook(book);
      if (isUrdu) {
        setUrduData(getSynchronousUrduContent(book));
      }
    }
  }, [book, isUrdu]);

  useEffect(() => {
    if (isUrdu && currentBook) {
      const syncContent = getSynchronousUrduContent(currentBook);
      setUrduData(syncContent);

      setIsTranslatingContent(true);
      getOrTranslateUrduContent(currentBook)
        .then((res) => {
          if (res) {
            setUrduData(res);
          }
        })
        .catch((err) => {
          console.warn('Urdu translation notice:', err);
        })
        .finally(() => {
          setIsTranslatingContent(false);
        });
    }
  }, [isUrdu, currentBook.id]);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<StudioTab>('executive');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPngExportOpen, setIsPngExportOpen] = useState(false);
  const [exportChapterNum, setExportChapterNum] = useState<number>(1);
  const [copiedQuoteIndex, setCopiedQuoteIndex] = useState<number | null>(null);

  // Chapter tab state & multi-step iterative analysis state
  const [chapterSearch, setChapterSearch] = useState('');
  const [expandedChapter, setExpandedChapter] = useState<number | null>(1);
  const [deepeningChapterNum, setDeepeningChapterNum] = useState<number | null>(null);
  const [isDeepeningAll, setIsDeepeningAll] = useState(false);
  const [copiedChapterQuote, setCopiedChapterQuote] = useState<string | null>(null);

  // Reader tab state
  const [readerFontSize, setReaderFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');
  const [readerBg, setReaderBg] = useState<'sand' | 'sepia' | 'light'>('sand');
  const [readerSearch, setReaderSearch] = useState('');

  const handleLevelChange = async (newLevel: ExplanationLevel) => {
    if (newLevel === (currentBook.explanationLevel || 2) || isReanalyzing) return;

    setIsReanalyzing(true);
    const textToAnalyze = currentBook.rawTextPreview || `${currentBook.title} by ${currentBook.author}. ${currentBook.executiveSummary.overview}`;

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToAnalyze,
          title: currentBook.title,
          author: currentBook.author,
          category: currentBook.category,
          explanationLevel: newLevel,
          customInstructions: currentBook.customInstructions
        })
      });

      if (response.ok) {
        const rawText = await response.text();
        let data: any = null;
        try {
          data = JSON.parse(rawText);
        } catch (e) {
          console.warn('Re-analysis parse notice');
        }
        if (data && data.executiveSummary) {
          setCurrentBook({ ...data, explanationLevel: newLevel, customInstructions: currentBook.customInstructions });
          setIsReanalyzing(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Level re-analysis notice:', e);
    }

    // Local fallback re-synthesis
    const localAnalysis = createLocalManuscriptAnalysis(
      textToAnalyze,
      currentBook.title,
      currentBook.author,
      currentBook.category,
      newLevel,
      currentBook.customInstructions
    );
    setCurrentBook({
      ...currentBook,
      ...localAnalysis,
      explanationLevel: newLevel
    });
    setIsReanalyzing(false);
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedQuoteIndex(index);
    setTimeout(() => setCopiedQuoteIndex(null), 2000);
  };

  const copyChapterQuote = (quote: string) => {
    navigator.clipboard.writeText(quote);
    setCopiedChapterQuote(quote);
    setTimeout(() => setCopiedChapterQuote(null), 2000);
  };

  const handleDeepenChapter = async (chapterNumber: number) => {
    const targetCh = currentBook.chapters.find(c => c.number === chapterNumber);
    if (!targetCh || deepeningChapterNum !== null) return;

    setDeepeningChapterNum(chapterNumber);
    try {
      const response = await fetch('/api/deepen-chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manuscriptText: currentBook.rawTextPreview || '',
          bookTitle: currentBook.title,
          author: currentBook.author,
          chapterNumber,
          chapterTitle: targetCh.title,
          currentChapter: targetCh,
          explanationLevel: currentBook.explanationLevel || 2,
          customInstructions: currentBook.customInstructions
        })
      });

      if (response.ok) {
        const deepenedData: ChapterSummary = await response.json();
        const updatedChapters = currentBook.chapters.map(c => 
          c.number === chapterNumber ? { ...c, ...deepenedData } : c
        );
        const updatedBook = { ...currentBook, chapters: updatedChapters };
        setCurrentBook(updatedBook);

        try {
          const saved = localStorage.getItem('wisdom_reader_books');
          if (saved) {
            const parsed = JSON.parse(saved);
            const newSaved = parsed.map((b: any) => b.id === updatedBook.id ? updatedBook : b);
            localStorage.setItem('wisdom_reader_books', JSON.stringify(newSaved));
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (err) {
      console.error('Failed to deepen chapter:', err);
    } finally {
      setDeepeningChapterNum(null);
    }
  };

  const handleDeepenAllChapters = async () => {
    if (isDeepeningAll || deepeningChapterNum !== null) return;
    setIsDeepeningAll(true);
    try {
      for (const ch of currentBook.chapters) {
        await handleDeepenChapter(ch.number);
      }
    } finally {
      setIsDeepeningAll(false);
    }
  };

  const filteredChapters = currentBook.chapters.filter(ch =>
    ch.title.toLowerCase().includes(chapterSearch.toLowerCase()) ||
    ch.summary.toLowerCase().includes(chapterSearch.toLowerCase()) ||
    ch.number.toString().includes(chapterSearch)
  );

  const activeLevelConfig = EXPLANATION_LEVELS.find(l => l.level === (currentBook.explanationLevel || 2));

  return (
    <div className={`max-w-7xl mx-auto px-3 sm:px-4 md:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6 ${isUrdu ? 'font-urdu' : ''}`}>
      
      {/* Studio Header Bar */}
      <div className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6">
        
        <div className="space-y-1 w-full md:w-auto">
          <button
            onClick={onBackToLibrary}
            className="inline-flex items-center gap-1.5 text-xs font-sans-ui text-[#8C5A2B] hover:text-[#2A1E17] font-medium transition-colors mb-1 cursor-pointer min-h-[32px]"
          >
            <ArrowLeft className={`w-3.5 h-3.5 ${isUrdu ? 'rotate-180' : ''}`} />
            <span>{t.btnBackToLibrary}</span>
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif-display font-bold text-xl sm:text-2xl md:text-3xl text-[#2A1E17]">
              {currentBook.title}
            </h1>
            {(currentBook.isCombinedAnalysis || (currentBook.sourceDocuments && currentBook.sourceDocuments.length > 1)) && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans-ui font-bold bg-[#E8DDCB] text-[#8C5A2B] border border-[#D8C8B4]">
                <Layers className="w-3.5 h-3.5" />
                {t.combinedBadge} ({currentBook.sourceDocuments?.length || 2} {t.docsLabel})
              </span>
            )}
          </div>

          {(currentBook.isCombinedAnalysis || (currentBook.sourceDocuments && currentBook.sourceDocuments.length > 1)) && currentBook.sourceDocuments && (
            <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
              <span className="text-[11px] font-sans-ui font-semibold text-[#8C5A2B] uppercase tracking-wider">
                {t.contributingTexts}:
              </span>
              {currentBook.sourceDocuments.map((s, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 text-xs bg-[#FBF7EE] border border-[#D8C8B4] px-2.5 py-1 rounded-lg text-[#2A1E17]"
                  title={`${s.fileName || s.title} · ${s.wordCount.toLocaleString()} words`}
                >
                  <span className="w-4 h-4 rounded-full bg-[#2A1E17] text-[#D4A373] text-[10px] font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="font-medium font-serif-display truncate max-w-[180px]">{s.title}</span>
                  <span className="text-[10px] text-[#7A6B5D]">({(s.wordCount / 1000).toFixed(1)}k {t.wordsLabel})</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-sans-ui text-[#7A6B5D]">
            <span>by <strong className="text-[#2A1E17] font-serif-body">{currentBook.author}</strong></span>
            <span>·</span>
            <span className="text-[#8C5A2B] font-medium">{currentBook.category}</span>
            <span>·</span>
            <span>{(currentBook.wordCount / 1000).toFixed(0)}k {t.wordsLabel}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {currentBook.estimatedReadTime} {t.minStudy}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="w-full sm:w-auto grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setExportChapterNum(1);
              setIsPngExportOpen(true);
            }}
            className="min-h-[40px] px-3 sm:px-3.5 py-2 text-xs font-sans-ui font-semibold text-[#FAF5EC] bg-[#2A1E17] hover:bg-[#3D2C22] border border-[#423126] rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer active:bg-[#1A120E]"
            title="Extract chapter breakdowns into high quality 3:4 PNG image cards"
          >
            <ImageIcon className="w-4 h-4 text-[#D4A373] shrink-0" />
            <span className="truncate">Export PNG</span>
          </button>

          <button
            onClick={() => setIsExportOpen(true)}
            className="min-h-[40px] px-3 sm:px-3.5 py-2 text-xs font-sans-ui font-medium text-[#2A1E17] bg-[#FBF7EE] hover:bg-[#E8DDCB] border border-[#D8C8B4] rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer active:bg-[#E8DDCB]"
          >
            <Download className="w-4 h-4 text-[#8C5A2B] shrink-0" />
            <span>{t.btnExport}</span>
          </button>
        </div>

      </div>

      {/* Explanation Level Control Bar */}
      <div className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 border-b border-[#E8DDCB] pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#2A1E17] text-[#D4A373] shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-serif-display font-bold text-base text-[#2A1E17]">
                  Explanation Depth Control
                </h3>
                <span className="text-[11px] font-sans-ui font-semibold px-2.5 py-0.5 rounded-full bg-[#8C5A2B] text-[#FBF7EE]">
                  {activeLevelConfig?.badgeLabel}
                </span>
              </div>
              <p className="text-xs font-sans-ui text-[#7A6B5D] mt-0.5">
                {activeLevelConfig?.description}
              </p>
            </div>
          </div>
        </div>

        <ExplanationLevelSelector
          selectedLevel={currentBook.explanationLevel || 2}
          onChange={handleLevelChange}
          disabled={isReanalyzing}
        />
      </div>

      {/* Re-analysis Loading Overlay */}
      {isReanalyzing && (
        <div className="bg-[#F4EDE2] border border-[#8C5A2B]/40 rounded-2xl p-6 sm:p-8 text-center flex flex-col items-center justify-center space-y-3 shadow-sm animate-pulse">
          <div className="p-3 rounded-full bg-[#E2D4C3] text-[#8C5A2B]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <div>
            <h4 className="font-serif-display font-bold text-base text-[#2A1E17]">
              Re-Synthesizing Manuscript at {activeLevelConfig?.name}...
            </h4>
            <p className="text-xs font-sans-ui text-[#7A6B5D] mt-1">
              Recalibrating chapter depths, key takeaways, and textual context...
            </p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 bg-[#F4EDE2] border border-[#E2D4C3] rounded-xl overflow-x-auto scrollbar-none touch-pan-x">
        
        <button
          onClick={() => setActiveTab('executive')}
          className={`min-h-[40px] flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-sans-ui font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'executive'
              ? 'bg-[#2A1E17] text-[#FBF7EE] shadow-sm font-semibold'
              : 'text-[#5E5043] hover:text-[#2A1E17] hover:bg-[#E8DDCB]'
          }`}
        >
          <BookOpen className="w-4 h-4 text-[#D4A373]" />
          <span>{t.tabExecutive}</span>
        </button>

        <button
          onClick={() => setActiveTab('remedies')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-sans-ui font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'remedies'
              ? 'bg-[#2A1E17] text-[#FBF7EE] shadow-sm font-semibold border border-amber-500/40'
              : 'text-[#5E5043] hover:text-[#2A1E17] hover:bg-[#E8DDCB]'
          }`}
        >
          <Flame className="w-4 h-4 text-amber-500" />
          <span>{t.tabRemedies}</span>
          {currentBook.modernRemedies && currentBook.modernRemedies.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 text-[10px] font-bold">
              {currentBook.modernRemedies.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('chapters')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-sans-ui font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'chapters'
              ? 'bg-[#2A1E17] text-[#FBF7EE] shadow-sm font-semibold'
              : 'text-[#5E5043] hover:text-[#2A1E17] hover:bg-[#E8DDCB]'
          }`}
        >
          <ListOrdered className="w-4 h-4 text-[#D4A373]" />
          <span>{t.tabChapters} ({currentBook.chapters.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('entities')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-sans-ui font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'entities'
              ? 'bg-[#2A1E17] text-[#FBF7EE] shadow-sm font-semibold'
              : 'text-[#5E5043] hover:text-[#2A1E17] hover:bg-[#E8DDCB]'
          }`}
        >
          <Users className="w-4 h-4 text-[#D4A373]" />
          <span>{t.tabEntities} ({currentBook.charactersOrEntities.length})</span>
        </button>

        {(currentBook.isCombinedAnalysis || (currentBook.sourceDocuments && currentBook.sourceDocuments.length > 1) || currentBook.comparativeSynthesis) && (
          <button
            onClick={() => setActiveTab('comparative')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-sans-ui font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'comparative'
                ? 'bg-[#2A1E17] text-[#FBF7EE] shadow-sm font-semibold border border-[#D4A373]/50'
                : 'text-[#5E5043] hover:text-[#2A1E17] hover:bg-[#E8DDCB]'
            }`}
          >
            <Layers className="w-4 h-4 text-[#D4A373]" />
            <span>{t.tabComparative}</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-sans-ui font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'chat'
              ? 'bg-[#2A1E17] text-[#FBF7EE] shadow-sm font-semibold'
              : 'text-[#5E5043] hover:text-[#2A1E17] hover:bg-[#E8DDCB]'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-[#D4A373]" />
          <span>{t.tabChat}</span>
        </button>

        <button
          onClick={() => setActiveTab('reader')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-sans-ui font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'reader'
              ? 'bg-[#2A1E17] text-[#FBF7EE] shadow-sm font-semibold'
              : 'text-[#5E5043] hover:text-[#2A1E17] hover:bg-[#E8DDCB]'
          }`}
        >
          <BookText className="w-4 h-4 text-[#D4A373]" />
          <span>{t.tabReader}</span>
        </button>

      </div>

      {/* Tab: Modern Remedies */}
      {activeTab === 'remedies' && (
        <ModernRemediesView
          book={currentBook}
          onUpdateBook={setCurrentBook}
        />
      )}

      {/* Tab 1: Executive Overview */}
      {activeTab === 'executive' && (() => {
        const currentUrdu = isUrdu ? (urduData || getSynchronousUrduContent(currentBook)) : null;

        const displayThesis = isUrdu
          ? (currentUrdu?.executiveSummary?.thesis || translateParagraphToUrdu(currentBook.executiveSummary.thesis))
          : currentBook.executiveSummary.thesis;

        const displayOverview = isUrdu
          ? (currentUrdu?.executiveSummary?.overview || translateParagraphToUrdu(currentBook.executiveSummary.overview))
          : currentBook.executiveSummary.overview;

        const displayTakeaways = isUrdu
          ? (currentUrdu?.executiveSummary?.keyTakeaways && currentUrdu.executiveSummary.keyTakeaways.length > 0
              ? currentUrdu.executiveSummary.keyTakeaways
              : currentBook.executiveSummary.keyTakeaways.map(k => translateParagraphToUrdu(k)))
          : currentBook.executiveSummary.keyTakeaways;

        const displayQuotes = isUrdu
          ? (currentUrdu?.executiveSummary?.famousQuotes && currentUrdu.executiveSummary.famousQuotes.length > 0
              ? currentUrdu.executiveSummary.famousQuotes
              : currentBook.executiveSummary.famousQuotes.map(q => ({
                  quote: translateParagraphToUrdu(q.quote),
                  context: translateParagraphToUrdu(q.context)
                })))
          : currentBook.executiveSummary.famousQuotes;

        return (
          <div className="space-y-6">
            
            {/* Status alert when translating content */}
            {isUrdu && (
              <div className="bg-[#8C5A2B]/10 border border-[#8C5A2B]/30 rounded-xl p-3 px-4 flex items-center justify-between gap-3 text-xs font-sans-ui text-[#8C5A2B]">
                <div className="flex items-center gap-2">
                  <Languages className="w-4 h-4 text-[#8C5A2B] shrink-0" />
                  <span className="font-semibold">Urdu Content Mode Active (اردو ترجمہ):</span>
                  <span className="text-[#5E5043]">
                    {isTranslatingContent
                      ? 'Translating book content into scholarly Urdu...'
                      : 'Book exposition, thesis, chapters, and remedies are translated to Urdu. App navigation and interface remain in English.'}
                  </span>
                </div>
                {isTranslatingContent && (
                  <div className="flex items-center gap-1.5 text-xs text-[#8C5A2B]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Translating...</span>
                  </div>
                )}
              </div>
            )}

            {/* User Custom Directives Callout (If Provided) */}
            {currentBook.customInstructions && (
              <div className="bg-[#F4EDE2] border border-[#D8C8B4] rounded-xl p-4 flex items-start gap-3">
                <Target className="w-5 h-5 text-[#8C5A2B] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <h4 className="font-serif-display font-bold text-xs uppercase tracking-wider text-[#8C5A2B]">
                    {isUrdu ? 'مخصوص ہدایت نامہ و فوکس' : 'User Focus Directives & Specific Topics'}
                  </h4>
                  <p className="font-sans-ui text-xs text-[#2A1E17] italic">
                    "{currentBook.customInstructions}"
                  </p>
                </div>
              </div>
            )}

            {/* Core Thesis Hero Card */}
            <section className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-2xl p-4 sm:p-6 md:p-8 space-y-3 sm:space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-xs font-sans-ui font-semibold text-[#8C5A2B] uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" /> <span>Core Philosophical Thesis</span>
                </div>
              </div>
              <blockquote
                dir={isUrdu ? 'rtl' : 'ltr'}
                className={`font-serif-display font-medium text-lg sm:text-xl md:text-2xl text-[#2A1E17] leading-relaxed italic ${
                  isUrdu
                    ? 'border-r-4 pr-3 sm:pr-4 border-[#8C5A2B] font-urdu leading-loose text-right'
                    : 'border-l-4 pl-3 sm:pl-4 border-[#8C5A2B] text-left'
                }`}
              >
                "{displayThesis}"
              </blockquote>
            </section>

            {/* Audio Digest Player */}
            <AudioDigestPlayer
              summaryText={displayOverview}
              bookTitle={currentBook.title}
            />

            {/* Overview & Audience Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
              
              {/* Overview Prose */}
              <div className="lg:col-span-2 bg-[#FBF7EE] border border-[#E2D4C3] rounded-2xl p-4 sm:p-6 md:p-8 space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-[#E8DDCB]">
                  <h3 className="font-serif-display font-bold text-lg text-[#2A1E17]">
                    Executive Scholarly Exposition
                  </h3>
                </div>
                <p
                  dir={isUrdu ? 'rtl' : 'ltr'}
                  className={`font-serif-body leading-relaxed whitespace-pre-line max-w-3xl ${
                    isUrdu
                      ? 'font-urdu text-base md:text-lg leading-loose text-[#2A1E17] text-right'
                      : 'text-sm md:text-base text-[#3D2F24] text-left'
                  }`}
                >
                  {displayOverview}
                </p>
              </div>

              {/* Target Audience & Tone Sidebar */}
              <div className="space-y-6">
                <div className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-2xl p-6 space-y-3 shadow-sm">
                  <h4 className="font-serif-display font-bold text-base text-[#2A1E17]">
                    Target Audience
                  </h4>
                  <p className="font-serif-body text-xs text-[#5E5043] leading-relaxed">
                    {currentBook.executiveSummary.targetAudience}
                  </p>
                </div>

                <div className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-2xl p-6 space-y-3 shadow-sm">
                  <h4 className="font-serif-display font-bold text-base text-[#2A1E17]">
                    Tone & Stylistic Architecture
                  </h4>
                  <p className="font-serif-body text-xs text-[#5E5043] leading-relaxed">
                    {currentBook.executiveSummary.toneAndStyle}
                  </p>
                </div>
              </div>

            </div>

            {/* Key Takeaways Grid */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-serif-display font-bold text-xl text-[#2A1E17]">
                  High-Impact Key Takeaways
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayTakeaways.map((takeaway, idx) => (
                  <div
                    key={idx}
                    className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-xl p-5 flex items-start gap-4 shadow-sm"
                  >
                    <span className="w-8 h-8 rounded-lg bg-[#2A1E17] text-[#D4A373] font-sans-ui font-bold text-sm flex items-center justify-center shrink-0">
                      0{idx + 1}
                    </span>
                    <p
                      dir={isUrdu ? 'rtl' : 'ltr'}
                      className={`font-serif-body leading-relaxed flex-1 ${
                        isUrdu
                          ? 'font-urdu text-sm md:text-base leading-loose text-[#2A1E17] text-right'
                          : 'text-xs md:text-sm text-[#2A1E17] text-left'
                      }`}
                    >
                      {takeaway}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Famous Quotes Section */}
            {displayQuotes?.length > 0 && (
              <section className="space-y-4">
                <h3 className="font-serif-display font-bold text-xl text-[#2A1E17]">
                  Direct Verbatim Textual Citations
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {displayQuotes.map((q, idx) => (
                    <div
                      key={idx}
                      className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-xl p-5 flex flex-col justify-between space-y-3 shadow-sm relative group"
                    >
                      <Quote className="w-6 h-6 text-[#8C5A2B]/30 absolute top-4 right-4" />
                      <p
                        dir={isUrdu ? 'rtl' : 'ltr'}
                        className={`font-serif-body italic leading-relaxed pr-6 ${
                          isUrdu
                            ? 'font-urdu text-sm text-[#2A1E17] text-right leading-loose'
                            : 'text-xs md:text-sm text-[#2A1E17] text-left'
                        }`}
                      >
                        "{q.quote}"
                      </p>
                      <div className="flex items-center justify-between text-[11px] font-sans-ui text-[#7A6B5D] pt-2 border-t border-[#E8DDCB]">
                        <span>{q.context}</span>
                        <button
                          onClick={() => copyToClipboard(q.quote, idx)}
                          className="p-1 hover:text-[#2A1E17] transition-colors"
                          title="Copy Quote"
                        >
                          {copiedQuoteIndex === idx ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Share2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
        );
      })()}

      {/* Tab 2: Chapter Breakdowns */}
      {activeTab === 'chapters' && (
        <div className="space-y-6">
          
          {/* Search & Actions Header */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#F4EDE2] p-4 rounded-xl border border-[#E2D4C3]">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#8C7A6B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={chapterSearch}
                onChange={e => setChapterSearch(e.target.value)}
                placeholder={t.searchChaptersPlaceholder}
                className="w-full bg-[#FBF7EE] border border-[#D8C8B4] rounded-lg pl-9 pr-3 py-2 text-xs font-sans-ui text-[#2A1E17] focus:outline-none focus:border-[#8C5A2B]"
              />
            </div>
            <div className="flex items-center gap-2 justify-between sm:justify-end">
              <span className="text-xs font-sans-ui text-[#7A6B5D] hidden md:block">
                Showing {filteredChapters.length} of {currentBook.chapters.length} chapters
              </span>

              <button
                onClick={() => {
                  setExportChapterNum(1);
                  setIsPngExportOpen(true);
                }}
                className="px-3 py-2 bg-[#FBF7EE] hover:bg-[#E8DDCB] text-[#2A1E17] border border-[#D8C8B4] text-xs font-sans-ui font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Export chapter breakdowns as high-quality 3:4 PNG image cards"
              >
                <ImageIcon className="w-3.5 h-3.5 text-[#8C5A2B]" />
                <span className="hidden sm:inline">Export 3:4 PNG Cards</span>
                <span className="sm:hidden">3:4 PNG</span>
              </button>

              <button
                onClick={handleDeepenAllChapters}
                disabled={isDeepeningAll || deepeningChapterNum !== null}
                className="px-3.5 py-2 bg-[#2A1E17] hover:bg-[#3D2F24] disabled:opacity-50 text-[#FBF7EE] text-xs font-sans-ui font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Run multi-step iterative analysis across all chapters to maximize granularity"
              >
                {isDeepeningAll ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4A373]" />
                    <span>Iterating All...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#D4A373]" />
                    <span>{t.deepenAll}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Multi-Step Iterative Analysis Status Banner */}
          <div className="bg-[#EFE7D8]/80 border border-[#D8C8B4] rounded-xl p-3.5 px-4 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs font-sans-ui text-[#5E5043]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse shrink-0" />
              <span className="font-semibold text-[#2A1E17]">
                Multi-Step Iterative Analysis Active:
              </span>
              <span>
                Close Textual Reading → Premise Deconstruction → 3-5 Paragraph Synthesis → Direct Citations
              </span>
            </div>
            <span className="text-[11px] text-[#8C5A2B] font-medium bg-[#FBF7EE] px-2.5 py-0.5 rounded border border-[#D8C8B4] w-fit">
              Granular 3-5 Paragraph Exegesis
            </span>
          </div>

          {/* Chapter Accordion List */}
          <div className="space-y-4">
            {filteredChapters.map(ch => {
              const isExpanded = expandedChapter === ch.number;
              const currentUrdu = isUrdu ? (urduData || getSynchronousUrduContent(currentBook)) : null;
              const chUrdu = currentUrdu?.chapters?.find(c => c.number === ch.number);
              const chTitle = isUrdu ? (chUrdu?.title || translateParagraphToUrdu(ch.title)) : ch.title;
              const rawSummary = isUrdu ? (chUrdu?.summary || translateParagraphToUrdu(ch.summary)) : ch.summary;
              const summaryParagraphs = rawSummary ? rawSummary.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean) : [];
              const paragraphLabels = [
                '1. Foundational Setting & Primary Thesis',
                '2. Core Analytical Premises & Mechanisms',
                '3. Dialectical Counter-Arguments & Qualifications',
                '4. Ethical & Philosophical Ramifications',
                '5. Practical Synthesis & Roadmap'
              ];

              return (
                <div
                  key={ch.number}
                  className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-2xl overflow-hidden shadow-sm transition-all"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedChapter(isExpanded ? null : ch.number)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedChapter(isExpanded ? null : ch.number);
                      }
                    }}
                    className="w-full p-4 sm:p-5 md:p-6 text-left flex items-start sm:items-center justify-between gap-2.5 sm:gap-4 hover:bg-[#F4EDE2] transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#2A1E17] text-[#D4A373] font-sans-ui font-bold text-xs sm:text-sm flex items-center justify-center shrink-0">
                        {ch.number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <h3 className="font-serif-display font-bold text-sm sm:text-base md:text-lg text-[#2A1E17] line-clamp-2 sm:truncate">
                            Chapter {ch.number}: <span className={isUrdu ? 'font-urdu' : ''}>{chTitle}</span>
                          </h3>
                          <span className="text-[10px] font-sans-ui font-semibold text-[#8C5A2B] bg-[#E8DDCB] px-2 py-0.5 rounded shrink-0">
                            {summaryParagraphs.length} Paragraphs
                          </span>
                          {ch.keyQuotes?.length > 0 && (
                            <span className="hidden xs:inline-block text-[10px] font-sans-ui font-semibold text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                              {ch.keyQuotes.length} Citations
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] sm:text-xs font-sans-ui text-[#7A6B5D] mt-0.5">
                          Est. {ch.readTimeMinutes} min study
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExportChapterNum(ch.number);
                          setIsPngExportOpen(true);
                        }}
                        className="min-h-[34px] px-2 sm:px-2.5 py-1 text-xs font-sans-ui font-medium bg-[#2A1E17] hover:bg-[#3D2C22] text-[#D4A373] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Extract Chapter as 3:4 High Quality PNG Image"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-[#D4A373]" />
                        <span className="hidden sm:inline text-[11px]">3:4 PNG</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeepenChapter(ch.number);
                        }}
                        disabled={deepeningChapterNum === ch.number}
                        className="min-h-[34px] px-2 sm:px-2.5 py-1 text-xs font-sans-ui font-medium bg-[#E8DDCB] hover:bg-[#D4A373]/30 disabled:opacity-50 text-[#8C5A2B] border border-[#D8C8B4] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Execute multi-step iterative analysis on this chapter"
                      >
                        {deepeningChapterNum === ch.number ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8C5A2B]" />
                            <span className="hidden sm:inline text-[11px]">{t.iterating}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-[#8C5A2B]" />
                            <span className="hidden sm:inline text-[11px]">{t.deepenSection}</span>
                          </>
                        )}
                      </button>

                      <ChevronRight
                        className={`w-5 h-5 text-[#8C5A2B] transition-transform duration-200 shrink-0 ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 sm:p-6 md:p-8 pt-0 border-t border-[#E8DDCB] bg-[#F9F4EB]/50 space-y-5 sm:space-y-6">
                      
                      {/* Multi-Step Iterative Analysis Pipeline Card */}
                      {ch.sectionAnalysisSteps && (
                        <div className="bg-[#EFE7D8]/90 border border-[#D8C8B4] rounded-xl p-4 space-y-3 mt-4">
                          <div className="flex items-center justify-between text-xs font-sans-ui font-semibold text-[#8C5A2B] uppercase tracking-wider">
                            <span className="flex items-center gap-1.5">
                              <Target className="w-3.5 h-3.5" /> {t.multiStepPipeline}
                            </span>
                            <span className="text-[11px] text-[#5E5043] font-normal normal-case">
                              Pre-output analytical progression
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-lg p-3 space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C5A2B] block">{t.step1Label}</span>
                              <p className="text-xs font-serif-body text-[#3D2F24] leading-snug">
                                {ch.sectionAnalysisSteps.step1CloseReading}
                              </p>
                            </div>
                            <div className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-lg p-3 space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C5A2B] block">{t.step2Label}</span>
                              <p className="text-xs font-serif-body text-[#3D2F24] leading-snug">
                                {ch.sectionAnalysisSteps.step2PremiseDeconstruction}
                              </p>
                            </div>
                            <div className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-lg p-3 space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C5A2B] block">{t.step3Label}</span>
                              <p className="text-xs font-serif-body text-[#3D2F24] leading-snug">
                                {ch.sectionAnalysisSteps.step3Synthesis}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 3-5 Paragraph Comprehensive Summary */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-sans-ui font-semibold text-[#8C5A2B] uppercase tracking-wider flex items-center gap-1.5">
                            <ScrollText className="w-3.5 h-3.5" />
                            <span>Granular Chapter Exposition ({summaryParagraphs.length} Paragraphs)</span>
                          </h4>
                          <span className="text-[11px] text-[#7A6B5D] font-sans-ui">
                            3-5 Paragraph Analytical Synthesis
                          </span>
                        </div>

                        <div className="space-y-3">
                          {summaryParagraphs.map((para, pIdx) => (
                            <div
                              key={pIdx}
                              className="bg-[#FBF7EE] border-2 border-[#D8C8B4] border-l-4 border-l-[#8C5A2B] rounded-xl p-4 md:p-5 space-y-2 shadow-xs transition-colors"
                            >
                              <span className="text-[11px] font-sans-ui font-semibold uppercase tracking-wider text-[#8C5A2B] block">
                                {paragraphLabels[pIdx] || `Paragraph ${pIdx + 1} · Detailed Exposition`}
                              </span>
                              <p
                                dir={isUrdu ? 'rtl' : 'ltr'}
                                className={`font-serif-body leading-relaxed ${
                                  isUrdu
                                    ? 'font-urdu text-base leading-loose text-[#2A1E17] text-right'
                                    : 'text-sm md:text-base text-[#2A1E17] text-left'
                                }`}
                              >
                                {para}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Direct Verbatim Textual Citations from User-Provided Book Text */}
                      {ch.keyQuotes?.length > 0 && (
                        <div className="space-y-3 pt-3 border-t border-[#E8DDCB]">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-sans-ui font-semibold text-[#8C5A2B] uppercase tracking-wider flex items-center gap-1.5">
                              <Quote className="w-3.5 h-3.5" />
                              <span>{t.directSourceCitations} ({ch.keyQuotes.length})</span>
                            </h4>
                            <span className="text-[11px] text-[#7A6B5D] font-sans-ui">
                              Extracted verbatim from provided manuscript
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {ch.keyQuotes.map((q, qIdx) => (
                              <div
                                key={qIdx}
                                className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-xl p-4 flex flex-col justify-between space-y-2.5 relative group hover:border-[#8C5A2B]/40 transition-colors shadow-xs"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-[10px] font-sans-ui font-bold text-[#8C5A2B] uppercase tracking-wider bg-[#E8DDCB] px-2 py-0.5 rounded">
                                    Citation {qIdx + 1}
                                  </span>
                                  <button
                                    onClick={() => copyChapterQuote(q)}
                                    className="p-1 hover:text-[#2A1E17] text-[#8C7A6B] transition-colors"
                                    title="Copy verbatim citation"
                                  >
                                    {copiedChapterQuote === q ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Share2 className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                                <blockquote className="font-serif-body italic text-xs md:text-sm text-[#2A1E17] leading-relaxed">
                                  "{q.replace(/^["']|["']$/g, '')}"
                                </blockquote>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Detailed Scholarly Analysis */}
                      {ch.detailedAnalysis && (
                        <div className="space-y-2 bg-[#F4EDE2]/80 border border-[#E2D4C3] rounded-xl p-4">
                          <h4 className="text-xs font-sans-ui font-semibold text-[#8C5A2B] uppercase tracking-wider">
                            Detailed Scholarly Commentary & Logical Architecture
                          </h4>
                          <p className="font-serif-body text-xs md:text-sm text-[#2A1E17] leading-relaxed whitespace-pre-line">
                            {ch.detailedAnalysis}
                          </p>
                        </div>
                      )}

                      {/* Historical Context */}
                      {ch.historicalContext && (
                        <div className="space-y-2 bg-[#FBF7EE] border border-[#E2D4C3] rounded-xl p-4">
                          <h4 className="text-xs font-sans-ui font-semibold text-[#8C5A2B] uppercase tracking-wider">
                            Historical & Philosophical Context
                          </h4>
                          <p className="font-serif-body text-xs text-[#5E5043] leading-relaxed">
                            {ch.historicalContext}
                          </p>
                        </div>
                      )}

                      {/* Key Events / Arguments */}
                      {ch.keyEvents?.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-sans-ui font-semibold text-[#8C5A2B] uppercase tracking-wider">
                            Key Arguments & Critical Events ({ch.keyEvents.length})
                          </h4>
                          <ul className="space-y-2">
                            {ch.keyEvents.map((ev, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-xs font-serif-body text-[#2A1E17]">
                                <span className="text-[#8C5A2B] font-bold mt-0.5">•</span>
                                <span>{ev}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* Tab 3: Concepts & Scholars */}
      {activeTab === 'entities' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {currentBook.charactersOrEntities.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-2xl p-6 space-y-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif-display font-bold text-lg text-[#2A1E17]">
                      {item.name}
                    </h3>
                    <span className="inline-block px-2 py-0.5 text-[10px] font-sans-ui font-medium uppercase tracking-wider text-[#8C5A2B] bg-[#F4EDE2] border border-[#E2D4C3] rounded mt-1">
                      {item.role}
                    </span>
                  </div>
                </div>

                <p className="font-serif-body text-xs md:text-sm text-[#3D2F24] leading-relaxed">
                  {item.description}
                </p>

                {item.keyQuotesOrPassages?.length > 0 && (
                  <div className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-xl p-3.5 space-y-1">
                    <span className="text-[10px] font-sans-ui font-semibold text-[#8C5A2B] uppercase">
                      Passage Reference
                    </span>
                    <p className="font-serif-body italic text-xs text-[#2A1E17]">
                      "{item.keyQuotesOrPassages[0]}"
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Themes Section */}
          {currentBook.themes?.length > 0 && (
            <div className="pt-6 border-t border-[#E8DDCB] space-y-4">
              <h3 className="font-serif-display font-bold text-xl text-[#2A1E17]">
                Central Themes & Spiritual Motifs
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {currentBook.themes.map((t, idx) => (
                  <div
                    key={idx}
                    className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-2xl p-6 space-y-3 shadow-sm"
                  >
                    <h4 className="font-serif-display font-bold text-base text-[#2A1E17]">
                      {t.title}
                    </h4>
                    <p className="font-serif-body text-xs text-[#3D2F24] leading-relaxed">
                      {t.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Cross-Document Comparative Matrix & Synthesis */}
      {activeTab === 'comparative' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Comparative Synthesis Banner */}
          <div className="bg-[#2A1E17] text-[#FBF7EE] rounded-2xl p-4 sm:p-6 md:p-8 shadow-md border border-[#423126] space-y-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#8C5A2B]/15 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-[#8C5A2B]/30 border border-[#8C5A2B]/40 text-[11px] font-sans-ui text-[#D4A373]">
                  <Layers className="w-3.5 h-3.5" />
                  <span>{t.comparativeBannerTag}</span>
                </div>
                <h3 className="font-serif-display font-bold text-xl sm:text-2xl text-[#FAF5EC]">
                  {t.comparativeBannerTitle}: {currentBook.title}
                </h3>
                <p className="font-serif-body text-xs md:text-sm text-[#D8C8B4] max-w-3xl leading-relaxed">
                  {t.comparativeBannerDesc}
                </p>
              </div>

              {/* Document Pills */}
              {currentBook.sourceDocuments && (
                <div className="flex flex-col gap-1.5 w-full md:w-auto md:shrink-0 bg-[#3D2C22]/80 border border-[#523D30] p-3 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-[#D4A373] tracking-wider">
                    {t.contributingTexts} ({currentBook.sourceDocuments.length})
                  </span>
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {currentBook.sourceDocuments.map((s, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] bg-[#2A1E17] text-[#E8DDCB] px-2 py-0.5 rounded border border-[#6E5341]"
                      >
                        {s.title} ({(s.wordCount / 1000).toFixed(0)}k {t.wordsLabel})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 1. Cross-Document Comparative Matrix */}
          <div className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-[#E8DDCB] pb-3">
              <div>
                <h4 className="font-serif-display font-bold text-lg text-[#2A1E17] flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#8C5A2B]" />
                  <span>{t.thematicComparisonMatrix}</span>
                </h4>
                <p className="text-xs font-sans-ui text-[#7A6B5D] mt-0.5">
                  {t.thematicComparisonDesc}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {(currentBook.comparativeSynthesis?.crossDocumentMatrix || [
                {
                  topic: isUrdu ? 'علم کا بنیادی فلسفیانہ مقدمہ' : 'Foundational Premise of Knowledge',
                  docPositions: (currentBook.sourceDocuments || [{ title: 'Text 1' }, { title: 'Text 2' }]).map((d, i) => ({
                    docTitle: d.title,
                    position: i % 2 === 0
                      ? (isUrdu ? 'روحانی پاکیزگی اور تزکیۂ نفس حقیقی ادراک و فہم کی ناگزیر شرط ہے۔' : 'Character cultivation and spiritual purification are the prerequisites for authentic comprehension.')
                      : (isUrdu ? 'تاریخ اور انسانی معاشرت کا تجرباتی مشاہدہ اجتماعی قوانین کو عیاں کرتا ہے۔' : 'Empirical observation of history and civilization reveals the natural laws of human association.')
                  })),
                  consensusOrDivergence: 'Complementary' as const,
                  synthesisNote: isUrdu ? 'اخلاق کے بغیر علم اخلاقی زوال پیدا کرتا ہے، جبکہ عملی تفہیم کے بغیر اخلاق غیر مؤثر ثابت ہوتا ہے۔' : 'Knowledge without virtue produces moral decay, while virtue without practical understanding produces ineffective action.'
                },
                {
                  topic: isUrdu ? 'اصلاح کا دائرہ کار اور عمل' : 'Locus of Reform & Agency',
                  docPositions: (currentBook.sourceDocuments || [{ title: 'Text 1' }, { title: 'Text 2' }]).map((d, i) => ({
                    docTitle: d.title,
                    position: i === 0
                      ? (isUrdu ? 'باطنی اصلاح سے آغاز: ضبط نفس اور خواہشات پر قابو۔' : 'Begins internally: personal vigilance, restraint of appetites, and conscious habituation.')
                      : (isUrdu ? 'اجتماعی سطح پر نفاذ: باہمی یکجہتی اور عادلانہ ادارہ جاتی نظام۔' : 'Operates communally: solidarity, mutual accountability, and protective institutional design.')
                  })),
                  consensusOrDivergence: 'Consensus' as const,
                  synthesisNote: isUrdu ? 'نہ صرف باطنی تزکیہ کافی ہے اور نہ محض ظاہری ادارے؛ دونوں ایک دوسرے کے معاون تمدنی ستون ہیں۔' : 'Neither internal discipline nor external institutions suffice alone; they form an interlocking civilizational pillar.'
                }
              ]).map((row, rIdx) => {
                const badgeLabel = 
                  row.consensusOrDivergence === 'Consensus'
                    ? 'Consensus'
                    : row.consensusOrDivergence === 'Divergence'
                    ? 'Divergence'
                    : 'Complementary';

                const badgeColor = 
                  row.consensusOrDivergence === 'Consensus'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : row.consensusOrDivergence === 'Divergence'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-indigo-100 text-indigo-800 border-indigo-300';

                return (
                  <div
                    key={rIdx}
                    className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-xl p-5 space-y-4 shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <h5 className={`font-serif-display font-bold text-base text-[#2A1E17] ${isUrdu ? 'font-urdu' : ''}`}>
                        {row.topic}
                      </h5>
                      <span className={`text-[10px] font-sans-ui font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
                        {badgeLabel}
                      </span>
                    </div>

                    {/* Positions Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {row.docPositions?.map((dp, pIdx) => (
                        <div
                          key={pIdx}
                          className="bg-[#FBF7EE] border border-[#D8C8B4] rounded-lg p-3 space-y-1.5"
                        >
                          <span className="text-[10px] font-sans-ui font-bold uppercase tracking-wider text-[#8C5A2B] bg-[#E8DDCB] px-2 py-0.5 rounded inline-block">
                            {dp.docTitle}
                          </span>
                          <p
                            dir={isUrdu ? 'rtl' : 'ltr'}
                            className={`font-serif-body text-xs text-[#2A1E17] leading-relaxed ${isUrdu ? 'font-urdu text-right text-sm leading-loose' : ''}`}
                          >
                            {dp.position}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Synergistic Synthesis Note */}
                    <div className="bg-[#EFE7D8] border-l-4 border-[#8C5A2B] rounded-r-lg p-3 text-xs font-serif-body text-[#3D2F24] leading-relaxed">
                      <strong className="font-sans-ui text-[#8C5A2B] block text-[11px] uppercase tracking-wider mb-0.5">
                        {t.synergisticInsight}
                      </strong>
                      <p
                        dir={isUrdu ? 'rtl' : 'ltr'}
                        className={isUrdu ? 'font-urdu text-right text-sm leading-loose' : ''}
                      >
                        {row.synthesisNote}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Dialectical Tensions & Debate Points */}
          <div className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-[#E8DDCB] pb-3">
              <div>
                <h4 className="font-serif-display font-bold text-lg text-[#2A1E17] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#8C5A2B]" />
                  <span>{t.dialecticalTensionsTitle}</span>
                </h4>
                <p className="text-xs font-sans-ui text-[#7A6B5D] mt-0.5">
                  {t.dialecticalTensionsDesc}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {(currentBook.comparativeSynthesis?.dialecticalTensions || [
                {
                  issue: isUrdu ? 'باطنی تزکیہ بمقابلہ ظاہری ادارہ جاتی حکمرانی' : 'Interior Purification vs. Exterior Institutional Governance',
                  opposingViews: (currentBook.sourceDocuments || [{ title: 'Text 1' }, { title: 'Text 2' }]).map((d, i) => ({
                    docTitle: d.title,
                    stance: i === 0
                      ? (isUrdu ? 'اگر افراد کے قلوب فاسد ہوں تو کوئی سیاسی نظام اخلاقی زوال کا علاج نہیں کر سکتا۔' : 'No political system can remedy moral decay if individual hearts remain corrupt.')
                      : (isUrdu ? 'عادلانہ قوانین اور سماجی ہم آہنگی کے بغیر انفرادی تقویٰ کو جبری طاقت آسانی سے دبا دیتی ہے۔' : 'Without equitable laws and social cohesion, personal virtue is easily suppressed by coercive power.')
                  })),
                  resolutionOrInsight: isUrdu ? 'انفرادی اخلاق عادلانہ اداروں کے قیام کا فکری جذبہ فراہم کرتا ہے، جبکہ عادلانہ ادارے انفرادی کردار کی نشوونما کے لیے ضروری تحفظ فراہم کرتے ہیں۔' : 'Personal ethics provide the moral impulse to build just institutions, while just institutions create the sanctuary needed for individual character to thrive.'
                }
              ]).map((tension, tIdx) => (
                <div
                  key={tIdx}
                  className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-xl p-5 space-y-4 shadow-xs"
                >
                  <h5 className={`font-serif-display font-bold text-base text-[#2A1E17] ${isUrdu ? 'font-urdu' : ''}`}>
                    Tension {tIdx + 1}: {tension.issue}
                  </h5>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {tension.opposingViews?.map((ov, vIdx) => (
                      <div
                        key={vIdx}
                        className="bg-[#FBF7EE] border border-[#D8C8B4] rounded-lg p-3 space-y-1.5"
                      >
                        <span className="text-[10px] font-sans-ui font-bold text-[#8C5A2B] uppercase tracking-wider block">
                          Perspective: {ov.docTitle}
                        </span>
                        <p
                          dir={isUrdu ? 'rtl' : 'ltr'}
                          className={`font-serif-body text-xs text-[#2A1E17] leading-relaxed ${isUrdu ? 'font-urdu text-right text-sm leading-loose' : ''}`}
                        >
                          {ov.stance}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#EFE7D8] border border-[#D8C8B4] rounded-lg p-3.5 space-y-1">
                    <span className="text-[10px] font-sans-ui font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded inline-block">
                      {t.philosophicalResolution}
                    </span>
                    <p
                      dir={isUrdu ? 'rtl' : 'ltr'}
                      className={`font-serif-body text-xs md:text-sm text-[#2A1E17] leading-relaxed ${isUrdu ? 'font-urdu text-right leading-loose' : ''}`}
                    >
                      {tension.resolutionOrInsight}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Cross-Document Thematic Bridges */}
          {currentBook.comparativeSynthesis?.crossDocumentThemes && currentBook.comparativeSynthesis.crossDocumentThemes.length > 0 && (
            <div className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-2xl p-6 shadow-sm space-y-4">
              <h4 className="font-serif-display font-bold text-lg text-[#2A1E17] border-b border-[#E8DDCB] pb-3">
                {t.thematicBridgesTitle}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentBook.comparativeSynthesis.crossDocumentThemes.map((thm, idx) => (
                  <div
                    key={idx}
                    className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-xl p-4 space-y-2"
                  >
                    <h5 className="font-serif-display font-bold text-sm text-[#2A1E17]">
                      {thm.theme}
                    </h5>
                    <p className="font-serif-body text-xs text-[#3D2F24] leading-relaxed">
                      {thm.synthesis}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Contributing Source Documents Roster */}
          {currentBook.sourceDocuments && currentBook.sourceDocuments.length > 0 && (
            <div className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#E8DDCB] pb-3">
                <div>
                  <h4 className="font-serif-display font-bold text-lg text-[#2A1E17]">
                    {t.contributingSourceManuscripts} ({currentBook.sourceDocuments.length})
                  </h4>
                  <p className="text-xs font-sans-ui text-[#7A6B5D] mt-0.5">
                    Original texts uploaded and incorporated into this combined analysis corpus
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentBook.sourceDocuments.map((sDoc, sIdx) => (
                  <div
                    key={sIdx}
                    className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-xl p-4 space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs font-sans-ui text-[#7A6B5D] mb-1">
                        <span className="font-bold text-[#8C5A2B]">
                          Document {sIdx + 1}
                        </span>
                        <span>{sDoc.wordCount.toLocaleString()} words</span>
                      </div>
                      <h5 className="font-serif-display font-bold text-base text-[#2A1E17]">
                        {sDoc.title}
                      </h5>
                      {sDoc.author && (
                        <p className="font-serif-body italic text-xs text-[#6B5B4D] mb-2">
                          by {sDoc.author}
                        </p>
                      )}
                      {sDoc.previewText && (
                        <p className="font-serif-body text-xs text-[#4A3B2E] line-clamp-3 bg-[#FBF7EE] border border-[#E2D4C3] p-2.5 rounded-lg">
                          "{sDoc.previewText}..."
                        </p>
                      )}
                    </div>

                    <div className="pt-2 text-[11px] font-sans-ui text-[#8C7A6B] flex items-center justify-between">
                      <span>Source: {sDoc.fileName || 'Uploaded text'}</span>
                      <button
                        onClick={() => setActiveTab('chapters')}
                        className="text-[#8C5A2B] hover:underline font-medium"
                      >
                        View Chapter Outlines →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Tab 4: Ask Wisdom Assistant */}
      {activeTab === 'chat' && (
        <AskWisdomChat book={currentBook} />
      )}

      {/* Tab 5: Reader View */}
      {activeTab === 'reader' && (
        <div className="space-y-4">
          
          {/* Reader Toolbar */}
          <div className="bg-[#F4EDE2] border border-[#E2D4C3] p-3 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs font-sans-ui text-[#5E5043]">
            
            {/* Font Size Selector */}
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#2A1E17]">Font Size:</span>
              {(['sm', 'base', 'lg', 'xl'] as const).map(size => (
                <button
                  key={size}
                  onClick={() => setReaderFontSize(size)}
                  className={`px-2 py-1 rounded text-xs uppercase ${
                    readerFontSize === size ? 'bg-[#2A1E17] text-[#FBF7EE] font-bold' : 'hover:bg-[#E8DDCB]'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>

            {/* Paper Tint Selector */}
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#2A1E17]">Background:</span>
              <button
                onClick={() => setReaderBg('sand')}
                className={`px-2.5 py-1 rounded text-xs ${
                  readerBg === 'sand' ? 'bg-[#2A1E17] text-[#FBF7EE] font-bold' : 'bg-[#FBF7EE] text-[#2A1E17] border border-[#D8C8B4]'
                }`}
              >
                Warm Sand
              </button>
              <button
                onClick={() => setReaderBg('sepia')}
                className={`px-2.5 py-1 rounded text-xs ${
                  readerBg === 'sepia' ? 'bg-[#2A1E17] text-[#FBF7EE] font-bold' : 'bg-[#F2E3C6] text-[#3D2A1C] border border-[#D8C8B4]'
                }`}
              >
                Sepia
              </button>
              <button
                onClick={() => setReaderBg('light')}
                className={`px-2.5 py-1 rounded text-xs ${
                  readerBg === 'light' ? 'bg-[#2A1E17] text-[#FBF7EE] font-bold' : 'bg-[#FFFFFF] text-[#2A1E17] border border-[#D8C8B4]'
                }`}
              >
                Pure Light
              </button>
            </div>

          </div>

          {/* Reader Manuscript Body */}
          <div
            className={`p-4 sm:p-8 md:p-12 rounded-2xl border border-[#E2D4C3] shadow-sm max-w-4xl mx-auto space-y-5 sm:space-y-6 transition-colors ${
              readerBg === 'sand'
                ? 'bg-[#FBF7EE] text-[#2A1E17]'
                : readerBg === 'sepia'
                ? 'bg-[#F2E3C6] text-[#3D2A1C]'
                : 'bg-[#FFFFFF] text-[#1F1914]'
            }`}
          >
            <div className="border-b border-[#E8DDCB] pb-4 sm:pb-6 text-center space-y-2">
              <h2 className="font-serif-display font-bold text-xl sm:text-2xl md:text-3xl">
                {currentBook.title}
              </h2>
              <p className="font-serif-body italic text-sm text-[#7A6B5D]">
                by {currentBook.author}
              </p>
            </div>

            <div
              dir="auto"
              className={`font-serif-body leading-relaxed whitespace-pre-line ${
                readerFontSize === 'sm'
                  ? 'text-xs'
                  : readerFontSize === 'base'
                  ? 'text-sm'
                  : readerFontSize === 'lg'
                  ? 'text-base'
                  : 'text-lg'
              }`}
            >
              {currentBook.rawTextPreview}
            </div>
          </div>

        </div>
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        book={currentBook}
        onOpenPngModal={() => {
          setExportChapterNum(1);
          setIsPngExportOpen(true);
        }}
      />

      {/* 3:4 PNG Chapter Card Export Modal */}
      <ChapterPngExportModal
        isOpen={isPngExportOpen}
        onClose={() => setIsPngExportOpen(false)}
        book={currentBook}
        initialChapterNumber={exportChapterNum}
      />

    </div>
  );
};
