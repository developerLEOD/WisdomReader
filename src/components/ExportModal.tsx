import React, { useState } from 'react';
import { BookAnalysis } from '../types/book';
import { X, Download, Printer, Copy, Check, FileText, Image as ImageIcon, Sparkles } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: BookAnalysis;
  onOpenPngModal?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  book,
  onOpenPngModal
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const generateMarkdown = (): string => {
    let md = `# ${book.title}\n`;
    md += `**Author:** ${book.author}\n`;
    md += `**Category:** ${book.category}\n`;
    md += `**Word Count:** ${book.wordCount} words\n\n`;

    md += `--- \n\n`;
    md += `## Executive Summary\n\n`;
    md += `**Core Thesis:**\n${book.executiveSummary.thesis}\n\n`;
    md += `**Overview:**\n${book.executiveSummary.overview}\n\n`;

    md += `### Key Takeaways\n`;
    book.executiveSummary.keyTakeaways.forEach((k, i) => {
      md += `${i + 1}. ${k}\n`;
    });
    md += `\n`;

    if (book.executiveSummary.famousQuotes?.length) {
      md += `### Famous Quotes\n`;
      book.executiveSummary.famousQuotes.forEach(q => {
        md += `> "${q.quote}" — *${q.context}*\n\n`;
      });
    }

    md += `--- \n\n`;
    md += `## Chapter-by-Chapter Breakdowns\n\n`;
    book.chapters.forEach(ch => {
      md += `### Chapter ${ch.number}: ${ch.title}\n`;
      md += `${ch.summary}\n\n`;
      if (ch.keyEvents?.length) {
        md += `**Key Events / Points:**\n`;
        ch.keyEvents.forEach(ev => md += `- ${ev}\n`);
        md += `\n`;
      }
    });

    if (book.charactersOrEntities?.length) {
      md += `--- \n\n`;
      md += `## Key Scholars, Figures & Concepts\n\n`;
      book.charactersOrEntities.forEach(e => {
        md += `### ${e.name} (${e.role})\n`;
        md += `${e.description}\n\n`;
      });
    }

    if (book.themes?.length) {
      md += `--- \n\n`;
      md += `## Major Themes\n\n`;
      book.themes.forEach(t => {
        md += `### ${t.title}\n`;
        md += `${t.explanation}\n\n`;
      });
    }

    if (book.comparativeSynthesis?.crossDocumentMatrix?.length) {
      md += `--- \n\n`;
      md += `## Cross-Document Comparative Matrix\n\n`;
      book.comparativeSynthesis.crossDocumentMatrix.forEach(row => {
        md += `### ${row.topic} [${row.consensusOrDivergence}]\n`;
        row.docPositions?.forEach(dp => {
          md += `- **${dp.docTitle}:** ${dp.position}\n`;
        });
        md += `*Synthesis:* ${row.synthesisNote}\n\n`;
      });
    }

    if (book.sourceDocuments?.length) {
      md += `--- \n\n`;
      md += `## Contributing Source Documents\n\n`;
      book.sourceDocuments.forEach((sd, i) => {
        md += `${i + 1}. **${sd.title}** by ${sd.author || 'Author'} (${sd.wordCount.toLocaleString()} words)\n`;
      });
      md += `\n`;
    }

    md += `\n*Analyzed with Wisdom Reader by The Wisdom Lounge*\n`;
    return md;
  };

  const handleDownloadMarkdown = () => {
    const md = generateMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${book.title.replace(/\s+/g, '_')}_Analysis.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyClipboard = () => {
    const md = generateMarkdown();
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-[#2A1E17]/60 backdrop-blur-sm animate-fade-in print:hidden">
      <div className="bg-[#FBF7EE] border border-[#D8C8B4] rounded-xl sm:rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[94dvh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[#E8DDCB] bg-[#F4EDE2] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-5 h-5 text-[#8C5A2B] shrink-0" />
            <h2 className="font-serif-display font-bold text-base sm:text-lg text-[#2A1E17] truncate">
              Export Analysis & Notes
            </h2>
          </div>
          <button
            onClick={onClose}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center p-1 text-[#7A6B5D] hover:text-[#2A1E17] hover:bg-[#E8DDCB] rounded-lg transition-colors shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          <p className="text-xs font-sans-ui text-[#5E5043]">
            Choose an export option for <strong>"{book.title}"</strong>:
          </p>

          <div className="space-y-3">
            {onOpenPngModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenPngModal();
                }}
                className="w-full bg-[#2A1E17] hover:bg-[#3D2C22] text-[#FAF5EC] border border-[#423126] rounded-xl p-3.5 sm:p-4 flex items-center justify-between transition-all text-left shadow-sm cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[#8C5A2B]/40 text-[#D4A373] flex items-center justify-center shrink-0 border border-[#8C5A2B]/50">
                    <ImageIcon className="w-5 h-5 text-[#D4A373]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-serif-display font-bold text-sm text-[#FAF5EC]">
                        Export Chapter Cards as 3:4 PNGs
                      </h4>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-sans-ui font-bold bg-[#8C5A2B] text-[#FBF7EE] shrink-0">
                        3:4 Ratio
                      </span>
                    </div>
                    <p className="text-[11px] font-sans-ui text-[#D8C8B4] mt-0.5">
                      Generate crisp 3:4 aspect ratio image cards with themes & citations for social sharing or print.
                    </p>
                  </div>
                </div>
              </button>
            )}

            <button
              onClick={handleDownloadMarkdown}
              className="w-full bg-[#F4EDE2] hover:bg-[#E8DDCB] border border-[#D8C8B4] rounded-xl p-3.5 sm:p-4 flex items-center justify-between transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#2A1E17] text-[#D4A373] flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-serif-display font-bold text-sm text-[#2A1E17]">
                    Download Markdown (.md)
                  </h4>
                  <p className="text-[11px] font-sans-ui text-[#7A6B5D]">
                    Formatted document compatible with Notion, Obsidian, or Markdown editors.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={handleCopyClipboard}
              className="w-full bg-[#F4EDE2] hover:bg-[#E8DDCB] border border-[#D8C8B4] rounded-xl p-3.5 sm:p-4 flex items-center justify-between transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#2A1E17] text-[#D4A373] flex items-center justify-center shrink-0">
                  {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-serif-display font-bold text-sm text-[#2A1E17]">
                    {copied ? 'Copied to Clipboard!' : 'Copy to Clipboard'}
                  </h4>
                  <p className="text-[11px] font-sans-ui text-[#7A6B5D]">
                    Copy the full structured summary as raw Markdown text.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={handlePrint}
              className="w-full bg-[#F4EDE2] hover:bg-[#E8DDCB] border border-[#D8C8B4] rounded-xl p-3.5 sm:p-4 flex items-center justify-between transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#2A1E17] text-[#D4A373] flex items-center justify-center shrink-0">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-serif-display font-bold text-sm text-[#2A1E17]">
                    Print / Save as PDF
                  </h4>
                  <p className="text-[11px] font-sans-ui text-[#7A6B5D]">
                    Opens system print dialog to save as clean formatted PDF.
                  </p>
                </div>
              </div>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
