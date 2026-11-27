import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, translations } from '../i18n/translations';
import { BookAnalysis, TranslatedContent } from '../types/book';
import { getOrTranslateUrduContent, getCachedUrduContent } from '../utils/urduContentTranslator';

interface LanguageContextType {
  language: Language;
  contentLanguage: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  isUrdu: boolean;
  t: typeof translations['en'];
  isTranslating: boolean;
  translateBook: (book: BookAnalysis) => Promise<TranslatedContent>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('wisdom_reader_content_lang');
      if (saved === 'ur' || saved === 'en') return saved;
    } catch (e) {
      // ignore
    }
    return 'en';
  });

  const [isTranslating, setIsTranslating] = useState(false);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('wisdom_reader_content_lang', lang);
    } catch (e) {
      // ignore
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ur' : 'en');
  };

  // Keep entire app shell and UI chrome in English / LTR
  useEffect(() => {
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
    document.body.classList.remove('font-urdu');
    document.body.classList.add('font-sans-ui');
  }, []);

  const translateBook = async (book: BookAnalysis): Promise<TranslatedContent> => {
    const cached = getCachedUrduContent(book);
    if (cached) {
      return cached;
    }

    setIsTranslating(true);
    try {
      const translated = await getOrTranslateUrduContent(book);
      return translated;
    } finally {
      setIsTranslating(false);
    }
  };

  const value: LanguageContextType = {
    language,
    contentLanguage: language,
    setLanguage,
    toggleLanguage,
    isUrdu: language === 'ur',
    // UI chrome always stays in English so no unnecessary app UI is translated
    t: translations['en'],
    isTranslating,
    translateBook
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
