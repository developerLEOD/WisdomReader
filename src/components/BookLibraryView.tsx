import React, { useState } from 'react';
import { BookAnalysis } from '../types/book';
import { 
  Search, 
  BookOpen, 
  Clock, 
  FileText, 
  ArrowRight, 
  Upload, 
  Layers, 
  Award, 
  Trash2,
  CheckSquare,
  Square,
  Sparkles,
  X
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface BookLibraryViewProps {
  books: BookAnalysis[];
  onSelectBook: (book: BookAnalysis) => void;
  onOpenImport: () => void;
  onDeleteBook?: (bookId: string) => void;
  onCombineBooks?: (selectedBooks: BookAnalysis[]) => void;
}

export const BookLibraryView: React.FC<BookLibraryViewProps> = ({
  books,
  onSelectBook,
  onOpenImport,
  onDeleteBook,
  onCombineBooks
}) => {
  const { isUrdu, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const uniqueCategories = Array.from(new Set(books.map(b => b.category).filter(Boolean)));
  const categories = ['All', ...uniqueCategories];

  const filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          book.executiveSummary?.thesis?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || book.category === selectedCategory || (selectedCategory === 'Custom Uploads' && book.isCustomUpload);
    return matchesSearch && matchesCategory;
  });

  const toggleBookSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBookIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleRunCombined = () => {
    if (selectedBookIds.length < 2) return;
    const selected = books.filter(b => selectedBookIds.includes(b.id));
    if (onCombineBooks) {
      onCombineBooks(selected);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8">
      
      {/* Hero Welcome Banner */}
      <section className="bg-gradient-to-br from-[#2A1E17] via-[#3A2A20] to-[#201610] text-[#FBF7EE] rounded-2xl p-5 sm:p-6 md:p-10 shadow-lg relative overflow-hidden border border-[#423126]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#8C5A2B]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-3 sm:space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#8C5A2B]/30 border border-[#8C5A2B]/40 rounded-md text-xs font-sans-ui text-[#E2D4C3]">
            <Award className="w-3.5 h-3.5 text-[#D4A373]" />
            <span>{t.heroBadge}</span>
          </div>
          <h1 className="font-serif-display text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight text-[#FAF5EC] leading-tight">
            {t.heroTitle}
          </h1>
          <p className="font-serif-body text-sm sm:text-base md:text-lg text-[#D8C8B4] leading-relaxed">
            {t.heroDesc}
          </p>

          <div className="pt-1 sm:pt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-xs font-sans-ui text-[#C5B49F]">
            <span>{t.heroFeature1}</span>
            <span className="hidden xs:inline">·</span>
            <span>{t.heroFeature2}</span>
            <span className="hidden xs:inline">·</span>
            <span>{t.heroFeature3}</span>
          </div>
        </div>
      </section>

      {/* Filter & Search Bar - Shown if books exist */}
      {books.length > 0 && (
        <div className="flex flex-col md:flex-row gap-3 sm:gap-4 items-stretch md:items-center justify-between bg-[#F4EDE2] p-2.5 sm:p-3 rounded-xl border border-[#E2D4C3]">
          
          {/* Category Tabs */}
          {categories.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none touch-pan-x">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`min-h-[36px] px-3 py-1.5 text-xs font-sans-ui font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-[#2A1E17] text-[#FBF7EE] shadow-sm'
                      : 'text-[#5E5043] hover:bg-[#E8DDCB] hover:text-[#2A1E17]'
                  }`}
                >
                  {cat === 'All' ? t.allBooks : cat}
                </button>
              ))}
            </div>
          )}

          {/* Search Field & Multi-select indicator */}
          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-72">
              <Search className={`w-4 h-4 text-[#8C7A6B] absolute top-1/2 -translate-y-1/2 ${isUrdu ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className={`min-h-[38px] w-full bg-[#FBF7EE] border border-[#D8C8B4] rounded-lg py-1.5 text-xs font-sans-ui text-[#2A1E17] placeholder-[#9A8B7C] focus:outline-none focus:border-[#8C5A2B] transition-colors ${
                  isUrdu ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
                }`}
              />
            </div>
          </div>

        </div>
      )}

      {/* Floating Combined Analysis Action Bar when 2+ books are selected */}
      {selectedBookIds.length >= 2 && (
        <div className="sticky top-20 z-40 bg-[#2A1E17] text-[#FBF7EE] border border-[#8C5A2B]/40 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#8C5A2B] text-[#FBF7EE] flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-serif-display font-bold text-sm text-[#FBF7EE]">
                {selectedBookIds.length} {t.selectedForCombined}
              </h4>
              <p className="text-xs font-sans-ui text-[#D8C8B4]">
                {t.selectedDesc}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => setSelectedBookIds([])}
              className="px-3 py-2 text-xs font-sans-ui text-[#D8C8B4] hover:text-[#FBF7EE] flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>{t.btnClear}</span>
            </button>
            <button
              onClick={handleRunCombined}
              className="flex-1 sm:flex-none px-5 py-2 text-xs font-sans-ui font-bold text-[#2A1E17] bg-[#D4A373] hover:bg-[#E2B789] rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#2A1E17]" />
              <span>{t.btnRunCombinedAction}</span>
            </button>
          </div>
        </div>
      )}

      {/* Empty State when no books exist */}
      {books.length === 0 ? (
        <div className="bg-[#F4EDE2]/80 border-2 border-dashed border-[#D4C5B0] rounded-2xl p-8 md:p-14 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#E2D4C3] text-[#8C5A2B] flex items-center justify-center mx-auto shadow-sm">
            <Upload className="w-8 h-8" />
          </div>
          <div className="max-w-lg mx-auto space-y-2">
            <h2 className="font-serif-display font-bold text-2xl text-[#2A1E17]">
              {t.emptyLibraryTitle}
            </h2>
            <p className="text-sm font-sans-ui text-[#7A6B5D] leading-relaxed">
              {t.emptyLibraryDesc}
            </p>
          </div>
          <button
            onClick={onOpenImport}
            className="px-6 py-3 bg-[#2A1E17] hover:bg-[#3D2C22] text-[#FBF7EE] text-sm font-sans-ui font-medium rounded-xl transition-all shadow-md hover:shadow-lg inline-flex items-center gap-2 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-[#D4A373]" />
            <span>{t.emptyLibraryBtn}</span>
          </button>
          <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs font-sans-ui text-[#8C7A6B]">
            <span>✓ {t.emptyFeature1}</span>
            <span>✓ {t.emptyFeature2}</span>
            <span>✓ {t.emptyFeature3}</span>
            <span>✓ {t.emptyFeature4}</span>
          </div>
        </div>
      ) : (
        /* Book Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          
          {/* Custom Upload Card */}
          <div
            onClick={onOpenImport}
            className="group border-2 border-dashed border-[#D4C5B0] hover:border-[#8C5A2B] bg-[#F9F4EB]/60 hover:bg-[#F4EDE2] rounded-xl p-5 sm:p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-[210px] sm:min-h-[320px]"
          >
            <div className="w-12 h-12 rounded-full bg-[#E2D4C3] group-hover:bg-[#8C5A2B] text-[#2A1E17] group-hover:text-[#FBF7EE] flex items-center justify-center transition-colors mb-3 sm:mb-4">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="font-serif-display font-bold text-lg text-[#2A1E17] mb-1">
              {t.uploadMoreTitle}
            </h3>
            <p className="text-xs font-sans-ui text-[#7A6B5D] max-w-xs mb-4">
              {t.uploadMoreDesc}
            </p>
            <span className="min-h-[36px] px-3 py-1.5 text-xs font-sans-ui font-medium text-[#8C5A2B] bg-[#E8DDCB] group-hover:bg-[#8C5A2B] group-hover:text-[#FBF7EE] rounded-lg transition-colors flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>{t.uploadMoreBtn}</span>
            </span>
          </div>

        {/* Book Cards */}
        {filteredBooks.map(book => {
          const isSelected = selectedBookIds.includes(book.id);
          const isCombined = book.isCombinedAnalysis || (book.sourceDocuments && book.sourceDocuments.length > 1);

          return (
            <article
              key={book.id}
              onClick={() => onSelectBook(book)}
              className={`group bg-[#F4EDE2] hover:bg-[#F0E6D8] border rounded-xl p-4 sm:p-6 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer relative ${
                isSelected 
                  ? 'border-[#8C5A2B] ring-2 ring-[#8C5A2B]/30 bg-[#F2E8D8]' 
                  : isCombined 
                    ? 'border-[#D4A373]/80 bg-[#FAF4EA]' 
                    : 'border-[#E2D4C3] hover:border-[#8C5A2B]'
              }`}
            >
              <div>
                {/* Header with Category & Selection Checkbox */}
                <div className="flex items-center justify-between text-xs font-sans-ui text-[#7A6B5D] mb-2.5 gap-2">
                  <div className="flex items-center gap-1.5 truncate min-w-0">
                    {isCombined ? (
                      <span className="font-bold text-[#8C5A2B] bg-[#E8DDCB] px-2 py-0.5 rounded text-[10px] flex items-center gap-1 truncate">
                        <Layers className="w-3 h-3 text-[#8C5A2B] shrink-0" />
                        <span className="truncate">{t.combinedBadge} ({book.sourceDocuments?.length || 2} {t.docsLabel})</span>
                      </span>
                    ) : (
                      <span className="font-medium text-[#8C5A2B] truncate">
                        {book.category || 'Classic Works'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="shrink-0 flex items-center gap-1 text-[11px]">
                      <Clock className="w-3 h-3" />
                      {book.estimatedReadTime} {t.minStudy}
                    </span>

                    {/* Selection Checkbox for Combining */}
                    <button
                      onClick={(e) => toggleBookSelection(book.id, e)}
                      className={`min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg hover:bg-[#E2D4C3] transition-colors cursor-pointer ${
                        isSelected ? 'text-[#8C5A2B]' : 'text-stone-400 hover:text-stone-600'
                      }`}
                      title={isSelected ? "Deselect for combined analysis" : "Select to combine with other books"}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#8C5A2B]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Title & Author */}
                <h2 className="font-serif-display font-bold text-xl text-[#2A1E17] group-hover:text-[#8C5A2B] transition-colors leading-snug mb-1 line-clamp-2">
                  {book.title}
                </h2>
                <p className="font-serif-body text-xs italic text-[#6B5B4D] mb-3">
                  {book.author}
                </p>

                {/* Source Documents Preview if Combined */}
                {isCombined && book.sourceDocuments && book.sourceDocuments.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {book.sourceDocuments.map((s, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-sans-ui bg-[#E8DDCB]/80 text-[#5E5043] px-2 py-0.5 rounded border border-[#D8C8B4]"
                      >
                        {s.title}
                      </span>
                    ))}
                  </div>
                )}

                {/* Thesis Preview */}
                <div className="bg-[#FBF7EE] border border-[#E8DDCB] rounded-lg p-3.5 mb-4">
                  <p className="font-serif-body text-xs text-[#3D2F24] leading-relaxed line-clamp-3">
                    "{book.executiveSummary.thesis}"
                  </p>
                </div>
              </div>

              {/* Card Footer */}
              <div>
                <div className="flex items-center gap-3 text-[11px] font-sans-ui text-[#8C7A6B] mb-4 pb-3 border-b border-[#E2D4C3]">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    {(book.wordCount / 1000).toFixed(0)}k {t.wordsLabel}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    {book.chapters.length} {t.chaptersLabel}
                  </span>
                  {book.modernRemedies && book.modernRemedies.length > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-[#8C5A2B] font-medium">
                        {book.modernRemedies.length} {t.remediesLabel}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs font-sans-ui font-medium text-[#2A1E17]">
                  <span className="flex items-center gap-1 text-[#8C5A2B] group-hover:translate-x-1 transition-transform">
                    {t.openStudio}
                    <ArrowRight className={`w-3.5 h-3.5 ${isUrdu ? 'rotate-180' : ''}`} />
                  </span>
                  <div className="flex items-center gap-2">
                    {onDeleteBook && (
                      confirmDeleteId === book.id ? (
                        <div
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1.5 bg-red-50 border border-red-200 px-2 py-1 rounded-lg text-[11px]"
                        >
                          <span className="text-red-900 font-medium">Remove?</span>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setConfirmDeleteId(null);
                              onDeleteBook(book.id);
                            }}
                            className="font-bold text-red-700 hover:underline px-1"
                          >
                            Yes
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setConfirmDeleteId(null);
                            }}
                            className="text-[#5E5043] hover:underline px-1"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(book.id);
                          }}
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center p-1 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-[#E8DDCB]/60 transition-colors cursor-pointer"
                          title="Remove from library"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
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
