import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  Clock,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  ListChecks,
  MessageSquare,
  Printer,
  Quote,
  Square,
  Trash2,
} from 'lucide-react';
import { BlcLiteralPartSize, BlcPlan, BlcSessionPlan, ParsedPage } from '../types/blc';
import {
  formatBlcMarkdown,
  formatCadenceLabel,
  formatWhatsAppCircleInvite,
  formatWhatsAppSessionReminder,
} from '../utils/blcExporters';
import { loadBlcBookPages, saveBlcBookPages } from '../utils/blcLiteralStorage';
import { parseBookPages } from '../utils/blcBookParser';
import { BlcLiteralReaderPanel } from './BlcLiteralReaderPanel';

interface BlcSessionDashboardProps {
  plan: BlcPlan;
  onToggleSessionComplete: (planId: string, sessionNumber: number) => void;
  onUpdateSessionNotes: (planId: string, sessionNumber: number, notes: string) => void;
  onDeletePlan: (planId: string) => void;
  onUpdatePartSize?: (planId: string, partSize: BlcLiteralPartSize) => void;
  onSyncSessionChapters?: (planId: string, sessionNumber: number, chapters: string[]) => void;
}

const isUrduText = (text?: string): boolean => {
  if (!text) return false;
  const urduMatches = text.match(
    /[\u0679\u067E\u0686\u0688\u0691\u0698\u06A9\u06AF\u06BA\u06BE\u06C1-\u06C3\u06CC\u06D2\u06D3\u06D4]/g
  );
  const latinMatches = text.match(/[A-Za-z]/g);
  return (urduMatches?.length || 0) >= 3 && (urduMatches?.length || 0) * 1.2 >= (latinMatches?.length || 0);
};

