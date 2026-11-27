import React, { useState } from 'react';
import { ModernRemedy, ModernRemedySlide, BookAnalysis } from '../types/book';
import { 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Check, 
  Share2, 
  HelpCircle, 
  Lightbulb, 
  Layers, 
  BookOpen, 
  Flame, 
  Search,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  Edit3,
  RotateCw,
  BookMarked,
  User,
  Users,
  Building2,
  Target
} from 'lucide-react';
import { 
  generateTwlCircleAttribution, 
  containsTwlCircleAttribution, 
  TWL_CIRCLE_TEMPLATES 
} from '../utils/twlCircleAttribution';
import { useLanguage } from '../context/LanguageContext';
import { translateParagraphToUrdu } from '../utils/urduContentTranslator';

interface ModernRemediesViewProps {
  book: BookAnalysis;
  onUpdateBook?: (updatedBook: BookAnalysis) => void;
}

export const ModernRemediesView: React.FC<ModernRemediesViewProps> = ({ book, onUpdateBook }) => {
  const { isUrdu, t } = useLanguage();
  const remedies = book.modernRemedies || [];
  const [selectedRemedyId, setSelectedRemedyId] = useState<string>(remedies[0]?.id || '');
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'carousel' | 'analytical'>('carousel');
  const [copiedSlide, setCopiedSlide] = useState<boolean>(false);
  const [copiedDeck, setCopiedDeck] = useState<boolean>(false);

  // Book Name management state
  const [isEditingBookTitle, setIsEditingBookTitle] = useState<boolean>(false);
  const [editedBookTitle, setEditedBookTitle] = useState<string>(book.title);
  const [remedyBookTitle, setRemedyBookTitle] = useState<string>(book.title);
  const [variationCycleCount, setVariationCycleCount] = useState<number>(1);
  
  // Custom remedy query state
  const [customQuery, setCustomQuery] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);



  const activeRemedy = remedies.find(r => r.id === selectedRemedyId) || remedies[0];

  // Unique categories
  const categories = ['all', ...Array.from(new Set(remedies.map(r => r.category)))];

  const filteredRemedies = remedies.filter(r => {
    if (selectedCategory === 'all') return true;
    return r.category === selectedCategory;
  });

  const handleNextSlide = () => {
    if (!activeRemedy) return;
    if (activeSlideIndex < activeRemedy.slides.length - 1) {
      setActiveSlideIndex(prev => prev + 1);
    } else {
      setActiveSlideIndex(0); // loop back
    }
  };

  const handlePrevSlide = () => {
    if (!activeRemedy) return;
    if (activeSlideIndex > 0) {
      setActiveSlideIndex(prev => prev - 1);
    } else {
      setActiveSlideIndex(activeRemedy.slides.length - 1);
    }
  };

  const handleSaveBookTitle = () => {
    const newTitle = editedBookTitle.trim();
    if (!newTitle) return;

    setIsEditingBookTitle(false);
    setRemedyBookTitle(newTitle);

    if (onUpdateBook) {
      const updatedBook: BookAnalysis = {
        ...book,
        title: newTitle,
        modernRemedies: (book.modernRemedies || []).map(rem => ({
          ...rem,
          slides: rem.slides.map(slide => {
            if (containsTwlCircleAttribution(slide.content)) {
              // Update book name in circle attribution slide
              return {
                ...slide,
                content: generateTwlCircleAttribution(newTitle, slide.content, 0)
              };
            }
            return slide;
          })
        }))
      };
      onUpdateBook(updatedBook);
    }
  };

  const handleCycleSlideAttribution = () => {
    if (!activeRemedy || !activeRemedy.slides[activeSlideIndex]) return;
    const currentSlide = activeRemedy.slides[activeSlideIndex];
    const nextSeed = variationCycleCount + 1;
    setVariationCycleCount(nextSeed);

    // Extract core insight or use existing content
    let rawInsight = currentSlide.content;
    const circleMatch = rawInsight.match(/(?:learned that|realized that|clear that|discovered that|takeaway was that|recognized that|principle:\s*|uncovered that|lesson was that)\s*(.*)/i);
    if (circleMatch && circleMatch[1]) {
      rawInsight = circleMatch[1].trim();
    }

    const updatedContent = generateTwlCircleAttribution(book.title, rawInsight, nextSeed);

    const updatedSlides = activeRemedy.slides.map((s, idx) => 
      idx === activeSlideIndex ? { ...s, title: 'TWL Circle Reflection', content: updatedContent } : s
    );

    const updatedRemedies = remedies.map(r => 
      r.id === activeRemedy.id ? { ...r, slides: updatedSlides } : r
    );

    if (onUpdateBook) {
      onUpdateBook({
        ...book,
        modernRemedies: updatedRemedies
      });
    }
  };

  const handleEmbedCircleAttribution = (slideIndexToUpdate: number) => {
    if (!activeRemedy || !activeRemedy.slides[slideIndexToUpdate]) return;
    const targetSlide = activeRemedy.slides[slideIndexToUpdate];
    const nextSeed = variationCycleCount + 1;
    setVariationCycleCount(nextSeed);

    const newContent = generateTwlCircleAttribution(book.title, targetSlide.content, nextSeed);

    const updatedSlides = activeRemedy.slides.map((s, idx) => 
      idx === slideIndexToUpdate ? { ...s, title: 'TWL Circle Reflection', content: newContent } : s
    );

    const updatedRemedies = remedies.map(r => 
      r.id === activeRemedy.id ? { ...r, slides: updatedSlides } : r
    );

    if (onUpdateBook) {
      onUpdateBook({
        ...book,
        modernRemedies: updatedRemedies
      });
    }
  };

  const handleCopyCurrentSlide = () => {
    if (!activeRemedy || !activeRemedy.slides[activeSlideIndex]) return;
    const currentSlide = activeRemedy.slides[activeSlideIndex];
    let textToCopy = `[Slide ${currentSlide.slideNumber}/${activeRemedy.slides.length}: ${currentSlide.title}]\n\n${currentSlide.content}`;
    
    if (currentSlide.actionableSteps && currentSlide.actionableSteps.length > 0) {
      textToCopy += `\n\nSpecific Actionable Steps:\n` + currentSlide.actionableSteps.map((s, i) => `${i + 1}. ${s}`).join('\n');
    }

    textToCopy += `\n\n— From "${book.title}" by ${book.author} · The Wisdom Lounge`;
    
    navigator.clipboard.writeText(textToCopy);
    setCopiedSlide(true);
    setTimeout(() => setCopiedSlide(false), 2000);
  };

  const handleCopyFullDeck = () => {
    if (!activeRemedy) return;
    let fullText = `${activeRemedy.problemTitle}\n\n`;
    fullText += `Question: ${activeRemedy.questionHook}\n`;
    if (activeRemedy.misconceptionStatement) {
      fullText += `Clarifying Misconception: ${activeRemedy.misconceptionStatement}\n`;
    }

    if (activeRemedy.levelsOfIntervention) {
      fullText += `\n--- LEVELS OF INTERVENTION ---\n\n`;
      fullText += `1. Individual Level: ${activeRemedy.levelsOfIntervention.individual.title}\n`;
      activeRemedy.levelsOfIntervention.individual.actions.forEach((a) => {
        fullText += `   - ${a}\n`;
      });
      fullText += `   Mechanism: ${activeRemedy.levelsOfIntervention.individual.mechanism}\n\n`;

      fullText += `2. Community Level: ${activeRemedy.levelsOfIntervention.community.title}\n`;
      activeRemedy.levelsOfIntervention.community.actions.forEach((a) => {
        fullText += `   - ${a}\n`;
      });
      fullText += `   Mechanism: ${activeRemedy.levelsOfIntervention.community.mechanism}\n\n`;

      fullText += `3. Institutional Level: ${activeRemedy.levelsOfIntervention.institutional.title}\n`;
      activeRemedy.levelsOfIntervention.institutional.actions.forEach((a) => {
        fullText += `   - ${a}\n`;
      });
      fullText += `   Mechanism: ${activeRemedy.levelsOfIntervention.institutional.mechanism}\n\n`;
    }

    fullText += `\n--- CAROUSEL SLIDES (${activeRemedy.slides.length} Slides) ---\n\n`;

    activeRemedy.slides.forEach(slide => {
      fullText += `[Slide ${slide.slideNumber}/${activeRemedy.slides.length}] ${slide.title}\n${slide.content}\n`;
      if (slide.actionableSteps && slide.actionableSteps.length > 0) {
        fullText += `Actionable Steps:\n` + slide.actionableSteps.map((s, i) => `  ${i + 1}. ${s}`).join('\n') + `\n`;
      }
      fullText += `\n`;
    });

    fullText += `Source: "${book.title}" by ${book.author}\nFormulated in study circles convened by The Wisdom Lounge (TWL).`;

    navigator.clipboard.writeText(fullText);
    setCopiedDeck(true);
    setTimeout(() => setCopiedDeck(false), 2000);
  };

  const handleExtractCustomRemedy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuery.trim() || isExtracting) return;

    setIsExtracting(true);
    setExtractError(null);

    const targetTitle = remedyBookTitle.trim() || book.title;

    try {
      const response = await fetch('/api/extract-remedies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manuscriptText: book.rawTextPreview,
          title: targetTitle,
          problemQuery: customQuery.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to extract remedies from server.');
      }

      const data = await response.json();
      if (data && data.remedies && data.remedies.length > 0) {
        const newRemedies = [...(book.modernRemedies || []), ...data.remedies];
        const updatedBook = {
          ...book,
          title: targetTitle,
          modernRemedies: newRemedies
        };
        if (onUpdateBook) {
          onUpdateBook(updatedBook);
        }
        setSelectedRemedyId(data.remedies[0].id);
        setActiveSlideIndex(0);
        setCustomQuery('');
      } else {
        setExtractError('No remedies could be extracted for this specific topic.');
      }
    } catch (err: any) {
      console.error('Extraction error:', err);
      setExtractError(err.message || 'Error communicating with AI remedy generator.');
    } finally {
      setIsExtracting(false);
    }
  };

  const getSlideBadgeStyle = (type: string) => {
    switch (type) {
      case 'hook':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'diagnosis':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'textual_insight':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
      case 'solution':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'quote':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'action':
        return 'bg-amber-400/20 text-amber-200 border-amber-400/30';
      case 'intervention_individual':
        return 'bg-blue-500/25 text-blue-300 border-blue-400/40 shadow-sm shadow-blue-500/10';
      case 'intervention_community':
        return 'bg-teal-500/25 text-teal-300 border-teal-400/40 shadow-sm shadow-teal-500/10';
      case 'intervention_institutional':
        return 'bg-purple-500/25 text-purple-300 border-purple-400/40 shadow-sm shadow-purple-500/10';
      default:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }
  };

  const getSlideBadgeLabel = (type: string) => {
    switch (type) {
      case 'hook': return 'Question Hook';
      case 'diagnosis': return 'Diagnosis & Misconception';
      case 'textual_insight': return 'Textual Insight';
      case 'solution': return 'Classical Solution';
      case 'quote': return 'Core Passage';
      case 'action': return 'Action Step';
      case 'intervention_individual': return 'Level 1: Individual Intervention';
      case 'intervention_community': return 'Level 2: Community Intervention';
      case 'intervention_institutional': return 'Level 3: Institutional Intervention';
      default: return type?.replace(/_/g, ' ');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Intro Header */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 sm:p-6 md:p-8 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium mb-3">
              <Flame className="w-3.5 h-3.5" />
              <span>Modern Remedies & Instagram Carousels</span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-serif text-stone-100 font-bold tracking-tight flex flex-wrap items-center gap-2 sm:gap-3">
              <span>Classical Solutions to Modern Problems</span>
              {isUrdu && (
                <span className="text-xs font-sans font-normal text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                  اردو مواد (Urdu Content)
                </span>
              )}
            </h2>
            <p className="text-stone-400 text-xs sm:text-sm md:text-base mt-2 max-w-2xl leading-relaxed">
              Extracting authentic, grounded solutions from <span className="text-stone-200 font-medium">"{book.title}"</span> for contemporary society (hyper-individualism, burnout, social trust breakdown, inflation). Presented in Instagram-ready carousel slide decks.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              onClick={handleCopyFullDeck}
              disabled={!activeRemedy}
              className="w-full sm:w-auto min-h-[42px] px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium text-sm transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 border border-amber-500/30"
            >
              {copiedDeck ? <Check className="w-4 h-4 text-stone-950" /> : <Copy className="w-4 h-4 text-stone-950" />}
              <span>{copiedDeck ? 'Deck Copied!' : 'Copy Full Thread Text'}</span>
            </button>
          </div>
        </div>

        {/* Book Name & Study Circle Status Bar */}
        <div className="mt-5 pt-4 border-t border-stone-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 shrink-0">
              <BookMarked className="w-3.5 h-3.5" /> Book in Focus:
            </span>
            {isEditingBookTitle ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={editedBookTitle}
                  onChange={(e) => setEditedBookTitle(e.target.value)}
                  className="bg-stone-950 border border-amber-500/50 rounded-lg px-2.5 py-1.5 text-xs text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500 min-w-[160px]"
                  autoFocus
                />
                <button
                  onClick={handleSaveBookTitle}
                  className="min-h-[32px] px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-lg text-xs"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditingBookTitle(false);
                    setEditedBookTitle(book.title);
                  }}
                  className="min-h-[32px] px-2 py-1 text-stone-400 hover:text-stone-200 text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-stone-100 font-serif font-bold text-xs sm:text-sm bg-stone-950/70 px-2.5 py-0.5 rounded-md border border-stone-800 truncate max-w-[220px] sm:max-w-none">
                  "{book.title}"
                </span>
                <button
                  onClick={() => setIsEditingBookTitle(true)}
                  className="min-h-[30px] min-w-[30px] flex items-center justify-center p-1 text-stone-400 hover:text-amber-400 transition-colors shrink-0"
                  title="Change Book Name"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="text-[11px] text-stone-400 flex items-center gap-1.5 bg-stone-950/60 px-3 py-1 rounded-full border border-stone-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span>Remedy slides cite TWL study circles</span>
          </div>
        </div>

        {/* Category Filters */}
        {categories.length > 1 && (
          <div className="flex items-center gap-2 mt-5 pt-5 border-t border-stone-800/80 overflow-x-auto pb-1 scrollbar-none touch-pan-x">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider mr-1 sm:mr-2 flex items-center gap-1 shrink-0">
              <Layers className="w-3.5 h-3.5" /> Categories:
            </span>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap capitalize shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'bg-stone-800/60 text-stone-400 hover:text-stone-200 hover:bg-stone-800 border border-transparent'
                }`}
              >
                {cat === 'all' ? 'All Remedies' : cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Grid: Remedies List & Interactive Carousel Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column: Remedy Selector List & Custom Query */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-stone-400 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <span>Extracted Remedies ({filteredRemedies.length})</span>
            </h3>
          </div>

          <div className="space-y-3">
            {filteredRemedies.map((remedy) => {
              const isSelected = remedy.id === (activeRemedy?.id);
              return (
                <div
                  key={remedy.id}
                  onClick={() => {
                    setSelectedRemedyId(remedy.id);
                    setActiveSlideIndex(0);
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-stone-900 border-amber-500/50 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/20'
                      : 'bg-stone-900/60 border-stone-800/80 hover:bg-stone-900 hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-stone-800 text-stone-300 text-[11px] font-medium border border-stone-700/50">
                      {remedy.category}
                    </span>
                    <span className="text-[11px] text-stone-400 font-mono">
                      {remedy.slides.length} slides
                    </span>
                  </div>

                  <h4 className="text-stone-100 font-medium text-base mt-2.5 line-clamp-1 group-hover:text-amber-300 transition-colors">
                    {remedy.problemTitle}
                  </h4>

                  <p className="text-amber-400/90 text-xs font-serif italic mt-1 line-clamp-2">
                    "{remedy.questionHook}"
                  </p>

                  {remedy.isMisconceptionFix && (
                    <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-rose-300/90 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">
                      <ShieldCheck className="w-3 h-3 text-rose-400 shrink-0" />
                      <span className="truncate">Clears Societal Misconception</span>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredRemedies.length === 0 && (
              <div className="text-center py-8 bg-stone-900/40 rounded-xl border border-stone-800 text-stone-500 text-sm">
                No remedies found for this category.
              </div>
            )}
          </div>

          {/* Custom Remedy Query Form */}
          <div className="bg-stone-900/80 border border-stone-800 rounded-xl p-4 mt-6">
            <h4 className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Query Custom Societal Problem</span>
            </h4>
            <p className="text-stone-400 text-xs mb-3">
              Ask Wisdom Reader to extract classical solutions for a specific modern issue from this manuscript.
            </p>
            <form onSubmit={handleExtractCustomRemedy} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-stone-300 mb-1">
                  Book Name to Reference in Slides:
                </label>
                <input
                  type="text"
                  value={remedyBookTitle}
                  onChange={(e) => setRemedyBookTitle(e.target.value)}
                  placeholder="e.g. The Muqaddimah, Revival of the Religious Sciences..."
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-stone-300 mb-1">
                  Modern Societal Issue or Topic:
                </label>
                <input
                  type="text"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  placeholder="e.g. Political polarization, Career burnout..."
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
                />
              </div>

              {extractError && (
                <p className="text-rose-400 text-xs">{extractError}</p>
              )}

              <button
                type="submit"
                disabled={isExtracting || !customQuery.trim()}
                className="w-full py-2 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-stone-200 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-stone-700/50"
              >
                {isExtracting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span>Extracting Carousel...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5 text-amber-400" />
                    <span>Generate Carousel Remedy</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Viewer (Carousel or Analytical Breakdown) */}
        <div className="lg:col-span-7">
          {activeRemedy ? (
            <div className="space-y-4">
              {/* View Mode Toggle Header */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 bg-stone-900 border border-stone-800 rounded-xl p-3 sm:px-4">
                <div className="grid grid-cols-2 sm:flex items-center gap-2">
                  <button
                    onClick={() => setViewMode('carousel')}
                    className={`min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                      viewMode === 'carousel'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-stone-800/60 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Carousel ({activeRemedy.slides.length})</span>
                  </button>

                  <button
                    onClick={() => setViewMode('analytical')}
                    className={`min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                      viewMode === 'analytical'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-stone-800/60 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Book-to-Remedy</span>
                  </button>
                </div>

                {viewMode === 'carousel' && (
                  <span className="self-start sm:self-auto text-xs font-mono bg-stone-950 px-2.5 py-1 rounded-md border border-stone-800 text-amber-400">
                    Slide {String(activeSlideIndex + 1).padStart(2, '0')} / {String(activeRemedy.slides.length).padStart(2, '0')}
                  </span>
                )}
              </div>

              {viewMode === 'carousel' ? (
                <>
                  {/* Levels of Intervention Quick Jump Bar */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none touch-pan-x text-[11px] bg-stone-900/60 p-2.5 px-3 rounded-xl border border-stone-800">
                    <span className="text-stone-400 font-semibold uppercase tracking-wider text-[10px] mr-1 flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-amber-400" /> Levels:
                    </span>
                    <button
                      onClick={() => setActiveSlideIndex(0)}
                      className={`px-2.5 py-1 rounded-lg border text-xs transition-all whitespace-nowrap ${
                        activeSlideIndex === 0
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold shadow-sm'
                          : 'bg-stone-800/60 text-stone-400 hover:text-stone-200 border-transparent'
                      }`}
                    >
                      Slide 1
                    </button>

                    {activeRemedy.slides.findIndex(s => s.type === 'intervention_individual' || s.interventionLevel === 'individual') >= 0 && (
                      <button
                        onClick={() => {
                          const idx = activeRemedy.slides.findIndex(s => s.type === 'intervention_individual' || s.interventionLevel === 'individual');
                          if (idx >= 0) setActiveSlideIndex(idx);
                        }}
                        className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all whitespace-nowrap ${
                          activeRemedy.slides[activeSlideIndex]?.type === 'intervention_individual' || activeRemedy.slides[activeSlideIndex]?.interventionLevel === 'individual'
                            ? 'bg-blue-500/25 text-blue-300 border-blue-400/50 font-semibold shadow-sm shadow-blue-500/10'
                            : 'bg-stone-800/60 text-stone-400 hover:text-blue-300 border-transparent'
                        }`}
                      >
                        <User className="w-3 h-3 text-blue-400" />
                        <span>Individual Level</span>
                      </button>
                    )}

                    {activeRemedy.slides.findIndex(s => s.type === 'intervention_community' || s.interventionLevel === 'community') >= 0 && (
                      <button
                        onClick={() => {
                          const idx = activeRemedy.slides.findIndex(s => s.type === 'intervention_community' || s.interventionLevel === 'community');
                          if (idx >= 0) setActiveSlideIndex(idx);
                        }}
                        className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all whitespace-nowrap ${
                          activeRemedy.slides[activeSlideIndex]?.type === 'intervention_community' || activeRemedy.slides[activeSlideIndex]?.interventionLevel === 'community'
                            ? 'bg-teal-500/25 text-teal-300 border-teal-400/50 font-semibold shadow-sm shadow-teal-500/10'
                            : 'bg-stone-800/60 text-stone-400 hover:text-teal-300 border-transparent'
                        }`}
                      >
                        <Users className="w-3 h-3 text-teal-400" />
                        <span>Community Level</span>
                      </button>
                    )}

                    {activeRemedy.slides.findIndex(s => s.type === 'intervention_institutional' || s.interventionLevel === 'institutional') >= 0 && (
                      <button
                        onClick={() => {
                          const idx = activeRemedy.slides.findIndex(s => s.type === 'intervention_institutional' || s.interventionLevel === 'institutional');
                          if (idx >= 0) setActiveSlideIndex(idx);
                        }}
                        className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all whitespace-nowrap ${
                          activeRemedy.slides[activeSlideIndex]?.type === 'intervention_institutional' || activeRemedy.slides[activeSlideIndex]?.interventionLevel === 'institutional'
                            ? 'bg-purple-500/25 text-purple-300 border-purple-400/50 font-semibold shadow-sm shadow-purple-500/10'
                            : 'bg-stone-800/60 text-stone-400 hover:text-purple-300 border-transparent'
                        }`}
                      >
                        <Building2 className="w-3 h-3 text-purple-400" />
                        <span>Institutional Level</span>
                      </button>
                    )}
                  </div>

                  {/* Instagram Card Container */}
                  <div className="relative bg-gradient-to-b from-stone-900 via-stone-950 to-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden p-4 sm:p-6 md:p-8 min-h-[380px] sm:min-h-[460px] flex flex-col justify-between group">
                    
                    {/* Decorative background aura */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />

                    {/* Instagram Story-style Top Segment Progress Bar */}
                    <div className="flex gap-1.5 mb-6 relative z-10">
                      {activeRemedy.slides.map((s, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveSlideIndex(idx)}
                          className="h-1 flex-1 rounded-full overflow-hidden bg-stone-800 hover:bg-stone-700 transition-all cursor-pointer"
                        >
                          <div
                            className={`h-full transition-all duration-300 ${
                              idx === activeSlideIndex
                                ? 'bg-amber-400'
                                : idx < activeSlideIndex
                                ? 'bg-amber-600/60'
                                : 'bg-transparent'
                            }`}
                          />
                        </button>
                      ))}
                    </div>

                    {/* Slide Top Metadata */}
                    <div className="flex items-center justify-between gap-2 relative z-10 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border uppercase tracking-wider ${getSlideBadgeStyle(activeRemedy.slides[activeSlideIndex]?.type)}`}>
                          {getSlideBadgeLabel(activeRemedy.slides[activeSlideIndex]?.type)}
                        </span>
                        {containsTwlCircleAttribution(activeRemedy.slides[activeSlideIndex]?.content) && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>TWL Circle Citation</span>
                          </span>
                        )}
                      </div>

                      <span className="text-xs text-stone-400 font-serif italic">
                        {book.title}
                      </span>
                    </div>

                    {/* Slide Content Area */}
                    {(() => {
                      const rawSlideTitle = activeRemedy.slides[activeSlideIndex]?.title || '';
                      const rawSlideContent = activeRemedy.slides[activeSlideIndex]?.content || '';
                      const slideTitle = isUrdu ? translateParagraphToUrdu(rawSlideTitle) : rawSlideTitle;
                      const slideContent = isUrdu ? translateParagraphToUrdu(rawSlideContent) : rawSlideContent;

                      return (
                        <div className="my-auto py-6 relative z-10 space-y-4">
                          <h3
                            dir={isUrdu ? 'rtl' : 'ltr'}
                            className={`text-amber-300 text-xl md:text-2xl font-serif font-bold tracking-tight ${
                              isUrdu ? 'font-urdu text-right leading-loose' : 'text-left'
                            }`}
                          >
                            {slideTitle}
                          </h3>

                          <div className="border border-amber-500/30 bg-amber-500/5 rounded-2xl p-4 md:p-5 shadow-sm border-l-4 border-l-amber-400">
                            <p
                              dir={isUrdu ? 'rtl' : 'ltr'}
                              className={`text-stone-100 text-base md:text-lg font-serif leading-relaxed ${
                                isUrdu ? 'font-urdu text-right leading-loose' : 'text-left'
                              }`}
                            >
                              "{slideContent}"
                            </p>
                          </div>

                          {/* Specific Actionable Steps (for high-detail intervention slides) */}
                          {activeRemedy.slides[activeSlideIndex]?.actionableSteps && activeRemedy.slides[activeSlideIndex].actionableSteps!.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-stone-800/80 space-y-2">
                              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                                <span>Specific Actionable Steps</span>
                              </div>
                              <div className="space-y-1.5">
                                {activeRemedy.slides[activeSlideIndex].actionableSteps!.map((step, sIdx) => {
                                  const stepText = isUrdu ? translateParagraphToUrdu(step) : step;
                                  return (
                                    <div key={sIdx} className="flex items-start gap-2 bg-stone-900/90 px-3 py-2 rounded-lg border border-stone-800 text-xs text-stone-200">
                                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono flex items-center justify-center shrink-0 mt-0.5 border border-amber-500/30">
                                        {sIdx + 1}
                                      </span>
                                      <span dir={isUrdu ? 'rtl' : 'ltr'} className={`leading-relaxed flex-1 ${isUrdu ? 'font-urdu text-right' : 'text-left'}`}>
                                        {stepText}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {activeRemedy.slides[activeSlideIndex]?.quoteRef && (
                            <p className="text-xs text-stone-400 font-sans italic border-l-2 border-amber-500/40 pl-3 py-0.5">
                              Ref: {activeRemedy.slides[activeSlideIndex].quoteRef}
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Slide Card Footer & Nav */}
                    <div className="pt-6 border-t border-stone-800/80 flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-2 text-xs text-stone-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>{t.wisdomLounge} · {book.author}</span>
                      </div>

                      {/* Navigation Arrows */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handlePrevSlide}
                          className="p-2.5 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-200 border border-stone-700/60 transition-all hover:scale-105 active:scale-95"
                          title={t.btnPrevSlide}
                        >
                          <ChevronLeft className={`w-5 h-5 ${isUrdu ? 'rotate-180' : ''}`} />
                        </button>

                        <button
                          onClick={handleNextSlide}
                          className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold border border-amber-400 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/20"
                          title={t.btnNextSlide}
                        >
                          <ChevronRight className={`w-5 h-5 text-stone-950 ${isUrdu ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action bar for current slide */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-900/60 border border-stone-800 rounded-xl p-3 sm:px-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {containsTwlCircleAttribution(activeRemedy.slides[activeSlideIndex]?.content) ? (
                        <button
                          onClick={handleCycleSlideAttribution}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-medium border border-amber-500/30 flex items-center gap-1.5 transition-colors shadow-sm"
                          title="Rotate phrasing format"
                        >
                          <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                          <span>{isUrdu ? `حلقہ کا فکری جملہ بدلیں (${((variationCycleCount - 1) % 10) + 1}/10)` : `Vary Circle Phrasing (${((variationCycleCount - 1) % 10) + 1}/10)`}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleEmbedCircleAttribution(activeSlideIndex)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-stone-100 text-xs font-medium border border-stone-700 flex items-center gap-1.5 transition-colors"
                          title="Incorporate TWL Circle Learning into this slide"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>{isUrdu ? 'ٹی ڈبلیو ایل حلقہ کا حوالہ شامل کریں' : 'Embed TWL Circle Learning'}</span>
                        </button>
                      )}
                      <span className="text-xs text-stone-400">
                        {containsTwlCircleAttribution(activeRemedy.slides[activeSlideIndex]?.content)
                          ? (isUrdu ? `کتاب "${book.title}" کا ٹی ڈبلیو ایل حوالہ شامل ہے` : `Features dynamic circle attribution to "${book.title}"`)
                          : (isUrdu ? 'حلقہ کا عمیق فکری تاثر شامل کرنے کے لیے کلک کریں' : 'Click to add varied circle reflection')}
                      </span>
                    </div>

                    <button
                      onClick={handleCopyCurrentSlide}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-stone-700/50 shrink-0"
                    >
                      {copiedSlide ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                      <span>{copiedSlide ? (isUrdu ? 'سلائیڈ کاپی ہو گئی!' : 'Slide Copied!') : t.btnCopySlide}</span>
                    </button>
                  </div>
                </>
              ) : (
                /* Book-to-Remedy Analytical Breakdown View */
                <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6">
                  <div>
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Book-to-Remedy Analysis</span>
                    <h3 className="text-xl font-serif text-stone-100 font-bold mt-1">{activeRemedy.problemTitle}</h3>
                    <p className="text-stone-400 text-xs mt-1 italic font-serif">"{activeRemedy.questionHook}"</p>
                  </div>

                  {/* 1. Problem Analysis */}
                  <div className="space-y-2 bg-stone-950/60 p-4 rounded-xl border border-stone-800/80">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5" /> 1. Problem Analysis & Root Cause
                    </h4>
                    <p className="text-stone-300 text-xs md:text-sm leading-relaxed">
                      {activeRemedy.problemAnalysis || `Analyzing the underlying societal symptoms versus structural causes behind "${activeRemedy.problemTitle}". Distinguishing surface friction from deeper structural drivers.`}
                    </p>
                  </div>

                  {/* 2. Source Contribution */}
                  <div className="space-y-2 bg-stone-950/60 p-4 rounded-xl border border-stone-800/80">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" /> 2. Source Contribution ({book.title} by {book.author})
                    </h4>
                    <p className="text-stone-300 text-xs md:text-sm leading-relaxed">
                      {activeRemedy.sourceContribution || `Grounded interpretation of what "${book.title}" establishes regarding this issue, preserving authorial intent and intellectual fidelity.`}
                    </p>
                  </div>

                  {/* 3. Reasoning Connection */}
                  <div className="space-y-2 bg-stone-950/60 p-4 rounded-xl border border-stone-800/80">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5" /> 3. Reasoning Connection
                    </h4>
                    <p className="text-stone-300 text-xs md:text-sm leading-relaxed">
                      {activeRemedy.reasoningConnection || `Bridging the classical text's core principles directly to contemporary conditions without inflating the issue or forcing unwarranted conclusions.`}
                    </p>
                  </div>

                  {/* Multi-Level Intervention Strategy: Individual, Community, Institutional */}
                  {activeRemedy.levelsOfIntervention && (
                    <div className="space-y-4 bg-stone-950/70 p-5 rounded-xl border border-amber-500/25">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                          <Target className="w-4 h-4 text-amber-400" /> Multi-Level Intervention Framework
                        </h4>
                        <span className="text-[11px] text-amber-400/90 font-mono bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20 w-fit">
                          Individual · Community · Institutional
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 1. Individual Level */}
                        <div className="bg-stone-900/90 border border-blue-500/30 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-sm shadow-blue-500/5">
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-400 mb-2">
                              <User className="w-3.5 h-3.5 text-blue-400" />
                              <span>1. Individual Level</span>
                            </div>
                            <h5 className="text-xs font-bold text-stone-100 font-serif leading-snug">
                              {activeRemedy.levelsOfIntervention.individual.title}
                            </h5>
                            <ul className="space-y-2 mt-3">
                              {activeRemedy.levelsOfIntervention.individual.actions.map((act, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-xs text-stone-300">
                                  <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-mono flex items-center justify-center shrink-0 mt-0.5 border border-blue-500/30">
                                    {idx + 1}
                                  </span>
                                  <span className="leading-snug">{act}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="pt-2 border-t border-stone-800 text-[11px] text-stone-400">
                            <span className="text-blue-300/90 font-semibold uppercase text-[10px] tracking-wider block mb-0.5">Mechanism</span>
                            <p className="italic leading-snug">{activeRemedy.levelsOfIntervention.individual.mechanism}</p>
                          </div>
                        </div>

                        {/* 2. Community Level */}
                        <div className="bg-stone-900/90 border border-teal-500/30 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-sm shadow-teal-500/5">
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-400 mb-2">
                              <Users className="w-3.5 h-3.5 text-teal-400" />
                              <span>2. Community Level</span>
                            </div>
                            <h5 className="text-xs font-bold text-stone-100 font-serif leading-snug">
                              {activeRemedy.levelsOfIntervention.community.title}
                            </h5>
                            <ul className="space-y-2 mt-3">
                              {activeRemedy.levelsOfIntervention.community.actions.map((act, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-xs text-stone-300">
                                  <span className="w-4 h-4 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-mono flex items-center justify-center shrink-0 mt-0.5 border border-teal-500/30">
                                    {idx + 1}
                                  </span>
                                  <span className="leading-snug">{act}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="pt-2 border-t border-stone-800 text-[11px] text-stone-400">
                            <span className="text-teal-300/90 font-semibold uppercase text-[10px] tracking-wider block mb-0.5">Mechanism</span>
                            <p className="italic leading-snug">{activeRemedy.levelsOfIntervention.community.mechanism}</p>
                          </div>
                        </div>

                        {/* 3. Institutional Level */}
                        <div className="bg-stone-900/90 border border-purple-500/30 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-sm shadow-purple-500/5">
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-purple-400 mb-2">
                              <Building2 className="w-3.5 h-3.5 text-purple-400" />
                              <span>3. Institutional Level</span>
                            </div>
                            <h5 className="text-xs font-bold text-stone-100 font-serif leading-snug">
                              {activeRemedy.levelsOfIntervention.institutional.title}
                            </h5>
                            <ul className="space-y-2 mt-3">
                              {activeRemedy.levelsOfIntervention.institutional.actions.map((act, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-xs text-stone-300">
                                  <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-mono flex items-center justify-center shrink-0 mt-0.5 border border-purple-500/30">
                                    {idx + 1}
                                  </span>
                                  <span className="leading-snug">{act}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="pt-2 border-t border-stone-800 text-[11px] text-stone-400">
                            <span className="text-purple-300/90 font-semibold uppercase text-[10px] tracking-wider block mb-0.5">Mechanism</span>
                            <p className="italic leading-snug">{activeRemedy.levelsOfIntervention.institutional.mechanism}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. Practical Action Steps */}
                  <div className="space-y-3 bg-stone-950/60 p-4 rounded-xl border border-stone-800/80">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 4. Practical Action Steps
                    </h4>
                    <ul className="space-y-2">
                      {(activeRemedy.actionSteps && activeRemedy.actionSteps.length > 0 ? activeRemedy.actionSteps : [
                        'Audit personal and collective exposure to the root cause.',
                        'Establish localized mutual responsibility or practice boundaries.',
                        'Evaluate results against concrete observable outcomes rather than abstract ideals.'
                      ]).map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs md:text-sm text-stone-200">
                          <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 font-mono text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-amber-500/20">
                            {idx + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 5. Limitations & Intellectual Honesty */}
                  <div className="space-y-2 bg-stone-950/60 p-4 rounded-xl border border-stone-800/80">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" /> 5. Limitations & Trade-offs
                    </h4>
                    <p className="text-stone-300 text-xs md:text-sm leading-relaxed">
                      {activeRemedy.limitations || 'This proposal offers a principled guide rather than a guaranteed political fix. Implementation requires local adaptation and careful awareness of trade-offs.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Takeaway Summary Box */}
              <div className="bg-stone-900/40 border border-stone-800/80 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Key Remedy Takeaway</span>
                </h4>
                <p className="text-stone-300 text-xs leading-relaxed">
                  {activeRemedy.keyTakeawaySummary}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-stone-900/30 rounded-2xl border border-stone-800 text-stone-500">
              Select a remedy to view its analysis and slide deck.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
