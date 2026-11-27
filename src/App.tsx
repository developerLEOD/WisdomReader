import React, { useState } from 'react';
import { BookAnalysis } from './types/book';
import { Header } from './components/Header';
import { BookLibraryView } from './components/BookLibraryView';
import { AnalysisStudio } from './components/AnalysisStudio';
import { ImportModal } from './components/ImportModal';
import { BlcPlannerView } from './components/BlcPlannerView';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';

function AppContent() {
  const { isUrdu, t } = useLanguage();
  const [books, setBooks] = useState<BookAnalysis[]>(() => {
    try {
      const saved = localStorage.getItem('wisdom_reader_books');
      if (saved) {
        const parsedCustom: BookAnalysis[] = JSON.parse(saved);
        // Exclude legacy pre-populated sample book IDs
        const filtered = parsedCustom.filter(
          b => b.isCustomUpload || !['muqaddimah', 'alchemy-happiness', 'masnavi', 'art-of-war', '1984'].includes(b.id)
        );
        return filtered;
      }
    } catch (e) {
      console.warn('Could not load custom books from localStorage:', e);
    }
    return [];
  });

  const [selectedBook, setSelectedBook] = useState<BookAnalysis | null>(() => {
    try {
      const saved = localStorage.getItem('wisdom_reader_books');
      if (saved) {
        const parsedCustom: BookAnalysis[] = JSON.parse(saved);
        const filtered = parsedCustom.filter(
          b => b.isCustomUpload || !['muqaddimah', 'alchemy-happiness', 'masnavi', 'art-of-war', '1984'].includes(b.id)
        );
        return filtered.length > 0 ? filtered[0] : null;
      }
    } catch (e) {
      // ignore
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<'library' | 'studio' | 'blc'>('library');
  const [isImportOpen, setIsImportOpen] = useState(false);

  const handleSelectBook = (book: BookAnalysis) => {
    setSelectedBook(book);
    setActiveTab('studio');
  };

  const handleAnalysisComplete = (newBook: BookAnalysis) => {
    const updated = [newBook, ...books.filter(b => b.id !== newBook.id)];
    setBooks(updated);
    setSelectedBook(newBook);
    setActiveTab('studio');

    try {
      localStorage.setItem('wisdom_reader_books', JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  };

  const handleBatchComplete = (newBooks: BookAnalysis[]) => {
    if (newBooks.length === 0) return;
    const updated = [...newBooks, ...books.filter(b => !newBooks.some(nb => nb.id === b.id))];
    setBooks(updated);
    setSelectedBook(newBooks[0]);
    setActiveTab('studio');

    try {
      localStorage.setItem('wisdom_reader_books', JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  };

  const handleCombineExistingBooks = async (selectedBooks: BookAnalysis[]) => {
    if (selectedBooks.length < 2) return;
    const docs = selectedBooks.map(b => ({
      title: b.title,
      author: b.author,
      text: b.rawTextPreview || `${b.title} by ${b.author}. ${b.executiveSummary.overview}`,
      fileName: `${b.title.replace(/\s+/g, '_')}.txt`
    }));

    const titles = selectedBooks.map(b => b.title);
    const combinedTitle = isUrdu 
      ? `تقابلی مطالعہ: ${titles.slice(0, 2).join(' اور ')}${titles.length > 2 ? ` مع ${titles.length - 2} دیگر کتب` : ''}`
      : `Comparative Study: ${titles.slice(0, 2).join(' & ')}${titles.length > 2 ? ` & ${titles.length - 2} more` : ''}`;

    try {
      const response = await fetch('/api/combined-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documents: docs,
          combinedTitle,
          explanationLevel: selectedBooks[0].explanationLevel || 2
        })
      });

      if (response.ok) {
        const rawText = await response.text();
        let data: any = null;
        try {
          data = rawText ? JSON.parse(rawText) : null;
        } catch {
          data = null;
        }
        if (data && data.executiveSummary) {
          handleAnalysisComplete(data);
          return;
        }
      }
    } catch (e) {
      console.warn('Combined API notice:', e);
    }

    // Dynamic import fallback
    const { createLocalCombinedAnalysis } = await import('./utils/localTextAnalyzer');
    const localCombined = createLocalCombinedAnalysis(docs, combinedTitle, selectedBooks[0].explanationLevel || 2);
    handleAnalysisComplete(localCombined);
  };

  const handleDeleteBook = (bookId: string) => {
    const updated = books.filter(b => b.id !== bookId);
    setBooks(updated);
    if (selectedBook?.id === bookId) {
      setSelectedBook(updated.length > 0 ? updated[0] : null);
      if (updated.length === 0) {
        setActiveTab('library');
      }
    }

    try {
      localStorage.setItem('wisdom_reader_books', JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  };

  const handleNavigate = (tab: 'library' | 'studio' | 'blc') => {
    if (tab === 'studio' && !selectedBook) {
      if (books.length > 0) {
        setSelectedBook(books[0]);
        setActiveTab('studio');
      } else {
        setIsImportOpen(true);
      }
      return;
    }
    setActiveTab(tab);
  };

  return (
    <div className={`min-h-screen bg-[#FBF7EE] bg-paper-grain text-[#2A1E17] font-sans-ui flex flex-col selection:bg-[#E8DDCB] ${isUrdu ? 'font-urdu' : ''}`}>
      
      {/* Header */}
      <Header
        activeTab={activeTab}
        onNavigate={handleNavigate}
        onOpenImport={() => setIsImportOpen(true)}
        selectedBookTitle={selectedBook?.title}
      />

      {/* Main Content View */}
      <main className="flex-1 pb-16">
        {activeTab === 'blc' ? (
          <BlcPlannerView />
        ) : activeTab === 'library' || !selectedBook ? (
          <BookLibraryView
            books={books}
            onSelectBook={handleSelectBook}
            onOpenImport={() => setIsImportOpen(true)}
            onDeleteBook={handleDeleteBook}
            onCombineBooks={handleCombineExistingBooks}
          />
        ) : (
          <AnalysisStudio
            book={selectedBook}
            onBackToLibrary={() => setActiveTab('library')}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="no-print border-t border-[#E8DDCB] bg-[#F4EDE2] py-8 text-center text-xs font-sans-ui text-[#7A6B5D] px-4 space-y-2">
        <p className="font-medium text-[#2A1E17]">
          {t.footerTitle}
        </p>
        <p className="text-[11px] text-[#8C7A6B]">
          {t.footerSub}
        </p>
      </footer>

      {/* Import / Upload Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onAnalysisComplete={handleAnalysisComplete}
        onBatchComplete={handleBatchComplete}
      />

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </AuthProvider>
  );
}
