import React from 'react';
import { BookOpen, CalendarRange, Compass, Sparkles, PlusCircle, Languages, LogIn, LogOut, Loader2, User as UserIcon } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  activeTab: 'library' | 'studio' | 'blc';
  onNavigate: (tab: 'library' | 'studio' | 'blc') => void;
  onOpenImport: () => void;
  selectedBookTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onNavigate,
  onOpenImport,
  selectedBookTitle
}) => {
  const { isUrdu, toggleLanguage, t } = useLanguage();
  const { user, authReady, isSigningIn, signInWithGoogle, signOutUser } = useAuth();

  return (
    <header className="no-print sticky top-0 z-40 bg-[#FBF7EE]/95 backdrop-blur-md border-b border-[#E8DDCB] px-4 md:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 md:gap-8">
        
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => onNavigate('library')}>
          <div className="w-9 h-9 rounded-lg bg-[#2A1E17] text-[#FBF7EE] flex items-center justify-center shadow-sm">
            <BookOpen className="w-5 h-5 text-[#D4A373]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif-display font-bold text-xl tracking-tight text-[#2A1E17] whitespace-nowrap">
                {t.brandTitle}
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-sans-ui font-medium uppercase tracking-wider text-[#8C5A2B] bg-[#F4EDE2] border border-[#E2D4C3] rounded">
                {t.wisdomLounge}
              </span>
            </div>
            <p className="text-[11px] font-sans-ui text-[#7A6B5D] hidden md:block leading-none mt-0.5">
              {t.brandSubtitle}
            </p>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-sans-ui font-medium text-[#5E5043]">
          <button
            onClick={() => onNavigate('library')}
            className={`transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'library' ? 'text-[#2A1E17] font-semibold border-b-2 border-[#8C5A2B] pb-0.5' : 'hover:text-[#2A1E17]'
            }`}
          >
            <Compass className="w-4 h-4 text-[#8C5A2B]" />
            <span>{t.navLibrary}</span>
          </button>

          <button
            onClick={() => onNavigate('studio')}
            className={`transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'studio' ? 'text-[#2A1E17] font-semibold border-b-2 border-[#8C5A2B] pb-0.5' : 'hover:text-[#2A1E17]'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#8C5A2B]" />
            {selectedBookTitle ? (
              <span className="max-w-[180px] truncate" title={selectedBookTitle}>
                {selectedBookTitle}
              </span>
            ) : (
              <span>{t.navStudio}</span>
            )}
          </button>

          <button
            onClick={() => onNavigate('blc')}
            className={`transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'blc' ? 'text-[#2A1E17] font-semibold border-b-2 border-[#8C5A2B] pb-0.5' : 'hover:text-[#2A1E17]'
            }`}
          >
            <CalendarRange className="w-4 h-4 text-[#8C5A2B]" />
            <span>{t.navBlc}</span>
          </button>
        </nav>

        {/* Zone 3: Language Toggle & Primary Action */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
          {/* Urdu / English Content Language Toggle */}
          <button
            onClick={toggleLanguage}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 text-xs font-sans-ui font-medium rounded-lg transition-all shadow-xs cursor-pointer border min-h-[38px] ${
              isUrdu
                ? 'bg-[#2A1E17] text-[#FAF5EC] border-[#2A1E17] shadow-sm'
                : 'bg-[#F4EDE2] text-[#2A1E17] hover:bg-[#E8DDCB] border-[#D8C8B4]'
            }`}
            title={isUrdu ? "Switch back to English content" : "Translate book content into scholarly Urdu (اردو ترجمہ)"}
            aria-label="Toggle book content translation"
          >
            <Languages className={`w-3.5 h-3.5 shrink-0 ${isUrdu ? 'text-[#D4A373]' : 'text-[#8C5A2B]'}`} />
            <span className="font-semibold hidden sm:inline">{isUrdu ? 'اردو مواد (Urdu)' : 'Translate Content'}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${isUrdu ? 'bg-[#D4A373] text-[#2A1E17]' : 'bg-[#E8DDCB] text-[#7A6B5D]'}`}>
              {isUrdu ? 'اردو' : 'EN'}
            </span>
          </button>

          <button
            onClick={onOpenImport}
            className="px-3 sm:px-4 py-2 text-xs md:text-sm font-sans-ui font-medium text-[#FBF7EE] bg-[#2A1E17] hover:bg-[#3D2C22] active:bg-[#1A120E] rounded-lg transition-all shadow-sm flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 border border-[#423126] min-h-[38px]"
          >
            <PlusCircle className="w-4 h-4 text-[#D4A373] shrink-0" />
            <span className="hidden sm:inline">{t.btnAnalyzeNew}</span>
            <span className="sm:hidden font-bold">+ New</span>
          </button>

          {authReady && (
            user ? (
              <button
                type="button"
                onClick={signOutUser}
                title={`Signed in as ${user.email || user.displayName || 'Google User'} (click to sign out)`}
                className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-sans-ui font-medium rounded-lg bg-[#F4EDE2] hover:bg-[#E8DDCB] text-[#2A1E17] border border-[#D8C8B4] transition-colors min-h-[38px] shrink-0 cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5 text-[#8C5A2B] shrink-0" />
                <span className="hidden lg:inline max-w-[110px] truncate">
                  {user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'Account'}
                </span>
                <LogOut className="w-3.5 h-3.5 text-[#7A6B5D] shrink-0" />
              </button>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={isSigningIn}
                title="Sign in with Google to sync saved BLCs"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-sans-ui font-medium rounded-lg bg-[#F4EDE2] hover:bg-[#E8DDCB] text-[#2A1E17] border border-[#D8C8B4] transition-colors min-h-[38px] shrink-0 cursor-pointer disabled:opacity-60"
              >
                {isSigningIn ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8C5A2B] shrink-0" />
                ) : (
                  <LogIn className="w-3.5 h-3.5 text-[#8C5A2B] shrink-0" />
                )}
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )
          )}
        </div>

      </div>

      {/* Mobile Navigation Segmented Row (Touch Friendly >= 42px) */}
      <nav className="grid grid-cols-3 md:hidden gap-1.5 pt-2.5 mt-2.5 border-t border-[#E8DDCB] text-xs font-sans-ui font-medium text-[#5E5043]">
        <button
          type="button"
          onClick={() => onNavigate('library')}
          className={`min-h-[42px] px-2 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all text-center ${
            activeTab === 'library'
              ? 'bg-[#2A1E17] text-[#FAF5EC] font-semibold shadow-xs'
              : 'bg-[#F4EDE2] text-[#5E5043] hover:text-[#2A1E17] border border-[#D8C8B4] active:bg-[#E8DDCB]'
          }`}
        >
          <Compass className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'library' ? 'text-[#D4A373]' : 'text-[#8C5A2B]'}`} />
          <span className="truncate">{t.navLibrary}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('studio')}
          className={`min-h-[42px] px-2 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all text-center ${
            activeTab === 'studio'
              ? 'bg-[#2A1E17] text-[#FAF5EC] font-semibold shadow-xs'
              : 'bg-[#F4EDE2] text-[#5E5043] hover:text-[#2A1E17] border border-[#D8C8B4] active:bg-[#E8DDCB]'
          }`}
        >
          <Sparkles className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'studio' ? 'text-[#D4A373]' : 'text-[#8C5A2B]'}`} />
          <span className="truncate">{t.navStudio}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('blc')}
          className={`min-h-[42px] px-2 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all text-center ${
            activeTab === 'blc'
              ? 'bg-[#2A1E17] text-[#FAF5EC] font-semibold shadow-xs'
              : 'bg-[#F4EDE2] text-[#5E5043] hover:text-[#2A1E17] border border-[#D8C8B4] active:bg-[#E8DDCB]'
          }`}
        >
          <CalendarRange className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'blc' ? 'text-[#D4A373]' : 'text-[#8C5A2B]'}`} />
          <span className="truncate">{t.navBlc}</span>
        </button>
      </nav>
    </header>
  );
};
