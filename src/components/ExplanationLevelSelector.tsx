import React from 'react';
import { ExplanationLevel, EXPLANATION_LEVELS } from '../types/book';
import { Layers, Sparkles, BookOpen, Flame, Compass } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface ExplanationLevelSelectorProps {
  selectedLevel: ExplanationLevel;
  onChange: (level: ExplanationLevel) => void;
  compact?: boolean;
  disabled?: boolean;
}

export const ExplanationLevelSelector: React.FC<ExplanationLevelSelectorProps> = ({
  selectedLevel,
  onChange,
  compact = false,
  disabled = false,
}) => {
  const { isUrdu, t } = useLanguage();

  const getLevelIcon = (level: ExplanationLevel) => {
    switch (level) {
      case 1:
        return <Compass className="w-4 h-4 text-blue-600 shrink-0" />;
      case 2:
        return <BookOpen className="w-4 h-4 text-[#8C5A2B] shrink-0" />;
      case 3:
        return <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />;
      case 4:
        return <Flame className="w-4 h-4 text-rose-600 shrink-0" />;
      default:
        return <Layers className="w-4 h-4 text-[#8C5A2B] shrink-0" />;
    }
  };

  const getLevelInfo = (level: ExplanationLevel) => {
    const defaultItem = EXPLANATION_LEVELS.find(l => l.level === level);
    const localized = t.explanationLevels?.[level];
    if (localized) {
      return {
        name: localized.name,
        badge: localized.badge,
        tagline: localized.tagline,
        desc: localized.desc,
      };
    }
    return {
      name: defaultItem?.name || `Level ${level}`,
      badge: defaultItem?.badgeLabel || `Level ${level}`,
      tagline: defaultItem?.tagline || '',
      desc: defaultItem?.description || '',
    };
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1 bg-[#F4EDE2] p-1 rounded-xl border border-[#E2D4C3]">
        {EXPLANATION_LEVELS.map(item => {
          const isSelected = selectedLevel === item.level;
          const info = getLevelInfo(item.level);
          return (
            <button
              key={item.level}
              type="button"
              disabled={disabled}
              onClick={() => onChange(item.level)}
              title={`${info.name}: ${info.desc}`}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-sans-ui font-medium transition-all ${
                isSelected
                  ? 'bg-[#2A1E17] text-[#FBF7EE] shadow-sm'
                  : 'text-[#5E5043] hover:text-[#2A1E17] hover:bg-[#E8DDCB]/60'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {getLevelIcon(item.level)}
              <span>L{item.level}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const activeInfo = getLevelInfo(selectedLevel);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-sans-ui font-medium text-[#2A1E17] flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-[#8C5A2B]" />
          <span>{t.depthOfExplanation}</span>
        </label>
        <span className="text-[11px] font-sans-ui text-[#8C5A2B] font-medium">
          {activeInfo.tagline}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {EXPLANATION_LEVELS.map(item => {
          const isSelected = selectedLevel === item.level;
          const info = getLevelInfo(item.level);

          return (
            <div
              key={item.level}
              onClick={() => !disabled && onChange(item.level)}
              className={`p-3 rounded-xl border transition-all text-left flex items-start gap-3 cursor-pointer ${
                isSelected
                  ? 'bg-[#2A1E17] border-[#2A1E17] text-[#FBF7EE] shadow-md ring-1 ring-[#2A1E17]'
                  : 'bg-[#F4EDE2] border-[#E2D4C3] text-[#2A1E17] hover:border-[#8C5A2B] hover:bg-[#F4EDE2]/80'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                isSelected ? 'bg-[#FBF7EE]/15 text-[#FBF7EE]' : 'bg-[#E8DDCB] text-[#2A1E17]'
              }`}>
                {getLevelIcon(item.level)}
              </div>

              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className={`font-serif-display font-bold text-xs ${
                    isSelected ? 'text-[#FBF7EE]' : 'text-[#2A1E17]'
                  }`}>
                    {info.name}
                  </span>
                  <span className={`text-[10px] font-sans-ui px-1.5 py-0.2 rounded font-medium ${
                    isSelected ? 'bg-[#8C5A2B] text-[#FBF7EE]' : 'bg-[#E2D4C3] text-[#5E5043]'
                  }`}>
                    {info.tagline}
                  </span>
                </div>
                <p className={`text-[11px] leading-relaxed line-clamp-2 ${
                  isSelected ? 'text-[#D8C8B4]' : 'text-[#7A6B5D]'
                }`}>
                  {info.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
