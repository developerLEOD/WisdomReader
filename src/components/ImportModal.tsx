import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Layers, 
  BookOpen, 
  FileCheck, 
  ArrowRight,
  CheckCircle2,
  Edit2
} from 'lucide-react';
import { parseFileToText } from '../utils/fileParser';
import { BookAnalysis, ExplanationLevel } from '../types/book';
import { createLocalManuscriptAnalysis, createLocalCombinedAnalysis } from '../utils/localTextAnalyzer';
import { ExplanationLevelSelector } from './ExplanationLevelSelector';
import { useLanguage } from '../context/LanguageContext';

export interface StagedDocument {
  id: string;
  title: string;
  author: string;
  fileName: string;
  text: string;
  wordCount: number;
}

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalysisComplete: (book: BookAnalysis) => void;
  onBatchComplete?: (books: BookAnalysis[]) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onAnalysisComplete,
  onBatchComplete
}) => {
  const { isUrdu, t } = useLanguage();
  const [activeMode, setActiveMode] = useState<'upload' | 'paste'>('upload');
  const [stagedDocs, setStagedDocs] = useState<StagedDocument[]>([]);
  
  // Single/Combined title & metadata
  const [combinedTitle, setCombinedTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState('Classical Studies');
  const [explanationLevel, setExplanationLevel] = useState<ExplanationLevel>(2);
  const [customInstructions, setCustomInstructions] = useState('');
  const [bookName, setBookName] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [chapterName, setChapterName] = useState('');
  
  // Paste form fields
  const [pastedTitle, setPastedTitle] = useState('');
  const [pastedAuthor, setPastedAuthor] = useState('');
  const [pastedText, setPastedText] = useState('');

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStatus, setProgressStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleMultipleFiles = async (files: FileList | File[]) => {
    setErrorMsg(null);
    setIsProcessing(true);
    setProgressStatus(
      isUrdu
        ? `${files.length} دستاویزات سے متن اخذ کیا جا رہا ہے...`
        : `Extracting text from ${files.length} document${files.length > 1 ? 's' : ''}...`
    );

    try {
      const newStaged: StagedDocument[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgressStatus(
          isUrdu
            ? `مسودہ "${file.name}" کا مطالعہ کیا جا رہا ہے (${i + 1}/${files.length})...`
            : `Reading "${file.name}" (${i + 1}/${files.length})...`
        );
        const parsed = await parseFileToText(file);
        newStaged.push({
          id: `staged-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          title: parsed.title || `Document ${stagedDocs.length + i + 1}`,
          author: parsed.author !== 'Uploaded Document' ? parsed.author : '',
          fileName: file.name,
          text: parsed.text,
          wordCount: parsed.wordCount
        });
      }

      setStagedDocs(prev => {
        const updated = [...prev, ...newStaged];
        // Auto-suggest combined title if 2+ documents and no title entered yet
        if (updated.length >= 2 && !combinedTitle) {
          const titles = updated.map(d => d.title);
          if (updated.length === 2) {
            setCombinedTitle(
              isUrdu
                ? `تقابلی مطالعہ: ${titles[0]} اور ${titles[1]}`
                : `Comparative Study: ${titles[0]} & ${titles[1]}`
            );
          } else {
            setCombinedTitle(
              isUrdu
                ? `تقابلی فکری جائزہ: ${titles.slice(0, 2).join('، ')} مع ${updated.length - 2} دیگر کتب`
                : `Comparative Analysis: ${titles.slice(0, 2).join(', ')} & ${updated.length - 2} More Texts`
            );
          }
        } else if (updated.length === 1 && !combinedTitle) {
          setCombinedTitle(updated[0].title);
        }
        return updated;
      });

      setIsProcessing(false);
    } catch (err: any) {
      console.error('File parsing error:', err);
      setErrorMsg(err?.message || (isUrdu ? 'فائل پارس کرنے میں دشواری پیش آئی۔ برائے مہربانی سادہ متن چسپاں کریں۔' : 'Failed to parse one or more files. Please try text files or paste text.'));
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleMultipleFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleMultipleFiles(e.dataTransfer.files);
    }
  };

  const handleAddPastedDoc = () => {
    if (!pastedText.trim()) {
      setErrorMsg(isUrdu ? 'براہ کرم دستاویز کا متن چسپاں کریں۔' : 'Please paste text before adding to the document queue.');
      return;
    }
    setErrorMsg(null);
    const docTitle = pastedTitle.trim() || (isUrdu ? `مسودہ ${stagedDocs.length + 1}` : `Pasted Text ${stagedDocs.length + 1}`);
    const words = pastedText.trim().split(/\s+/).filter(Boolean).length;

    const newDoc: StagedDocument = {
      id: `pasted-${Date.now()}`,
      title: docTitle,
      author: pastedAuthor.trim(),
      fileName: `${docTitle.slice(0, 20)}.txt`,
      text: pastedText.trim(),
      wordCount: words
    };

    setStagedDocs(prev => {
      const updated = [...prev, newDoc];
      if (updated.length >= 2 && !combinedTitle) {
        setCombinedTitle(
          isUrdu
            ? `تقابلی مطالعہ: ${updated.map(d => d.title).slice(0, 2).join(' اور ')}`
            : `Comparative Study: ${updated.map(d => d.title).slice(0, 2).join(' & ')}`
        );
      } else if (updated.length === 1 && !combinedTitle) {
        setCombinedTitle(newDoc.title);
      }
      return updated;
    });

    // Reset paste fields
    setPastedTitle('');
    setPastedAuthor('');
    setPastedText('');
  };

  const handleRemoveDoc = (id: string) => {
    setStagedDocs(prev => {
      const remaining = prev.filter(d => d.id !== id);
      if (remaining.length === 1) {
        setCombinedTitle(remaining[0].title);
      } else if (remaining.length >= 2) {
        setCombinedTitle(
          isUrdu
            ? `تقابلی مطالعہ: ${remaining.map(d => d.title).slice(0, 2).join(' اور ')}`
            : `Comparative Study: ${remaining.map(d => d.title).slice(0, 2).join(' & ')}`
        );
      } else {
        setCombinedTitle('');
      }
      return remaining;
    });
  };

  const handleUpdateDocTitle = (id: string, newTitle: string) => {
    setStagedDocs(prev => prev.map(d => d.id === id ? { ...d, title: newTitle } : d));
  };

  // Run Combined Comparative Analysis across all staged documents
  const handleRunCombinedAnalysis = async () => {
    if (stagedDocs.length === 0) {
      setErrorMsg(isUrdu ? 'براہ کرم کم از کم ایک دستاویز فراہم کریں۔' : 'Please upload or paste at least one document.');
      return;
    }

    // If only 1 document is staged, run single document analysis
    if (stagedDocs.length === 1) {
      await runSingleAnalysis(stagedDocs[0].text, stagedDocs[0].title, stagedDocs[0].author);
      return;
    }

    setErrorMsg(null);
    setIsProcessing(true);
    const resolvedBaseTitle = bookName.trim() || combinedTitle.trim() || 
      (stagedDocs.length === 1 ? stagedDocs[0].title : 
        (isUrdu 
          ? `تقابلی مطالعہ: ${stagedDocs.map(d => d.title).slice(0, 2).join(' اور ')}`
          : `Comparative Study: ${stagedDocs.map(d => d.title).slice(0, 2).join(' & ')}`));
    
    const finalTitle = chapterName.trim() ? `${resolvedBaseTitle} — ${chapterName.trim()}` : resolvedBaseTitle;
    const finalAuthor = authorName.trim() || stagedDocs[0]?.author || author || 'Author';

    setProgressStatus(
      isUrdu
        ? `${stagedDocs.length} متون کا مشترکہ تقابلی تجزیہ سطح ${explanationLevel} پر کیا جا رہا ہے...`
        : `Conducting multi-document comparative synthesis of ${stagedDocs.length} works at Level ${explanationLevel}...`
    );

    try {
      let combinedBook: BookAnalysis | null = null;
      const customDirectives = customInstructions.trim() || undefined;

      try {
        const response = await fetch('/api/combined-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documents: stagedDocs.map(d => ({
              title: d.title,
              author: d.author,
              text: d.text,
              fileName: d.fileName
            })),
            combinedTitle: finalTitle,
            explanationLevel,
            customInstructions: customDirectives
          })
        });

        if (response.ok) {
          const rawText = await response.text();
          let data: any = null;
          try {
            data = JSON.parse(rawText);
          } catch (e) {
            console.warn('Combined API JSON parse notice');
          }
          if (data && data.executiveSummary) {
            combinedBook = { ...data, explanationLevel };
          }
        }
      } catch (serverErr) {
        console.warn('Server API notice, falling back to local multi-document synthesizer:', serverErr);
      }

      // Guaranteed zero-error fallback
      if (!combinedBook) {
        setProgressStatus('Building structured cross-document comparative matrix, dialectics & remedies...');
        combinedBook = createLocalCombinedAnalysis(stagedDocs, finalTitle, explanationLevel, customDirectives);
      }

      setIsProcessing(false);
      onAnalysisComplete(combinedBook);
      onClose();
    } catch (err: any) {
      console.error('Combined analysis error:', err);
      const fallback = createLocalCombinedAnalysis(stagedDocs, finalTitle, explanationLevel, customInstructions.trim() || undefined);
      setIsProcessing(false);
      onAnalysisComplete(fallback);
      onClose();
    }
  };

  // Run individual single document analysis
  const runSingleAnalysis = async (text: string, docTitle: string, docAuthor: string) => {
    const customDirectives = customInstructions.trim() || undefined;
    const resolvedBaseTitle = bookName.trim() || docTitle || 'Uploaded Manuscript';
    const finalTitle = chapterName.trim() ? `${resolvedBaseTitle} — ${chapterName.trim()}` : resolvedBaseTitle;
    const finalAuthor = authorName.trim() || docAuthor || author || 'Author';

    try {
      setProgressStatus(`Analyzing manuscript at Explanation Level ${explanationLevel}...`);
      let newBook: BookAnalysis | null = null;

      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            title: finalTitle,
            author: finalAuthor,
            category,
            explanationLevel,
            customInstructions: customDirectives
          })
        });

        if (response.ok) {
          const rawText = await response.text();
          let data: any = null;
          try {
            data = JSON.parse(rawText);
          } catch (e) {
            console.warn('Single API JSON parse notice');
          }
          if (data && data.executiveSummary) {
            newBook = { ...data, explanationLevel };
          }
        }
      } catch (serverErr) {
        console.warn('Server API notice, building structured local analysis:', serverErr);
      }

      if (!newBook) {
        setProgressStatus(isUrdu ? 'خاکہ جات اور نکات مرتب کیے جا رہے ہیں...' : 'Structuring chapter outlines, concepts & takeaways...');
        newBook = createLocalManuscriptAnalysis(text, finalTitle, finalAuthor, category, explanationLevel, customDirectives);
      }

      setIsProcessing(false);
      onAnalysisComplete(newBook);
      onClose();
    } catch (err: any) {
      console.error('Single analysis error:', err);
      const fallbackBook = createLocalManuscriptAnalysis(text, finalTitle, finalAuthor, category, explanationLevel, customInstructions.trim() || undefined);
      setIsProcessing(false);
      onAnalysisComplete(fallbackBook);
      onClose();
    }
  };

  // Batch process all documents as separate individual books
  const handleBatchAnalyzeAsIndividual = async () => {
    if (stagedDocs.length === 0) return;
    setIsProcessing(true);
    setProgressStatus(`Batch analyzing ${stagedDocs.length} individual manuscripts...`);
    const customDirectives = customInstructions.trim() || undefined;

    const results: BookAnalysis[] = [];
    for (let i = 0; i < stagedDocs.length; i++) {
      const doc = stagedDocs[i];
      setProgressStatus(`Analyzing "${doc.title}" (${i + 1}/${stagedDocs.length})...`);
      
      let book: BookAnalysis | null = null;
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: doc.text,
            title: doc.title,
            author: doc.author || 'Author',
            category,
            explanationLevel,
            customInstructions: customDirectives
          })
        });
        if (response.ok) {
          const data = await response.json();
          if (data && data.executiveSummary) {
            book = { ...data, explanationLevel };
          }
        }
      } catch (e) {
        console.warn(`Fallback for ${doc.title}:`, e);
      }

      if (!book) {
        book = createLocalManuscriptAnalysis(doc.text, doc.title, doc.author || 'Author', category, explanationLevel, customDirectives);
      }
      results.push(book);
    }

    setIsProcessing(false);
    if (onBatchComplete) {
      onBatchComplete(results);
    } else if (results.length > 0) {
      onAnalysisComplete(results[0]);
    }
    onClose();
  };

  const totalWords = stagedDocs.reduce((acc, d) => acc + d.wordCount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#2A1E17]/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#FBF7EE] border border-[#D8C8B4] rounded-xl sm:rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-2.5 px-4 sm:px-6 py-3 sm:py-4 border-b border-[#E8DDCB] bg-[#F4EDE2] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#2A1E17] text-[#D4A373] flex items-center justify-center shrink-0">
              {stagedDocs.length > 1 ? <Layers className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h2 className="font-serif-display font-bold text-base sm:text-lg text-[#2A1E17] truncate">
                {stagedDocs.length > 1 
                  ? `${t.importModalCombinedTitle} (${stagedDocs.length})`
                  : t.importModalTitle}
              </h2>
              <p className="text-[11px] font-sans-ui text-[#7A6B5D] truncate">
                {t.importModalSub}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center p-1 text-[#7A6B5D] hover:text-[#2A1E17] hover:bg-[#E8DDCB] rounded-lg transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">
          
          {/* Error Message Alert */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-sans-ui flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Loading Indicator */}
          {isProcessing ? (
            <div className="py-14 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#F4EDE2] border-2 border-[#8C5A2B] flex items-center justify-center text-[#8C5A2B] animate-spin">
                <Loader2 className="w-7 h-7" />
              </div>
              <div className="max-w-md space-y-1">
                <h3 className="font-serif-display font-bold text-base text-[#2A1E17]">
                  {isUrdu ? 'حکمت و بصیرت کا تجزیہ جاری ہے' : 'Synthesizing Wisdom Corpus'}
                </h3>
                <p className="text-xs font-sans-ui text-[#7A6B5D]">
                  {progressStatus}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Book, Author & Chapter Metadata Input Card */}
              <div className="space-y-3 bg-[#F4EDE2]/80 border border-[#D8C8B4] rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-serif-display font-bold text-[#2A1E17]">
                    <BookOpen className="w-4 h-4 text-[#8C5A2B]" />
                    <span>{isUrdu ? 'کتاب، مصنف اور باب کی تفصیلات' : 'Book, Author & Chapter Details'}</span>
                  </label>
                  <span className="text-[10px] font-sans-ui text-[#8C7A6B] bg-[#E2D4C3] px-2 py-0.5 rounded-full">
                    {isUrdu ? 'لازمی معلومات' : 'Metadata'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-sans-ui font-medium text-[#5E5043] mb-1">
                      {isUrdu ? 'کتاب کا نام (Book Title)' : 'Book Title'}
                    </label>
                    <input
                      type="text"
                      value={bookName}
                      onChange={e => setBookName(e.target.value)}
                      placeholder={isUrdu ? "مثال: احیاء علوم الدین" : "e.g. Ihya Ulum al-Din"}
                      className="w-full bg-[#FBF7EE] border border-[#D8C8B4] rounded-lg px-3 py-1.5 text-xs font-sans-ui text-[#2A1E17] placeholder-[#9A8B7C] focus:outline-none focus:border-[#8C5A2B]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-sans-ui font-medium text-[#5E5043] mb-1">
                      {isUrdu ? 'مصنف کا نام (Author)' : 'Author Name'}
                    </label>
                    <input
                      type="text"
                      value={authorName}
                      onChange={e => setAuthorName(e.target.value)}
                      placeholder={isUrdu ? "مثال: امام غزالی" : "e.g. Al-Ghazali"}
                      className="w-full bg-[#FBF7EE] border border-[#D8C8B4] rounded-lg px-3 py-1.5 text-xs font-sans-ui text-[#2A1E17] placeholder-[#9A8B7C] focus:outline-none focus:border-[#8C5A2B]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-sans-ui font-medium text-[#5E5043] mb-1">
                      {isUrdu ? 'باب کا نام / نمبر (Chapter)' : 'Chapter Name / Number'}
                    </label>
                    <input
                      type="text"
                      value={chapterName}
                      onChange={e => setChapterName(e.target.value)}
                      placeholder={isUrdu ? "مثال: باب اول: علم" : "e.g. Chapter 1: On Knowledge"}
                      className="w-full bg-[#FBF7EE] border border-[#D8C8B4] rounded-lg px-3 py-1.5 text-xs font-sans-ui text-[#2A1E17] placeholder-[#9A8B7C] focus:outline-none focus:border-[#8C5A2B]"
                    />
                  </div>
                </div>
              </div>

              {/* Staged Documents Queue (If Any Uploaded) */}
              {stagedDocs.length > 0 && (
                <div className="space-y-3 bg-[#EFE7D8]/80 border border-[#D8C8B4] rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-sans-ui font-bold uppercase tracking-wider text-[#8C5A2B]">
                        {t.stagedDocsLabel} ({stagedDocs.length})
                      </span>
                      <span className="text-[11px] font-sans-ui text-[#7A6B5D] bg-[#E2D4C3] px-2 py-0.5 rounded-full">
                        {totalWords.toLocaleString()} {t.wordsLabel}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-sans-ui font-medium text-[#8C5A2B] hover:text-[#2A1E17] flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t.addMoreFiles}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {stagedDocs.map((doc, idx) => (
                      <div
                        key={doc.id}
                        className="bg-[#FBF7EE] border border-[#E2D4C3] rounded-lg p-2.5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="w-6 h-6 rounded bg-[#2A1E17] text-[#D4A373] text-[11px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <input
                              type="text"
                              value={doc.title}
                              onChange={e => handleUpdateDocTitle(doc.id, e.target.value)}
                              placeholder="Document Title"
                              className="font-serif-display font-bold text-xs text-[#2A1E17] bg-transparent border-b border-transparent hover:border-[#8C5A2B] focus:border-[#8C5A2B] focus:outline-none w-full truncate"
                            />
                            <div className="flex items-center gap-2 text-[10px] text-[#7A6B5D] mt-0.5">
                              <span>{doc.fileName}</span>
                              <span>·</span>
                              <span>{doc.wordCount.toLocaleString()} {t.wordsLabel}</span>
                              {doc.author && (
                                <>
                                  <span>·</span>
                                  <span>{doc.author}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRemoveDoc(doc.id)}
                            className="p-1 text-stone-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                            title="Remove document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {stagedDocs.length >= 2 && (
                    <div className="pt-2 border-t border-[#D8C8B4] space-y-2">
                      <label className="block text-xs font-serif-display font-bold text-[#2A1E17]">
                        {t.combinedStudyTitleLabel} <span className="text-[#8C5A2B] font-sans-ui text-[11px]">{t.combinedStudyTitleSub}</span>
                      </label>
                      <input
                        type="text"
                        value={combinedTitle}
                        onChange={e => setCombinedTitle(e.target.value)}
                        placeholder={isUrdu ? "مثال: تقابلی مطالعہ: ابن خلدون اور امام غزالی" : "e.g. Comparative Study: Ibn Khaldun & Al-Ghazali"}
                        className="w-full bg-[#FBF7EE] border border-[#CBB9A3] focus:border-[#8C5A2B] rounded-lg px-3 py-2 text-xs font-serif-display font-medium text-[#2A1E17] placeholder-[#9A8B7C] focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Mode Switcher */}
              <div className="flex p-1 bg-[#F4EDE2] rounded-lg border border-[#E2D4C3]">
                <button
                  type="button"
                  onClick={() => setActiveMode('upload')}
                  className={`flex-1 py-2 text-xs font-sans-ui font-medium rounded-md transition-colors cursor-pointer ${
                    activeMode === 'upload'
                      ? 'bg-[#2A1E17] text-[#FBF7EE] shadow-sm'
                      : 'text-[#5E5043] hover:text-[#2A1E17]'
                  }`}
                >
                  {t.uploadModeFiles}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMode('paste')}
                  className={`flex-1 py-2 text-xs font-sans-ui font-medium rounded-md transition-colors cursor-pointer ${
                    activeMode === 'paste'
                      ? 'bg-[#2A1E17] text-[#FBF7EE] shadow-sm'
                      : 'text-[#5E5043] hover:text-[#2A1E17]'
                  }`}
                >
                  {t.uploadModePaste}
                </button>
              </div>

              {/* Upload Drop Zone */}
              {activeMode === 'upload' ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-[#D4C5B0] hover:border-[#8C5A2B] bg-[#F4EDE2]/50 hover:bg-[#F4EDE2] rounded-xl p-5 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors space-y-3"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.epub,.txt,.md,.text"
                    multiple
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-full bg-[#E2D4C3] text-[#8C5A2B] flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-serif-display font-medium text-sm text-[#2A1E17]">
                      {stagedDocs.length === 0 ? t.dropZoneEmpty : t.dropZoneMore}
                    </p>
                    <p className="text-[11px] font-sans-ui text-[#7A6B5D] mt-0.5">
                      {t.dropZoneFormats}
                    </p>
                  </div>
                </div>
              ) : (
                /* Paste Text Section */
                <div className="space-y-3 bg-[#F4EDE2]/50 border border-[#E2D4C3] rounded-xl p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-sans-ui font-medium text-[#5E5043] mb-1">
                        {t.pasteDocTitle}
                      </label>
                      <input
                        type="text"
                        value={pastedTitle}
                        onChange={e => setPastedTitle(e.target.value)}
                        placeholder={isUrdu ? "مثال: باب اول: خلوت و عزلت" : "e.g. Chapter 1: On Solitude"}
                        className="w-full bg-[#FBF7EE] border border-[#D8C8B4] rounded-lg px-3 py-1.5 text-xs font-sans-ui text-[#2A1E17] placeholder-[#9A8B7C] focus:outline-none focus:border-[#8C5A2B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-sans-ui font-medium text-[#5E5043] mb-1">
                        {t.pasteDocAuthor}
                      </label>
                      <input
                        type="text"
                        value={pastedAuthor}
                        onChange={e => setPastedAuthor(e.target.value)}
                        placeholder={isUrdu ? "مثال: امام غزالی" : "e.g. Classical Scholar"}
                        className="w-full bg-[#FBF7EE] border border-[#D8C8B4] rounded-lg px-3 py-1.5 text-xs font-sans-ui text-[#2A1E17] placeholder-[#9A8B7C] focus:outline-none focus:border-[#8C5A2B]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-sans-ui font-medium text-[#5E5043] mb-1">
                      {t.pasteDocText}
                    </label>
                    <textarea
                      rows={5}
                      value={pastedText}
                      onChange={e => setPastedText(e.target.value)}
                      placeholder={isUrdu ? "یہاں مسودے کا متن چسپاں کریں..." : "Paste manuscript text or excerpts here..."}
                      className="w-full bg-[#FBF7EE] border border-[#D8C8B4] rounded-lg p-3 text-xs font-serif-body text-[#2A1E17] placeholder-[#9A8B7C] focus:outline-none focus:border-[#8C5A2B]"
                    />
                    <div className="flex items-center justify-between text-[11px] font-sans-ui text-[#8C7A6B] mt-1">
                      <span>{pastedText.split(/\s+/).filter(Boolean).length} {t.wordsLabel}</span>
                      <button
                        type="button"
                        onClick={handleAddPastedDoc}
                        disabled={!pastedText.trim()}
                        className="px-3 py-1 text-xs font-sans-ui font-medium text-[#2A1E17] bg-[#E8DDCB] hover:bg-[#D4A373]/40 disabled:opacity-50 border border-[#D8C8B4] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {t.btnAddPasted}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Explanation Level Selector */}
              <ExplanationLevelSelector
                selectedLevel={explanationLevel}
                onChange={setExplanationLevel}
              />

              {/* Specific Focus Topics & Custom Directives Box */}
              <div className="space-y-2 bg-[#F4EDE2]/70 border border-[#E2D4C3] rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-serif-display font-bold text-[#2A1E17]">
                    <Edit2 className="w-3.5 h-3.5 text-[#8C5A2B]" />
                    <span>{isUrdu ? 'مخصوص موضوعات یا ہدایت نامہ (اختیاری)' : 'Specific Focus Topics & Custom Directives (Optional)'}</span>
                  </label>
                  <span className="text-[10px] font-sans-ui text-[#8C7A6B] bg-[#E2D4C3] px-2 py-0.5 rounded-full">
                    {isUrdu ? 'تجزیاتی توجہ' : 'Custom AI Focus'}
                  </span>
                </div>
                <p className="text-[11px] font-sans-ui text-[#7A6B5D]">
                  {isUrdu 
                    ? 'ان مخصوص سوالات، ابواب، یا موضوعات کی نشاندہی کریں جن پر آپ چاہتے ہیں کہ کاوش کا تجزیہ خاص طور پر توجہ مرکوز کرے:' 
                    : 'Point out specific topics, questions, or chapters you want the AI analysis to specifically focus on and address:'}
                </p>
                <textarea
                  rows={2}
                  value={customInstructions}
                  onChange={e => setCustomInstructions(e.target.value)}
                  placeholder={
                    isUrdu
                      ? "مثال: باب ۳ اور جدید دور کے فکری جمود کا حل، یا اخلاقی تربیت کے عملی نکات پر خاص توجہ دیں۔۔۔"
                      : "e.g., Focus specifically on Chapter 3, analyze how the author addresses moral decline, and extract remedies for digital burnout..."
                  }
                  className="w-full bg-[#FBF7EE] border border-[#D8C8B4] focus:border-[#8C5A2B] rounded-lg p-2.5 text-xs font-sans-ui text-[#2A1E17] placeholder-[#9A8B7C] focus:outline-none transition-colors"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#E8DDCB] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[40px] px-4 py-2 text-xs font-sans-ui text-[#5E5043] hover:text-[#2A1E17] rounded-xl border border-[#D8C8B4] sm:border-transparent cursor-pointer"
                >
                  {t.btnCancel}
                </button>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
                  {stagedDocs.length >= 2 ? (
                    <>
                      <button
                        type="button"
                        onClick={handleBatchAnalyzeAsIndividual}
                        className="min-h-[42px] flex-1 sm:flex-none px-4 py-2.5 text-xs font-sans-ui font-medium text-[#5E5043] bg-[#E8DDCB] hover:bg-[#D8C8B4] rounded-xl transition-colors cursor-pointer"
                      >
                        {t.btnAnalyzeSeparate} ({stagedDocs.length})
                      </button>

                      <button
                        type="button"
                        onClick={handleRunCombinedAnalysis}
                        className="min-h-[42px] flex-1 sm:flex-none px-5 py-2.5 text-xs font-sans-ui font-bold text-[#FBF7EE] bg-[#2A1E17] hover:bg-[#3D2C22] rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Layers className="w-4 h-4 text-[#D4A373]" />
                        <span>{t.btnRunCombined}</span>
                      </button>
                    </>
                  ) : stagedDocs.length === 1 ? (
                    <button
                      type="button"
                      onClick={handleRunCombinedAnalysis}
                      className="min-h-[42px] w-full sm:w-auto px-6 py-2.5 text-xs font-sans-ui font-bold text-[#FBF7EE] bg-[#2A1E17] hover:bg-[#3D2C22] rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-[#D4A373]" />
                      <span>{t.btnAnalyzeSingle} ({isUrdu ? `سطح ${explanationLevel}` : `Level ${explanationLevel}`})</span>
                    </button>
                  ) : (
                    <p className="text-xs font-sans-ui text-[#8C7A6B] italic text-center sm:text-left py-1">
                      {isUrdu ? 'تجزیہ شروع کرنے کے لیے کوئی مسودہ اپلوڈ یا چسپاں کریں' : 'Upload or paste a document to begin analysis'}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
};
