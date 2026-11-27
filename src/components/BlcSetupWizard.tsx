import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Layers,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Sparkles,
  Upload,
  AlertCircle,
} from 'lucide-react';
import {
  BlcCadence,
  BlcLiteralPartSize,
  BlcPacingMode,
  BlcPlan,
  BlcPlanLanguageMode,
  BlcScheduleConfig,
  BlcSessionPlan,
  ParsedBookForBlc,
} from '../types/blc';
import {
  calculatePacingMetrics,
  detectPrimaryBookLanguage,
  extractSessionExcerpt,
  parseBookPages,
  partitionBookIntoSessions,
} from '../utils/blcBookParser';
import { saveBlcBookPages } from '../utils/blcLiteralStorage';
import { fetchWithRetry } from '../utils/fetchWithRetry';

interface BlcSetupWizardProps {
  onPlanGenerated: (plan: BlcPlan) => void;
  onCancel?: () => void;
  hasExistingPlans: boolean;
}

export const BlcSetupWizard: React.FC<BlcSetupWizardProps> = ({
  onPlanGenerated,
  onCancel,
  hasExistingPlans,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isDragging, setIsDragging] = useState(false);

  // Step 1: Parsing & Metadata
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedBook, setParsedBook] = useState<ParsedBookForBlc | null>(null);

  const [bookTitle, setBookTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [circleName, setCircleName] = useState('');
  const [focusGoals, setFocusGoals] = useState('');
  const [showChapterPreview, setShowChapterPreview] = useState(false);

  // Step 2: Pacing & Duration Config
  const [pacingMode, setPacingMode] = useState<BlcPacingMode>('by_reading_minutes');
  const [targetReadingMinutes, setTargetReadingMinutes] = useState<number>(25);
  const [durationWeeks, setDurationWeeks] = useState<number>(8);
  const [cadence, setCadence] = useState<BlcCadence>('weekly');
  const [sessionsPerWeek, setSessionsPerWeek] = useState<number>(1);
  const [meetingDurationMinutes, setMeetingDurationMinutes] = useState<number>(60);
  const [readingSpeedWpm, setReadingSpeedWpm] = useState<number>(200);
  const [startDate, setStartDate] = useState<string>('');
  const [overrideSessions, setOverrideSessions] = useState<number | undefined>(undefined);
  const [planLanguageMode, setPlanLanguageMode] = useState<BlcPlanLanguageMode>('auto');
  const [injectDiscussionPrompts, setInjectDiscussionPrompts] = useState<boolean>(true);
  const [includeLiteralText, setIncludeLiteralText] = useState<boolean>(true);
  const [literalPartSize, setLiteralPartSize] = useState<BlcLiteralPartSize>('standard');

  // Step 3: AI Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState<{
    completedSessions: number;
    totalSessions: number;
    currentRangeLabel: string;
  }>({
    completedSessions: 0,
    totalSessions: 0,
    currentRangeLabel: '',
  });
  const [partialSessions, setPartialSessions] = useState<BlcSessionPlan[]>([]);
  const [partialOverview, setPartialOverview] = useState<{
    overallSummary: string;
    learningArcOutcomes: string[];
  } | null>(null);

  const detectedBookLanguage = useMemo(
    () => (parsedBook ? detectPrimaryBookLanguage(parsedBook.pages) : 'English'),
    [parsedBook]
  );

  const scheduleConfig: BlcScheduleConfig = useMemo(
    () => ({
      circleName: circleName.trim() || `${bookTitle.trim() || 'Book'} BLC`,
      pacingMode,
      targetReadingMinutes,
      durationWeeks,
      cadence,
      sessionsPerWeek,
      meetingDurationMinutes,
      readingSpeedWpm,
      startDate: startDate || undefined,
      focusGoals: focusGoals.trim() || undefined,
      planLanguageMode,
      injectDiscussionPrompts,
      includeLiteralText,
      literalPartSize,
    }),
    [
      circleName,
      bookTitle,
      pacingMode,
      targetReadingMinutes,
      durationWeeks,
      cadence,
      sessionsPerWeek,
      meetingDurationMinutes,
      readingSpeedWpm,
      startDate,
      focusGoals,
      planLanguageMode,
      injectDiscussionPrompts,
      includeLiteralText,
      literalPartSize,
    ]
  );

  const metrics = useMemo(() => {
    if (!parsedBook) return null;
    return calculatePacingMetrics(
      parsedBook.totalWords,
      parsedBook.totalPages,
      scheduleConfig,
      overrideSessions
    );
  }, [parsedBook, scheduleConfig, overrideSessions]);

  const sessionPreviews = useMemo(() => {
    if (!parsedBook) return [];
    return partitionBookIntoSessions(parsedBook, scheduleConfig, overrideSessions);
  }, [parsedBook, scheduleConfig, overrideSessions]);

  const handleFileSelected = async (file: File) => {
    setParseError(null);
    setIsParsing(true);
    setParseProgress({ current: 0, total: 0 });

    try {
      const parsed = await parseBookPages(file, (current, total) => {
        setParseProgress({ current, total });
      });
      setParsedBook(parsed);
      setBookTitle(parsed.title);
      setAuthor(parsed.author);
      setCircleName(`${parsed.title} — Wisdom Lounge BLC`);
      setOverrideSessions(undefined);
    } catch (err: any) {
      setParseError(err?.message || 'Could not parse the uploaded book.');
      setParsedBook(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  };

  const runBatchedGeneration = async (resumeFromIndex = 0) => {
    if (!parsedBook || sessionPreviews.length === 0) return;

    setStep(3);
    setIsGenerating(true);
    setGenError(null);

    const batchSize = 1;
    const total = sessionPreviews.length;
    let accumulatedSessions: BlcSessionPlan[] =
      resumeFromIndex > 0 ? [...partialSessions] : [];
    let overviewData = resumeFromIndex > 0 ? partialOverview : null;

    try {
      for (let i = resumeFromIndex; i < total; i += batchSize) {
        const chunk = sessionPreviews.slice(i, i + batchSize);
        const firstNum = chunk[0].sessionNumber;
        const lastNum = chunk[chunk.length - 1].sessionNumber;

        setGenProgress({
          completedSessions: accumulatedSessions.length,
          totalSessions: total,
          currentRangeLabel:
            firstNum === lastNum
              ? `Session ${firstNum} of ${total}`
              : `Sessions ${firstNum}–${lastNum} of ${total}`,
        });

        const payloadSessions = chunk.map(part => ({
          sessionNumber: part.sessionNumber,
          startPage: part.startPage,
          endPage: part.endPage,
          chaptersCovered: part.chaptersCovered,
          wordCount: part.wordCount,
          estimatedReadingMinutes: part.estimatedReadingMinutes,
          scheduledDate: part.scheduledDate,
          excerpt: extractSessionExcerpt(parsedBook, part.startPage, part.endPage, 6000),
        }));

        const contentLanguage =
          planLanguageMode === 'urdu' ? 'Urdu' : detectedBookLanguage;

        const response = await fetchWithRetry('/api/blc-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookTitle: bookTitle.trim() || parsedBook.title,
            author: author.trim(),
            circleName: scheduleConfig.circleName,
            totalPages: parsedBook.totalPages,
            totalWords: parsedBook.totalWords,
            meetingDurationMinutes: scheduleConfig.meetingDurationMinutes,
            focusGoals: scheduleConfig.focusGoals || '',
            contentLanguage,
            writeInUrdu: planLanguageMode === 'urdu',
            includeOverview: i === 0,
            sessions: payloadSessions,
          }),
        });

        let data: any = {};
        const rawRespText = await response.text();
        try {
          data = rawRespText ? JSON.parse(rawRespText) : {};
        } catch {
          data = { error: rawRespText || `Server error (${response.status})` };
        }

        if (!response.ok) {
          throw new Error(data?.error || `Server error (${response.status}) during session planning.`);
        }

        if (i === 0 && data.overallSummary) {
          overviewData = {
            overallSummary: data.overallSummary,
            learningArcOutcomes: Array.isArray(data.learningArcOutcomes)
              ? data.learningArcOutcomes
              : [],
          };
          setPartialOverview(overviewData);
        }

        const newBatchSessions: BlcSessionPlan[] = Array.isArray(data.sessions)
          ? data.sessions
          : [];
        accumulatedSessions = [...accumulatedSessions, ...newBatchSessions];
        setPartialSessions(accumulatedSessions);

        setGenProgress({
          completedSessions: accumulatedSessions.length,
          totalSessions: total,
          currentRangeLabel:
            accumulatedSessions.length >= total
              ? 'Finalizing facilitator handbook...'
              : `Completed ${accumulatedSessions.length} of ${total} sessions`,
        });

        if (i + batchSize < total) {
          await new Promise(resolve => setTimeout(resolve, 350));
        }
      }

      const finalPlan: BlcPlan = {
        id: `blc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        circleName: scheduleConfig.circleName,
        bookTitle: bookTitle.trim() || parsedBook.title,
        author: author.trim(),
        fileName: parsedBook.fileName,
        totalPages: parsedBook.totalPages,
        totalWords: parsedBook.totalWords,
        overallSummary:
          overviewData?.overallSummary ||
          `A ${accumulatedSessions.length}-session Book Learning Circle exploring ${bookTitle.trim() || parsedBook.title}.`,
        learningArcOutcomes: overviewData?.learningArcOutcomes || [],
        config: scheduleConfig,
        sessions: accumulatedSessions,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (includeLiteralText) {
        await saveBlcBookPages(finalPlan.id, parsedBook.pages);
      }

      onPlanGenerated(finalPlan);
    } catch (err: any) {
      setGenError(err?.message || 'Unable to generate BLC session curriculum.');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatHoursMinutes = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-8 py-5 sm:py-8">
      {/* Top Wizard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-5 sm:pb-6 border-b border-[#E2D4C3]">
        <div>
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-[#8C5A2B]">
            The Wisdom Lounge · Circle Preparation
          </p>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#2A1E17] mt-1">
            Plan a Book Learning Circle (BLC)
          </h1>
          <p className="text-xs sm:text-sm text-[#5E5043] mt-1">
            Upload a full book PDF, configure your target reading pace or duration, and generate a session-by-session facilitator curriculum.
          </p>
        </div>

        {hasExistingPlans && onCancel && step !== 3 && (
          <button
            onClick={onCancel}
            className="w-full sm:w-auto min-h-[40px] px-3.5 py-2 text-xs font-medium text-[#5E5043] hover:text-[#2A1E17] bg-[#F4EDE2] hover:bg-[#E8DDCB] border border-[#E2D4C3] rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Saved Circles
          </button>
        )}
      </div>

      {/* Stepper Indicator */}
      <div className="flex items-center gap-2 sm:gap-6 py-4 sm:py-5 border-b border-[#E2D4C3]/70 text-[11px] sm:text-xs font-medium">
        {[
          { num: 1, label: '1. Book PDF & Scope', shortLabel: '1. Book' },
          { num: 2, label: '2. Pacing & Session Split', shortLabel: '2. Pacing' },
          { num: 3, label: '3. Generate BLC Plan', shortLabel: '3. Plan' },
        ].map((item, idx) => {
          const isCurrent = step === item.num;
          const isDone = step > item.num;
          return (
            <React.Fragment key={item.num}>
              <button
                type="button"
                disabled={step === 3 && isGenerating}
                onClick={() => {
                  if (item.num === 1 && !isGenerating) setStep(1);
                  if (item.num === 2 && parsedBook && !isGenerating) setStep(2);
                }}
                className={`flex items-center gap-1.5 sm:gap-2 transition-colors min-h-[34px] shrink-0 ${
                  isCurrent
                    ? 'text-[#2A1E17] font-semibold'
                    : isDone
                    ? 'text-[#8C5A2B] hover:text-[#2A1E17] cursor-pointer'
                    : 'text-[#9C8B7A] cursor-default'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] tabular-nums shrink-0 ${
                    isCurrent
                      ? 'bg-[#2A1E17] text-[#FBF7EE]'
                      : isDone
                      ? 'bg-[#8C5A2B]/15 text-[#8C5A2B]'
                      : 'bg-[#E8DDCB]/70 text-[#7A6B5D]'
                  }`}
                >
                  {isDone ? '✓' : item.num}
                </span>
                <span className="hidden sm:inline whitespace-nowrap">{item.label}</span>
                <span className="sm:hidden whitespace-nowrap">{item.shortLabel}</span>
              </button>
              {idx < 2 && <span className="h-px flex-1 bg-[#E2D4C3]" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* STEP 1: Upload & Indexing */}
      {step === 1 && (
        <div className="py-5 sm:py-6 space-y-5 sm:space-y-6">
          {!parsedBook ? (
            <div
              onDragOver={e => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !isParsing && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 sm:p-10 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-[#8C5A2B] bg-[#F4EDE2]'
                  : 'border-[#D8C8B4] bg-[#F4EDE2]/50 hover:bg-[#F4EDE2] hover:border-[#8C5A2B]/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.epub"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelected(f);
                }}
              />

              {isParsing ? (
                <div className="max-w-md mx-auto space-y-3">
                  <Loader2 className="w-8 h-8 text-[#8C5A2B] animate-spin mx-auto" />
                  <p className="text-sm font-semibold text-[#2A1E17]">
                    {parseProgress.total > 0
                      ? `Indexing page ${parseProgress.current} of ${parseProgress.total}...`
                      : 'Opening and inspecting book pages...'}
                  </p>
                  {parseProgress.total > 0 && (
                    <div className="w-full h-2 bg-[#E8DDCB] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#8C5A2B] transition-all duration-150"
                        style={{
                          width: `${Math.round((parseProgress.current / parseProgress.total) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                  <p className="text-xs text-[#7A6B5D]">
                    Extracting page boundaries, word counts, and chapter headings locally in your browser.
                  </p>
                </div>
              ) : (
                <div className="max-w-lg mx-auto space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-[#2A1E17] text-[#D4A373] flex items-center justify-center mx-auto shadow-xs">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg font-semibold text-[#2A1E17]">
                    Upload Full Book PDF for Your Circle
                  </h2>
                  <p className="text-sm text-[#5E5043]">
                    Drag and drop a full book PDF here, or click to select a file (.pdf, .epub, .txt, .md).
                  </p>
                  <p className="text-xs text-[#7A6B5D] pt-1">
                    Page-by-page extraction preserves exact reading page ranges and chapter boundaries.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Parsed Book Summary Strip */}
              <div className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#8C5A2B]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Book Indexed Successfully · {parsedBook.fileName}</span>
                  </div>
                  <p className="text-sm font-medium text-[#2A1E17] tabular-nums">
                    {parsedBook.totalPages.toLocaleString()} Pages
                    {' · '}
                    {parsedBook.totalWords.toLocaleString()} Words
                    {' · '}
                    {parsedBook.chapters.length} Detected Chapters / Sections
                    {' · '}
                    ~{formatHoursMinutes(Math.ceil(parsedBook.totalWords / readingSpeedWpm))} Full Read
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowChapterPreview(prev => !prev)}
                    className="px-3 py-1.5 text-xs font-medium text-[#2A1E17] bg-[#FBF7EE] hover:bg-[#E8DDCB] border border-[#D8C8B4] rounded-lg transition-colors"
                  >
                    {showChapterPreview ? 'Hide Chapter Index' : `View ${parsedBook.chapters.length} Chapters`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setParsedBook(null);
                      setParseError(null);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-[#5E5043] hover:text-[#2A1E17] bg-transparent hover:bg-[#E8DDCB]/60 border border-[#D8C8B4] rounded-lg transition-colors"
                  >
                    Replace PDF
                  </button>
                </div>
              </div>

              {showChapterPreview && (
                <div className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-xl p-4 max-h-60 overflow-y-auto">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#7A6B5D] mb-2.5">
                    Detected Book Structure
                  </p>
                  <div className="divide-y divide-[#E8DDCB] text-xs">
                    {parsedBook.chapters.map((ch, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between gap-4">
                        <span className="font-medium text-[#2A1E17] truncate">{ch.title}</span>
                        <span className="text-[#7A6B5D] tabular-nums shrink-0">
                          pp. {ch.startPage}–{ch.endPage} · {ch.wordCount.toLocaleString()} words
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Book & Circle Metadata Form */}
              <div className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-xl p-4 sm:p-6 space-y-4 sm:space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-[#2A1E17] mb-1.5">
                      Book Title <span className="text-[#8C5A2B]">*</span>
                    </label>
                    <input
                      type="text"
                      value={bookTitle}
                      onChange={e => setBookTitle(e.target.value)}
                      placeholder="e.g., Four Basic Terms of the Quran"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8C8B4] rounded-lg text-[#2A1E17] focus:outline-none focus:border-[#8C5A2B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#2A1E17] mb-1.5">
                      Author Name
                    </label>
                    <input
                      type="text"
                      value={author}
                      onChange={e => setAuthor(e.target.value)}
                      placeholder="e.g., Sayyid Abul A'la Maududi"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8C8B4] rounded-lg text-[#2A1E17] focus:outline-none focus:border-[#8C5A2B]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#2A1E17] mb-1.5">
                    BLC Circle Name
                  </label>
                  <input
                    type="text"
                    value={circleName}
                    onChange={e => setCircleName(e.target.value)}
                    placeholder="e.g., Sunday Morning Wisdom Circle — Cohort 4"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8C8B4] rounded-lg text-[#2A1E17] focus:outline-none focus:border-[#8C5A2B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#2A1E17] mb-1.5">
                    Circle Focus Directives & Specific Topics to Emphasize (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={focusGoals}
                    onChange={e => setFocusGoals(e.target.value)}
                    placeholder="e.g., Emphasize practical community building, leadership ethics, and youth discussion angles..."
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8C8B4] rounded-lg text-[#2A1E17] focus:outline-none focus:border-[#8C5A2B] resize-y"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!bookTitle.trim()}
                  onClick={() => setStep(2)}
                  className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 text-sm font-semibold text-[#FBF7EE] bg-[#2A1E17] hover:bg-[#3D2C22] disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs"
                >
                  Configure Duration & Session Pacing
                  <ArrowRight className="w-4 h-4 text-[#D4A373]" />
                </button>
              </div>
            </div>
          )}

          {parseError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{parseError}</span>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Pacing & Duration Calculator */}
      {step === 2 && parsedBook && metrics && (
        <div className="py-5 sm:py-6 space-y-5 sm:space-y-6">
          {/* Dual Pacing Mode Switcher */}
          <div className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-xl p-4 sm:p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#2A1E17]">
                  How would you like to plan the circle duration?
                </h2>
                <p className="text-xs text-[#5E5043] mt-0.5">
                  Calculate sessions from a member&apos;s reading time budget, or set a fixed BLC duration to compute the required reading per session.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto p-1 bg-[#E8DDCB] rounded-lg border border-[#D8C8B4] shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setPacingMode('by_reading_minutes');
                    setOverrideSessions(undefined);
                  }}
                  className={`min-h-[38px] px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition-colors text-center ${
                    pacingMode === 'by_reading_minutes'
                      ? 'bg-[#2A1E17] text-[#FBF7EE] shadow-xs'
                      : 'text-[#5E5043] hover:text-[#2A1E17]'
                  }`}
                >
                  Target Reading Time
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPacingMode('by_duration');
                    setOverrideSessions(undefined);
                  }}
                  className={`min-h-[38px] px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition-colors text-center ${
                    pacingMode === 'by_duration'
                      ? 'bg-[#2A1E17] text-[#FBF7EE] shadow-xs'
                      : 'text-[#5E5043] hover:text-[#2A1E17]'
                  }`}
                >
                  Fixed BLC Duration
                </button>
              </div>
            </div>

            {/* Primary Mode Controls */}
            {pacingMode === 'by_reading_minutes' ? (
              <div className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#2A1E17]">
                    Target Reading Time Per Session
                  </label>
                  <span className="text-sm font-bold text-[#8C5A2B] tabular-nums">
                    {targetReadingMinutes} min / session
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={90}
                  step={5}
                  value={targetReadingMinutes}
                  onChange={e => {
                    setTargetReadingMinutes(Number(e.target.value));
                    setOverrideSessions(undefined);
                  }}
                  className="w-full accent-[#8C5A2B]"
                />
                <div className="flex flex-wrap gap-2">
                  {[15, 20, 25, 30, 45, 60].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        setTargetReadingMinutes(mins);
                        setOverrideSessions(undefined);
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border tabular-nums transition-colors ${
                        targetReadingMinutes === mins && !overrideSessions
                          ? 'bg-[#2A1E17] text-[#FBF7EE] border-[#2A1E17]'
                          : 'bg-white text-[#5E5043] border-[#D8C8B4] hover:border-[#8C5A2B]'
                      }`}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#2A1E17]">
                    Total BLC Duration (Weeks)
                  </label>
                  <span className="text-sm font-bold text-[#8C5A2B] tabular-nums">
                    {durationWeeks} {durationWeeks === 1 ? 'Week' : 'Weeks'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={durationWeeks}
                    onChange={e => {
                      setDurationWeeks(Math.max(1, Math.min(52, Number(e.target.value) || 1)));
                      setOverrideSessions(undefined);
                    }}
                    className="w-24 px-3 py-1.5 text-sm font-semibold tabular-nums bg-white border border-[#D8C8B4] rounded-lg text-[#2A1E17]"
                  />
                  <div className="flex flex-wrap gap-2">
                    {[4, 6, 8, 10, 12, 16].map(wks => (
                      <button
                        key={wks}
                        type="button"
                        onClick={() => {
                          setDurationWeeks(wks);
                          setOverrideSessions(undefined);
                        }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md border tabular-nums transition-colors ${
                          durationWeeks === wks && !overrideSessions
                            ? 'bg-[#2A1E17] text-[#FBF7EE] border-[#2A1E17]'
                            : 'bg-white text-[#5E5043] border-[#D8C8B4] hover:border-[#8C5A2B]'
                        }`}
                      >
                        {wks} wks
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Secondary Schedule Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#2A1E17] mb-1.5">
                  Circle Cadence
                </label>
                <select
                  value={cadence}
                  onChange={e => {
                    setCadence(e.target.value as BlcCadence);
                    setOverrideSessions(undefined);
                  }}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-[#D8C8B4] rounded-lg text-[#2A1E17]"
                >
                  <option value="weekly">Weekly (1 / week)</option>
                  <option value="twice_weekly">Twice Weekly (2 / week)</option>
                  <option value="biweekly">Bi-Weekly (Every 2 weeks)</option>
                  <option value="custom">Custom frequency</option>
                </select>
                {cadence === 'custom' && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={7}
                      value={sessionsPerWeek}
                      onChange={e =>
                        setSessionsPerWeek(Math.max(1, Math.min(7, Number(e.target.value) || 1)))
                      }
                      className="w-16 px-2 py-1 text-xs bg-white border border-[#D8C8B4] rounded tabular-nums"
                    />
                    <span className="text-[11px] text-[#5E5043]">sessions / week</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2A1E17] mb-1.5">
                  Reading Speed (WPM)
                </label>
                <select
                  value={readingSpeedWpm}
                  onChange={e => setReadingSpeedWpm(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-[#D8C8B4] rounded-lg text-[#2A1E17]"
                >
                  <option value={150}>150 WPM · Careful Study</option>
                  <option value={200}>200 WPM · Balanced</option>
                  <option value={250}>250 WPM · Brisk Pace</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2A1E17] mb-1.5">
                  Live Meeting Length
                </label>
                <select
                  value={meetingDurationMinutes}
                  onChange={e => setMeetingDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-[#D8C8B4] rounded-lg text-[#2A1E17]"
                >
                  <option value={45}>45 min Session Agenda</option>
                  <option value={60}>60 min Session Agenda</option>
                  <option value={75}>75 min Session Agenda</option>
                  <option value={90}>90 min Session Agenda</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2A1E17] mb-1.5">
                  Start Date (Optional)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-medium bg-white border border-[#D8C8B4] rounded-lg text-[#2A1E17] tabular-nums"
                />
              </div>
            </div>

            {/* Output Language Option (Planning Phase) */}
            <div className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="block text-xs font-semibold text-[#2A1E17]">
                  Curriculum &amp; Content Writing Language
                </span>
                <span className="block text-[11px] text-[#5E5043]">
                  Keep the book&apos;s main language ({detectedBookLanguage}) or compose the entire session curriculum and reading content in scholarly Urdu (اردو).
                </span>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-2 sm:inline-flex w-full sm:w-auto p-1 bg-[#E8DDCB] rounded-lg border border-[#D8C8B4] shrink-0">
                <button
                  type="button"
                  onClick={() => setPlanLanguageMode('auto')}
                  className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap text-center ${
                    planLanguageMode === 'auto'
                      ? 'bg-[#2A1E17] text-[#FBF7EE] shadow-xs'
                      : 'text-[#5E5043] hover:text-[#2A1E17]'
                  }`}
                >
                  Match Book ({detectedBookLanguage})
                </button>
                <button
                  type="button"
                  onClick={() => setPlanLanguageMode('urdu')}
                  className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap text-center ${
                    planLanguageMode === 'urdu'
                      ? 'bg-[#2A1E17] text-[#FBF7EE] shadow-xs'
                      : 'text-[#5E5043] hover:text-[#2A1E17]'
                  }`}
                >
                  Write in Urdu (اردو)
                </button>
              </div>
            </div>

            {/* Literal Reading Text & Inline Discussion Prompts Option */}
            <div className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-lg p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeLiteralText}
                    onChange={e => setIncludeLiteralText(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#2A1E17] rounded"
                  />
                  <div className="space-y-0.5">
                    <span className="block text-xs font-semibold text-[#2A1E17]">
                      Output Literal Session Reading Text &amp; PNG Cards
                    </span>
                    <span className="block text-[11px] text-[#5E5043]">
                      Divides each session&apos;s exact assigned pages into clean, readable folios with one-click PNG export for members.
                    </span>
                  </div>
                </label>

                {includeLiteralText && (
                  <div className="shrink-0 sm:w-56">
                    <label className="block text-[11px] font-semibold text-[#5E5043] mb-1">
                      Default Part Size
                    </label>
                    <select
                      value={literalPartSize}
                      onChange={e => setLiteralPartSize(e.target.value as BlcLiteralPartSize)}
                      className="w-full px-2.5 py-1.5 text-xs font-medium bg-white border border-[#D8C8B4] rounded-lg text-[#2A1E17]"
                    >
                      <option value="compact">Compact (~145 words · Mobile PNG)</option>
                      <option value="standard">Readable (~230 words · Balanced)</option>
                      <option value="extended">Extended (~340 words · Study Page)</option>
                    </select>
                  </div>
                )}
              </div>

              {includeLiteralText && (
                <div className="pt-2.5 border-t border-[#E8DDCB]">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={injectDiscussionPrompts}
                      onChange={e => setInjectDiscussionPrompts(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#8C5A2B] rounded"
                    />
                    <div className="space-y-0.5">
                      <span className="block text-xs font-semibold text-[#2A1E17]">
                        Inject Discussion Prompts Directly Inside Reading Content
                      </span>
                      <span className="block text-[11px] text-[#5E5043]">
                        Places each session&apos;s discussion prompts inside compact side callout boxes alongside relevant passages.
                      </span>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Calculated Telemetry Bar + Session Count Fine-Tuner */}
          <div className="bg-[#2A1E17] text-[#FBF7EE] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 flex-1">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#D4A373]">Total Sessions</p>
                <p className="text-xl font-bold tabular-nums mt-0.5">{sessionPreviews.length}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#D4A373]">Total Duration</p>
                <p className="text-xl font-bold tabular-nums mt-0.5">
                  {metrics.estimatedWeeks} {metrics.estimatedWeeks === 1 ? 'Week' : 'Weeks'}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#D4A373]">Read / Session</p>
                <p className="text-xl font-bold tabular-nums mt-0.5">
                  ~{metrics.estimatedMinutesPerSession} min
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#D4A373]">Scope / Session</p>
                <p className="text-xl font-bold tabular-nums mt-0.5">
                  ~{metrics.avgPagesPerSession} pp.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 lg:border-l border-[#423126] lg:pl-5 shrink-0">
              <span className="text-xs text-[#E8DDCB] mr-1">Adjust Sessions:</span>
              <button
                type="button"
                onClick={() =>
                  setOverrideSessions(Math.max(1, sessionPreviews.length - 1))
                }
                className="w-7 h-7 rounded-md bg-[#3D2C22] hover:bg-[#4F392C] flex items-center justify-center text-[#FBF7EE]"
                aria-label="Decrease session count"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-bold tabular-nums">
                {sessionPreviews.length}
              </span>
              <button
                type="button"
                onClick={() =>
                  setOverrideSessions(Math.min(parsedBook.totalPages, sessionPreviews.length + 1))
                }
                className="w-7 h-7 rounded-md bg-[#3D2C22] hover:bg-[#4F392C] flex items-center justify-center text-[#FBF7EE]"
                aria-label="Increase session count"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {overrideSessions !== undefined && (
                <button
                  type="button"
                  onClick={() => setOverrideSessions(undefined)}
                  className="text-[11px] text-[#D4A373] hover:underline ml-1"
                >
                  Auto
                </button>
              )}
            </div>
          </div>

          {/* Live Smart Session Partition Preview */}
          <div className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 bg-[#F4EDE2] border-b border-[#E2D4C3] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#8C5A2B]" />
                <h3 className="text-sm font-semibold text-[#2A1E17]">
                  Smart Chapter & Page Partition Preview
                </h3>
              </div>
              <span className="text-xs text-[#5E5043] tabular-nums">
                {sessionPreviews.length} sessions · {parsedBook.totalPages} pages covered
              </span>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#FBF7EE] sticky top-0 border-b border-[#E2D4C3] text-[11px] uppercase tracking-wider text-[#7A6B5D]">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Session</th>
                    {startDate && <th className="py-2.5 px-4 font-semibold">Date</th>}
                    <th className="py-2.5 px-4 font-semibold">Chapters / Sections Covered</th>
                    <th className="py-2.5 px-4 font-semibold">Page Range</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Words</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Est. Read</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DDCB]">
                  {sessionPreviews.map(part => (
                    <tr key={part.sessionNumber} className="hover:bg-[#F4EDE2]/50">
                      <td className="py-2.5 px-4 font-semibold text-[#2A1E17] tabular-nums whitespace-nowrap">
                        Session {part.sessionNumber}
                      </td>
                      {startDate && (
                        <td className="py-2.5 px-4 text-[#5E5043] tabular-nums whitespace-nowrap">
                          {part.scheduledDate || '—'}
                        </td>
                      )}
                      <td className="py-2.5 px-4 text-[#2A1E17]">
                        {part.chaptersCovered.join(' · ')}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-[#8C5A2B] tabular-nums whitespace-nowrap">
                        pp. {part.startPage}–{part.endPage}
                      </td>
                      <td className="py-2.5 px-4 text-right text-[#5E5043] tabular-nums whitespace-nowrap">
                        {part.wordCount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-[#2A1E17] tabular-nums whitespace-nowrap">
                        ~{part.estimatedReadingMinutes} min
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="min-h-[42px] px-4 py-2 text-xs font-medium text-[#5E5043] hover:text-[#2A1E17] bg-[#F4EDE2] border border-[#E2D4C3] rounded-lg flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Book Details
            </button>

            <button
              type="button"
              onClick={() => {
                setPartialSessions([]);
                setPartialOverview(null);
                runBatchedGeneration(0);
              }}
              className="min-h-[44px] px-5 py-2.5 text-sm font-semibold text-[#FBF7EE] bg-[#2A1E17] hover:bg-[#3D2C22] rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-[#D4A373] shrink-0" />
              <span>Generate {sessionPreviews.length}-Session BLC Curriculum</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Generating Curriculum */}
      {step === 3 && (
        <div className="py-8 sm:py-12">
          <div className="max-w-xl mx-auto bg-[#F4EDE2] border border-[#E2D4C3] rounded-2xl p-5 sm:p-8 text-center space-y-5">
            {isGenerating ? (
              <>
                <Loader2 className="w-10 h-10 text-[#8C5A2B] animate-spin mx-auto" />
                <div>
                  <h2 className="text-lg font-bold text-[#2A1E17]">
                    Building Your Wisdom Lounge BLC Plan
                  </h2>
                  <p className="text-sm text-[#5E5043] mt-1">
                    {genProgress.currentRangeLabel || 'Preparing reading excerpts...'}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="w-full h-2.5 bg-[#E8DDCB] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#8C5A2B] transition-all duration-300"
                      style={{
                        width: `${Math.max(
                          8,
                          Math.round(
                            (genProgress.completedSessions /
                              Math.max(1, genProgress.totalSessions)) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-[#7A6B5D] tabular-nums">
                    {genProgress.completedSessions} of {genProgress.totalSessions} sessions synthesized
                  </p>
                </div>

                <p className="text-xs text-[#7A6B5D]">
                  Extracting topics, key arguments, anchored quotes, pre-session reflection prompts, facilitator cues, and time-boxed agendas.
                </p>
              </>
            ) : genError ? (
              <div className="space-y-4">
                <AlertCircle className="w-10 h-10 text-red-600 mx-auto" />
                <div>
                  <h2 className="text-lg font-bold text-[#2A1E17]">
                    Generation Interrupted
                  </h2>
                  <p className="text-sm text-red-800 mt-1">{genError}</p>
                  {partialSessions.length > 0 && (
                    <p className="text-xs text-[#5E5043] mt-2 tabular-nums">
                      {partialSessions.length} of {sessionPreviews.length} sessions are already completed and preserved.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2 text-xs font-medium text-[#2A1E17] bg-[#FBF7EE] border border-[#D8C8B4] rounded-lg flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Pacing
                  </button>
                  <button
                    type="button"
                    onClick={() => runBatchedGeneration(partialSessions.length)}
                    className="px-4 py-2 text-xs font-semibold text-[#FBF7EE] bg-[#2A1E17] hover:bg-[#3D2C22] rounded-lg flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#D4A373]" />
                    {partialSessions.length > 0
                      ? `Resume from Session ${partialSessions.length + 1}`
                      : 'Retry Generation'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