export const BlcSessionDashboard: React.FC<BlcSessionDashboardProps> = ({
  plan,
  onToggleSessionComplete,
  onUpdateSessionNotes,
  onDeletePlan,
  onUpdatePartSize,
  onSyncSessionChapters,
}) => {
  const [selectedSessionNum, setSelectedSessionNum] = useState<number>(() => {
    const firstPending = plan.sessions.find(s => !s.completed);
    return firstPending ? firstPending.sessionNumber : plan.sessions[0]?.sessionNumber || 1;
  });

  const [sessionViewTab, setSessionViewTab] = useState<'curriculum' | 'literal_text'>('curriculum');
  const [literalPages, setLiteralPages] = useState<ParsedPage[] | null>(null);
  const [isLoadingPages, setIsLoadingPages] = useState<boolean>(true);
  const [copiedState, setCopiedState] = useState<'invite' | 'reminder' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mobileRoadmapOpen, setMobileRoadmapOpen] = useState(false);

  // Load cached literal pages from IndexedDB whenever plan changes
  useEffect(() => {
    let cancelled = false;
    setIsLoadingPages(true);
    loadBlcBookPages(plan.id)
      .then(loaded => {
        if (!cancelled) {
          setLiteralPages(loaded);
          setIsLoadingPages(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLiteralPages(null);
          setIsLoadingPages(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [plan.id]);

  // Ensure selected session exists when switching between saved circles
  useEffect(() => {
    const exists = plan.sessions.some(s => s.sessionNumber === selectedSessionNum);
    if (!exists && plan.sessions.length > 0) {
      const firstPending = plan.sessions.find(s => !s.completed);
      setSelectedSessionNum(
        firstPending ? firstPending.sessionNumber : plan.sessions[0].sessionNumber
      );
    }
    setConfirmDelete(false);
  }, [plan.id]);

  const handleAttachBookFile = async (file: File) => {
    const parsed = await parseBookPages(file);
    await saveBlcBookPages(plan.id, parsed.pages);
    setLiteralPages(parsed.pages);
  };

  const activeSession: BlcSessionPlan | undefined =
    plan.sessions.find(s => s.sessionNumber === selectedSessionNum) || plan.sessions[0];

  const completedCount = plan.sessions.filter(s => s.completed).length;
  const totalSessions = plan.sessions.length;
  const progressPct = totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0;

  const avgReadingMins = Math.round(
    plan.sessions.reduce((acc, s) => acc + s.estimatedReadingMinutes, 0) /
      Math.max(1, totalSessions)
  );
  const avgPages = Math.round(plan.totalPages / Math.max(1, totalSessions));

  const copyToClipboard = async (text: string, type: 'invite' | 'reminder') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedState(type);
      setTimeout(() => setCopiedState(prev => (prev === type ? null : prev)), 2200);
    } catch {
      // Clipboard blocked fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedState(type);
      setTimeout(() => setCopiedState(prev => (prev === type ? null : prev)), 2200);
    }
  };

  const handleDownloadMarkdown = () => {
    const md = formatBlcMarkdown(plan);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = plan.circleName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    a.href = url;
    a.download = `${safeName || 'blc-facilitator-guide'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintGuide = () => {
    window.print();
  };

  if (!activeSession) {
    return null;
  }

  const agendaTotalMinutes = activeSession.agenda.reduce(
    (acc, seg) => acc + (Number(seg.durationMinutes) || 0),
    0
  );

  return (
    <div>
      {/* INTERACTIVE SCREEN DASHBOARD (hidden during print) */}
      <div className="no-print space-y-6">
        {/* Circle Summary & Export Bar */}
        <section className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-xl p-4 sm:p-5 md:p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#8C5A2B]">
                Book Learning Circle · Facilitator Workspace
              </p>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-serif-display font-bold text-[#2A1E17] tracking-tight">
                {plan.circleName}
              </h2>
              <p className="text-sm font-serif-body italic text-[#5E5043] font-medium">
                {plan.bookTitle}
                {plan.author ? ` · by ${plan.author}` : ''}
              </p>
              <p className="text-xs text-[#7A6B5D] tabular-nums pt-0.5">
                {totalSessions} Sessions · {formatCadenceLabel(plan)} · ~{avgReadingMins} min read (~{avgPages} pp.) per session · {plan.config.meetingDurationMinutes} min live agenda
              </p>
            </div>

            {/* Export & Share Toolbar */}
            <div className="w-full sm:w-auto grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => copyToClipboard(formatWhatsAppCircleInvite(plan), 'invite')}
                className="min-h-[40px] px-3 py-2 text-xs font-semibold text-[#2A1E17] bg-[#FBF7EE] hover:bg-[#E8DDCB] border border-[#D8C8B4] rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                {copiedState === 'invite' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Invite Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#8C5A2B]" />
                    <span>WhatsApp Invite</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="min-h-[40px] px-3 py-2 text-xs font-semibold text-[#2A1E17] bg-[#FBF7EE] hover:bg-[#E8DDCB] border border-[#D8C8B4] rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-[#8C5A2B]" />
                <span>Markdown</span>
              </button>

              <button
                type="button"
                onClick={handlePrintGuide}
                className="min-h-[40px] px-3 py-2 text-xs font-semibold text-[#FBF7EE] bg-[#2A1E17] hover:bg-[#3D2C22] rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-[#D4A373]" />
                <span>Print Guide</span>
              </button>

              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  title="Delete this BLC plan"
                  className="min-h-[40px] p-2 text-[#7A6B5D] hover:text-red-700 bg-[#FBF7EE] hover:bg-red-50 border border-[#D8C8B4] rounded-lg transition-colors flex items-center justify-center gap-1 text-xs"
                  aria-label="Delete BLC plan"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  <span className="sm:hidden">Delete</span>
                </button>
              ) : (
                <div className="min-h-[40px] col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-lg">
                  <span className="text-[11px] font-medium text-red-900">Delete?</span>
                  <button
                    type="button"
                    onClick={() => onDeletePlan(plan.id)}
                    className="text-[11px] font-bold text-red-700 hover:underline px-1.5 py-1"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-[11px] text-[#5E5043] hover:underline px-1.5 py-1"
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar + Overview */}
          <div className="pt-3 border-t border-[#E2D4C3] grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
            <div
              dir={isUrduText(plan.overallSummary) ? 'rtl' : 'ltr'}
              className={`lg:col-span-2 text-[#4A3B31] ${
                isUrduText(plan.overallSummary)
                  ? 'font-urdu text-[16px] leading-[2.0] text-right'
                  : 'text-xs leading-relaxed'
              }`}
            >
              {plan.overallSummary}
              {plan.learningArcOutcomes && plan.learningArcOutcomes.length > 0 && (
                <p
                  dir={isUrduText(plan.learningArcOutcomes[0]) ? 'rtl' : 'ltr'}
                  className={`mt-1.5 text-[#5E5043] ${
                    isUrduText(plan.learningArcOutcomes[0])
                      ? 'font-urdu text-[14.5px] leading-[1.95] text-right'
                      : ''
                  }`}
                >
                  <span className="font-semibold text-[#2A1E17]">Circle Arc: </span>
                  {plan.learningArcOutcomes.join(' · ')}
                </p>
              )}
            </div>

            <div className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-[#2A1E17] tabular-nums">
                <span>Circle Completion</span>
                <span>
                  {completedCount} / {totalSessions} Sessions ({progressPct}%)
                </span>
              </div>
              <div className="w-full h-2 bg-[#E8DDCB] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#8C5A2B] transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Mobile Session Switcher Banner (Compact & Fast on Phones) */}
        <div className="lg:hidden bg-[#FBF7EE] border border-[#E2D4C3] rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8C5A2B] shrink-0">
                Session {activeSession.sessionNumber} / {totalSessions}
              </span>
              <span className="text-[11px] text-[#7A6B5D] tabular-nums truncate">
                pp. {activeSession.startPage}–{activeSession.endPage}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileRoadmapOpen(prev => !prev)}
              className="px-2.5 py-1.5 text-xs font-semibold text-[#2A1E17] bg-[#F4EDE2] border border-[#D8C8B4] rounded-lg flex items-center gap-1 active:bg-[#E8DDCB] shrink-0 min-h-[36px]"
            >
              <span>{mobileRoadmapOpen ? 'Close Roadmap' : 'All Sessions'}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[#8C5A2B] transition-transform ${mobileRoadmapOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Quick horizontal session chips when collapsed */}
          {!mobileRoadmapOpen && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none touch-pan-x">
              {plan.sessions.map(s => {
                const isSelected = s.sessionNumber === activeSession.sessionNumber;
                return (
                  <button
                    key={s.sessionNumber}
                    type="button"
                    onClick={() => setSelectedSessionNum(s.sessionNumber)}
                    className={`min-h-[34px] px-2.5 py-1 text-xs font-semibold rounded-lg border shrink-0 transition-colors whitespace-nowrap tabular-nums flex items-center gap-1 ${
                      isSelected
                        ? 'bg-[#2A1E17] text-[#FBF7EE] border-[#2A1E17]'
                        : 'bg-[#F4EDE2] text-[#5E5043] border-[#D8C8B4]'
                    }`}
                  >
                    <span>S{s.sessionNumber}</span>
                    {s.completed && <span className="text-emerald-500 text-[10px]">✓</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Full roadmap list when expanded on mobile */}
          {mobileRoadmapOpen && (
            <div className="divide-y divide-[#E8DDCB] max-h-[380px] overflow-y-auto pt-1">
              {plan.sessions.map(session => {
                const isSelected = session.sessionNumber === activeSession.sessionNumber;
                return (
                  <div
                    key={session.sessionNumber}
                    className={`flex items-start gap-3 p-3 transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#F4EDE2] font-medium' : 'hover:bg-[#F4EDE2]/50'
                    }`}
                    onClick={() => {
                      setSelectedSessionNum(session.sessionNumber);
                      setMobileRoadmapOpen(false);
                    }}
                  >
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onToggleSessionComplete(plan.id, session.sessionNumber);
                      }}
                      className="mt-0.5 text-[#8C5A2B] shrink-0 p-1"
                      aria-label={`Toggle completion for Session ${session.sessionNumber}`}
                    >
                      {session.completed ? (
                        <CheckSquare className="w-4 h-4 text-[#8C5A2B]" />
                      ) : (
                        <Square className="w-4 h-4 text-[#9C8B7A]" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className={`font-semibold uppercase tracking-wider tabular-nums ${
                          isSelected ? 'text-[#8C5A2B]' : 'text-[#7A6B5D]'
                        }`}>
                          Session {session.sessionNumber}
                        </span>
                        <span className="text-[#5E5043] tabular-nums">
                          pp. {session.startPage}–{session.endPage}
                        </span>
                      </div>
                      <p className={`text-xs mt-0.5 ${
                        session.completed ? 'line-through text-[#7A6B5D]' : 'text-[#2A1E17] font-semibold'
                      }`}>
                        {session.title}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Two-Column Curriculum Workspace: Session Rail + Active Session Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Rail: Session Schedule Timeline (Desktop Sticky Sidebar) */}
          <aside className="hidden lg:block lg:col-span-4 bg-[#FBF7EE] border border-[#E2D4C3] rounded-xl overflow-hidden lg:sticky lg:top-24">
            <div className="px-4 py-3 bg-[#F4EDE2] border-b border-[#E2D4C3] flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#2A1E17]">
                Session Roadmap
              </span>
              <span className="text-[11px] text-[#7A6B5D] tabular-nums">
                {plan.totalPages} Pages Total
              </span>
            </div>

            <div className="divide-y divide-[#E8DDCB] max-h-[640px] overflow-y-auto">
              {plan.sessions.map(session => {
                const isSelected = session.sessionNumber === activeSession.sessionNumber;
                return (
                  <div
                    key={session.sessionNumber}
                    className={`flex items-start gap-3 p-3.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#F4EDE2] font-medium'
                        : 'hover:bg-[#F4EDE2]/50'
                    }`}
                    onClick={() => setSelectedSessionNum(session.sessionNumber)}
                  >
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onToggleSessionComplete(plan.id, session.sessionNumber);
                      }}
                      title={session.completed ? 'Mark session upcoming' : 'Mark session completed'}
                      className="mt-0.5 text-[#8C5A2B] hover:text-[#2A1E17] shrink-0"
                      aria-label={`Toggle completion for Session ${session.sessionNumber}`}
                    >
                      {session.completed ? (
                        <CheckSquare className="w-4 h-4 text-[#8C5A2B]" />
                      ) : (
                        <Square className="w-4 h-4 text-[#9C8B7A]" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[11px] font-semibold uppercase tracking-wider tabular-nums ${
                            isSelected ? 'text-[#8C5A2B]' : 'text-[#7A6B5D]'
                          }`}
                        >
                          Session {session.sessionNumber}
                          {session.scheduledDate ? ` · ${session.scheduledDate}` : ''}
                        </span>
                        <span className="text-[11px] font-medium text-[#5E5043] tabular-nums shrink-0">
                          pp. {session.startPage}–{session.endPage}
                        </span>
                      </div>

                      <p
                        className={`text-sm leading-snug ${
                          session.completed
                            ? 'line-through text-[#7A6B5D]'
                            : 'text-[#2A1E17] font-semibold'
                        }`}
                      >
                        {session.title}
                      </p>

                      <p className="text-[11px] text-[#7A6B5D] tabular-nums truncate">
                        ~{session.estimatedReadingMinutes} min read · {session.topics.length} topics
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Main Active Session Detail */}
          <div className="lg:col-span-8 space-y-5 sm:space-y-6">
            {/* Session Header & Reading Assignment */}
            <div className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-xl p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#8C5A2B] tabular-nums">
                    <span>SESSION {activeSession.sessionNumber} OF {totalSessions}</span>
                    {activeSession.scheduledDate && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {activeSession.scheduledDate}
                        </span>
                      </>
                    )}
                  </div>
                  <h3
                    dir={isUrduText(activeSession.title) ? 'rtl' : 'ltr'}
                    className={`${
                      isUrduText(activeSession.title)
                        ? 'font-urdu text-2xl md:text-[28px] leading-[1.95] text-right'
                        : 'text-2xl md:text-[26px] font-serif-display font-bold leading-snug'
                    } text-[#2A1E17]`}
                  >
                    {activeSession.title}
                  </h3>
                </div>

                <div className="w-full sm:w-auto grid grid-cols-1 xs:grid-cols-2 sm:flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        formatWhatsAppSessionReminder(plan, activeSession),
                        'reminder'
                      )
                    }
                    className="min-h-[40px] px-3 py-2 text-xs font-semibold text-[#2A1E17] bg-[#F4EDE2] hover:bg-[#E8DDCB] border border-[#D8C8B4] rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    {copiedState === 'reminder' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Reminder Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#8C5A2B]" />
                        <span>Copy Reminder</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onToggleSessionComplete(plan.id, activeSession.sessionNumber)
                    }
                    className={`min-h-[40px] px-3 py-2 text-xs font-semibold rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${
                      activeSession.completed
                        ? 'bg-[#2A1E17] text-[#FBF7EE] border-[#2A1E17]'
                        : 'bg-white text-[#2A1E17] border-[#D8C8B4] hover:border-[#8C5A2B]'
                    }`}
                  >
                    {activeSession.completed ? (
                      <>
                        <CheckSquare className="w-3.5 h-3.5 text-[#D4A373]" />
                        <span>Completed</span>
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5 text-[#8C5A2B]" />
                        <span>Mark Complete</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Exact Reading Scope */}
              <div className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <BookOpen className="w-4 h-4 text-[#8C5A2B] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-[#7A6B5D]">Reading Range</p>
                    <p className="font-bold text-[#2A1E17] tabular-nums mt-0.5">
                      Pages {activeSession.startPage}–{activeSession.endPage}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-[#8C5A2B] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-[#7A6B5D]">Prep Estimate</p>
                    <p className="font-bold text-[#2A1E17] tabular-nums mt-0.5">
                      ~{activeSession.estimatedReadingMinutes} min ({activeSession.wordCount.toLocaleString()} words)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <FileText className="w-4 h-4 text-[#8C5A2B] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-[#7A6B5D]">Chapters Covered</p>
                    <p
                      dir={isUrduText(activeSession.chaptersCovered.join(' ')) ? 'rtl' : 'ltr'}
                      className={`text-[#2A1E17] mt-0.5 ${
                        isUrduText(activeSession.chaptersCovered.join(' '))
                          ? 'font-urdu text-[16px] leading-[1.9] text-right font-normal'
                          : 'font-semibold'
                      }`}
                    >
                      {activeSession.chaptersCovered.join(' · ')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Session View Switcher: Facilitator Plan vs Literal Reading & PNG Cards */}
              <div className="pt-2 border-t border-[#E8DDCB] grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSessionViewTab('curriculum')}
                  className={`min-h-[42px] px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                    sessionViewTab === 'curriculum'
                      ? 'bg-[#2A1E17] text-[#FBF7EE] border-[#2A1E17] shadow-xs'
                      : 'bg-[#F4EDE2] text-[#2A1E17] border-[#D8C8B4] hover:border-[#8C5A2B] active:bg-[#E8DDCB]'
                  }`}
                >
                  <ListChecks className={`w-4 h-4 shrink-0 ${sessionViewTab === 'curriculum' ? 'text-[#D4A373]' : 'text-[#8C5A2B]'}`} />
                  <span className="truncate">Session Plan &amp; Prompts</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSessionViewTab('literal_text')}
                  className={`min-h-[42px] px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                    sessionViewTab === 'literal_text'
                      ? 'bg-[#2A1E17] text-[#FBF7EE] border-[#2A1E17] shadow-xs'
                      : 'bg-[#F4EDE2] text-[#2A1E17] border-[#D8C8B4] hover:border-[#8C5A2B] active:bg-[#E8DDCB]'
                  }`}
                >
                  <ImageIcon className={`w-4 h-4 shrink-0 ${sessionViewTab === 'literal_text' ? 'text-[#D4A373]' : 'text-[#8C5A2B]'}`} />
                  <span className="truncate">Literal Reading &amp; PNG Cards</span>
                </button>
              </div>
            </div>

            {sessionViewTab === 'literal_text' ? (
              <BlcLiteralReaderPanel
                plan={plan}
                session={activeSession}
                pages={literalPages}
                isLoadingPages={isLoadingPages}
                onAttachBookFile={handleAttachBookFile}
                onChangePartSize={
                  onUpdatePartSize ? size => onUpdatePartSize(plan.id, size) : undefined
                }
                onSyncSessionChapters={
                  onSyncSessionChapters
                    ? chapters =>
                        onSyncSessionChapters(plan.id, activeSession.sessionNumber, chapters)
                    : undefined
                }
              />
            ) : (
              <>
            {/* Topics Covered & Key Extractions */}
            <section className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-xl p-4 sm:p-6 space-y-5">
              <div className="border-b border-[#E8DDCB] pb-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#8C5A2B]">
                  Session Syllabus
                </p>
                <h4 className="text-xl font-serif-display font-bold text-[#2A1E17] mt-0.5">
                  Topics Covered &amp; Key Extractions
                </h4>
              </div>

              <div className="divide-y divide-[#E8DDCB] space-y-6">
                {activeSession.topics.map((topic, tIdx) => {
                  const topicUrdu = isUrduText(`${topic.topicTitle} ${topic.summary}`);
                  return (
                    <div
                      key={tIdx}
                      dir={topicUrdu ? 'rtl' : 'ltr'}
                      className={tIdx > 0 ? 'pt-6 space-y-3' : 'space-y-3'}
                    >
                      <div className="flex items-baseline gap-2.5">
                        <span className="text-xs font-serif-display font-bold text-[#8C5A2B] tabular-nums">
                          {String(tIdx + 1).padStart(2, '0')}
                        </span>
                        <h5
                          className={`text-[#2A1E17] ${
                            topicUrdu
                              ? 'font-urdu text-[21px] leading-[1.95] font-normal'
                              : 'text-lg font-serif-display font-bold'
                          }`}
                        >
                          {topic.topicTitle}
                        </h5>
                      </div>

                      <p
                        className={`text-[#3D2F27] ${
                          topicUrdu
                            ? 'font-urdu text-[17.5px] leading-[2.1] text-right'
                            : 'text-[14.5px] font-serif-body leading-[1.75]'
                        }`}
                      >
                        {topic.summary}
                      </p>

                      {topic.keyExtractions && topic.keyExtractions.length > 0 && (
                        <div className="bg-[#F4EDE2]/70 border border-[#E2D4C3] rounded-lg p-4 space-y-2">
                          <p
                            dir="ltr"
                            className="text-[11px] font-semibold uppercase tracking-wider text-[#7A6B5D] text-left"
                          >
                            Key Extractions from This Topic
                          </p>
                          <ul
                            className={`space-y-1.5 text-[#2A1E17] ${
                              topicUrdu ? 'font-urdu text-[16.5px] leading-[2.05]' : 'text-[14px] font-serif-body'
                            }`}
                          >
                            {topic.keyExtractions.map((ext, eIdx) => (
                              <li key={eIdx} className="flex items-start gap-2.5">
                                <span className="text-[#8C5A2B] font-bold mt-0.5">•</span>
                                <span className="leading-relaxed">{ext}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {topic.keyPassages && topic.keyPassages.length > 0 && (
                        <div className="space-y-2 pt-1">
                          {topic.keyPassages.map((passage, pIdx) => (
                            <blockquote
                              key={pIdx}
                              dir={isUrduText(passage.quote) ? 'rtl' : 'ltr'}
                              className="bg-white/80 border border-[#E8DDCB] rounded-lg px-4 py-3 text-[14px] font-serif-body text-[#4A3B31] flex items-start gap-2.5"
                            >
                              <Quote className="w-4 h-4 text-[#8C5A2B] shrink-0 mt-0.5" />
                              <div>
                                <p
                                  className={
                                    isUrduText(passage.quote)
                                      ? 'font-urdu text-[17px] leading-[2.05]'
                                      : 'italic leading-relaxed'
                                  }
                                >
                                  &ldquo;{passage.quote}&rdquo;
                                </p>
                                <p className="text-[11px] font-semibold text-[#8C5A2B] mt-1 tabular-nums">
                                  — {passage.pageRef}
                                </p>
                              </div>
                            </blockquote>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Pre-Session Preparation */}
            <section className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-xl p-4 sm:p-6 space-y-4">
              <div className="border-b border-[#E8DDCB] pb-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#8C5A2B]">
                  Member Preparation
                </p>
                <h4 className="text-lg font-bold text-[#2A1E17] mt-0.5">
                  Pre-Session Reflection &amp; Reading Mindset
                </h4>
              </div>

              <p
                dir={isUrduText(activeSession.preSessionPrep.readingMindset) ? 'rtl' : 'ltr'}
                className={`text-[#3D2F27] bg-[#F4EDE2]/70 border border-[#E2D4C3] rounded-lg p-4 ${
                  isUrduText(activeSession.preSessionPrep.readingMindset)
                    ? 'font-urdu text-[17px] leading-[2.05] text-right'
                    : 'text-sm leading-relaxed'
                }`}
              >
                {activeSession.preSessionPrep.readingMindset}
              </p>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#5E5043]">
                  Share these reflection prompts before the session:
                </p>
                <ol
                  dir={isUrduText(activeSession.preSessionPrep.reflectionQuestions[0]) ? 'rtl' : 'ltr'}
                  className={`space-y-2 text-[#2A1E17] ${
                    isUrduText(activeSession.preSessionPrep.reflectionQuestions[0])
                      ? 'font-urdu text-[16.5px] leading-[2.05]'
                      : 'text-sm'
                  }`}
                >
                  {activeSession.preSessionPrep.reflectionQuestions.map((q, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="text-xs font-bold text-[#8C5A2B] tabular-nums mt-0.5">
                        {idx + 1}.
                      </span>
                      <span className="leading-relaxed">{q}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            {/* Facilitator Discussion Prompts */}
            <section className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-xl p-4 sm:p-6 space-y-4">
              <div className="border-b border-[#E8DDCB] pb-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#8C5A2B]">
                    Live Dialogue Guide
                  </p>
                  <h4 className="text-lg font-bold text-[#2A1E17] mt-0.5">
                    Discussion Prompts &amp; Facilitator Cues
                  </h4>
                </div>
                <MessageSquare className="w-5 h-5 text-[#8C5A2B]" />
              </div>

              <div className="divide-y divide-[#E8DDCB]">
                {activeSession.discussionPrompts.map((prompt, idx) => {
                  const promptUrdu = isUrduText(prompt.question);
                  return (
                    <div
                      key={idx}
                      dir={promptUrdu ? 'rtl' : 'ltr'}
                      className="py-4 first:pt-1 last:pb-1 space-y-1.5"
                    >
                      <p dir="ltr" className="text-[11px] font-bold uppercase tracking-wider text-[#8C5A2B] text-left">
                        {prompt.category}
                      </p>
                      <p
                        className={`text-[#2A1E17] ${
                          promptUrdu
                            ? 'font-urdu text-[17.5px] leading-[2.05] text-right'
                            : 'text-sm font-semibold leading-relaxed'
                        }`}
                      >
                        {prompt.question}
                      </p>
                      {prompt.facilitatorCue && (
                        <p
                          className={`text-[#5E5043] ${
                            promptUrdu
                              ? 'font-urdu text-[15px] leading-[1.95] text-right'
                              : 'text-xs leading-relaxed'
                          }`}
                        >
                          <span className="font-semibold text-[#4A3B31]">Facilitator Cue: </span>
                          {prompt.facilitatorCue}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Time-Boxed Session Agenda */}
            <section className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-xl overflow-hidden">
              <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-[#F4EDE2] border-b border-[#E2D4C3] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-[#8C5A2B]" />
                  <h4 className="text-base font-bold text-[#2A1E17]">
                    Time-Boxed Session Agenda
                  </h4>
                </div>
                <span className="text-xs font-bold text-[#2A1E17] tabular-nums">
                  Total: {agendaTotalMinutes} min
                </span>
              </div>

              <div className="divide-y divide-[#E8DDCB]">
                {activeSession.agenda.map((seg, idx) => (
                  <div
                    key={idx}
                    className="px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-baseline gap-1.5 sm:gap-5"
                  >
                    <span className="text-xs font-bold text-[#8C5A2B] tabular-nums w-16 shrink-0">
                      {seg.durationMinutes} min
                    </span>
                    <div className="space-y-0.5 flex-1">
                      <p className="text-sm font-semibold text-[#2A1E17]">
                        {seg.segmentTitle}
                      </p>
                      <p className="text-xs text-[#5E5043] leading-relaxed">
                        {seg.activityDescription}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Facilitator Notes (Persisted) */}
            <section className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-xl p-4 sm:p-6 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-[#2A1E17]">
                  Facilitator Notes &amp; Member Takeaways
                </label>
                <span className="text-[11px] text-[#7A6B5D]">Saved automatically</span>
              </div>
              <textarea
                rows={4}
                value={activeSession.facilitatorNotes}
                onChange={e =>
                  onUpdateSessionNotes(plan.id, activeSession.sessionNumber, e.target.value)
                }
                placeholder="Jot down attendance, key insights raised by members, or follow-up points for the next session..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8C8B4] rounded-lg text-[#2A1E17] focus:outline-none focus:border-[#8C5A2B] resize-y"
              />
            </section>
              </>
            )}
          </div>
        </div>
      </div>

      {/* PRINT-ONLY COMPLETE FACILITATOR HANDBOOK */}
      <div className="print-only p-6 space-y-6 text-[#2A1E17]">
        <div className="border-b-2 border-[#2A1E17] pb-4 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#8C5A2B]">
            The Wisdom Lounge · Book Learning Circle Facilitator Guide
          </p>
          <h1 className="text-2xl font-bold">{plan.circleName}</h1>
          <p className="text-sm">
            Book: <strong>{plan.bookTitle}</strong>
            {plan.author ? ` by ${plan.author}` : ''}
          </p>
          <p className="text-xs text-[#5E5043] tabular-nums">
            {totalSessions} Sessions · {formatCadenceLabel(plan)} · ~{avgReadingMins} min (~{avgPages} pages) per session · {plan.config.meetingDurationMinutes} min live agenda
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-bold">Circle Overview</h2>
          <p className="text-sm leading-relaxed">{plan.overallSummary}</p>
          {plan.learningArcOutcomes && plan.learningArcOutcomes.length > 0 && (
            <ul className="list-disc pl-5 text-xs space-y-1">
              {plan.learningArcOutcomes.map((o, idx) => (
                <li key={idx}>{o}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-bold">Master Reading Schedule</h2>
          <table className="w-full text-left border-collapse text-xs border border-[#D8C8B4]">
            <thead>
              <tr className="bg-[#F4EDE2] border-b border-[#D8C8B4]">
                <th className="p-2 font-semibold">Session</th>
                <th className="p-2 font-semibold">Pages</th>
                <th className="p-2 font-semibold">Chapters Covered</th>
                <th className="p-2 font-semibold">Est. Read</th>
              </tr>
            </thead>
            <tbody>
              {plan.sessions.map(s => (
                <tr key={s.sessionNumber} className="border-b border-[#E8DDCB]">
                  <td className="p-2 font-medium">
                    {s.sessionNumber}. {s.title}
                    {s.scheduledDate ? ` (${s.scheduledDate})` : ''}
                  </td>
                  <td className="p-2 tabular-nums">pp. {s.startPage}–{s.endPage}</td>
                  <td className="p-2">{s.chaptersCovered.join(', ')}</td>
                  <td className="p-2 tabular-nums">~{s.estimatedReadingMinutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {plan.sessions.map(session => (
          <div key={session.sessionNumber} className="print-page-break pt-4 space-y-4">
            <div className="border-b border-[#2A1E17] pb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8C5A2B] tabular-nums">
                Session {session.sessionNumber}{session.scheduledDate ? ` · ${session.scheduledDate}` : ''}
              </p>
              <h2 className="text-xl font-bold">{session.title}</h2>
              <p className="text-xs text-[#5E5043] tabular-nums">
                Pages {session.startPage}–{session.endPage} · Chapters: {session.chaptersCovered.join(', ')} · ~{session.estimatedReadingMinutes} min read
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider">Topics &amp; Key Extractions</h3>
              {session.topics.map((topic, idx) => (
                <div key={idx} className="print-avoid-break space-y-1.5 pb-2">
                  <h4 className="text-sm font-bold">{idx + 1}. {topic.topicTitle}</h4>
                  <p className="text-xs leading-relaxed">{topic.summary}</p>
                  <ul className="list-disc pl-5 text-xs space-y-1">
                    {topic.keyExtractions.map((ex, i) => (
                      <li key={i}>{ex}</li>
                    ))}
                  </ul>
                  {topic.keyPassages?.map((p, i) => (
                    <p key={i} className="text-xs italic text-[#4A3B31] pl-3 border-l-2 border-[#D8C8B4]">
                      &ldquo;{p.quote}&rdquo; ({p.pageRef})
                    </p>
                  ))}
                </div>
              ))}
            </div>

            <div className="print-avoid-break space-y-1.5">
              <h3 className="text-sm font-bold uppercase tracking-wider">Pre-Session Preparation</h3>
              <p className="text-xs">{session.preSessionPrep.readingMindset}</p>
              <ol className="list-decimal pl-5 text-xs space-y-1">
                {session.preSessionPrep.reflectionQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </div>

            <div className="print-avoid-break space-y-1.5">
              <h3 className="text-sm font-bold uppercase tracking-wider">Facilitator Discussion Prompts</h3>
              <ul className="space-y-1.5 text-xs">
                {session.discussionPrompts.map((dp, i) => (
                  <li key={i}>
                    <strong>[{dp.category}]</strong> {dp.question}
                    {dp.facilitatorCue && (
                      <span className="block text-[#5E5043] italic">Cue: {dp.facilitatorCue}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="print-avoid-break space-y-1.5">
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Session Agenda ({plan.config.meetingDurationMinutes} min)
              </h3>
              <ul className="space-y-1 text-xs">
                {session.agenda.map((seg, i) => (
                  <li key={i}>
                    <strong className="tabular-nums">{seg.durationMinutes} min — {seg.segmentTitle}:</strong>{' '}
                    {seg.activityDescription}
                  </li>
                ))}
              </ul>
            </div>

            {session.facilitatorNotes.trim() && (
              <div className="print-avoid-break space-y-1">
                <h3 className="text-sm font-bold uppercase tracking-wider">Facilitator Notes</h3>
                <p className="text-xs whitespace-pre-wrap">{session.facilitatorNotes}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
