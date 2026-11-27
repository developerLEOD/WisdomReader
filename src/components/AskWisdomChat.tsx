import React, { useState, useEffect } from 'react';
import { BookAnalysis, ChatMessage, ExplanationLevel } from '../types/book';
import { Send, MessageSquare, Sparkles, Loader2, BookOpen, Quote, Trash2 } from 'lucide-react';
import { ExplanationLevelSelector } from './ExplanationLevelSelector';
import { useLanguage } from '../context/LanguageContext';

interface AskWisdomChatProps {
  book: BookAnalysis;
}

export const AskWisdomChat: React.FC<AskWisdomChatProps> = ({ book }) => {
  const { isUrdu, t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        text: isUrdu
          ? `خوش آمدید۔ میں کتاب **"${book.title}"** (از ${book.author}) کے مطالعے میں آپ کا معاون ہوں۔ آپ مجھ سے ابواب، مفکرین، اہم تصورات یا متنی حوالوں کے متعلق کوئی بھی سوال پوچھ سکتے ہیں۔`
          : `Greetings. I am your Wisdom Assistant for **"${book.title}"** by ${book.author}. You can ask me any specific question about chapters, character/scholar arguments, core concepts, or textual citations.`,
        timestamp: Date.now()
      }
    ]);
  }, [book, isUrdu]);

  const [inputQuestion, setInputQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatLevel, setChatLevel] = useState<ExplanationLevel>(book.explanationLevel || 2);

  const suggestedQuestions = isUrdu ? [
    `"${book.title}" کا بنیادی فلسفیانہ مقالہ کیا ہے؟`,
    `پہلے باب کے کلیدی دلائل کا خلاصہ پیش کریں۔`,
    `اس کتاب کے سب سے مشہور اقتباسات اور ان کا سیاق و سباق کیا ہے؟`,
    `یہ متن کلاسیکی اخلاقیات سے کس طرح ہم آہنگ ہے؟`
  ] : [
    `What is the central thesis of "${book.title}"?`,
    `Summarize the main argument in Chapter 1.`,
    `What are the most famous quotes and their context?`,
    `How does this text relate to classical ethics?`
  ];

  const handleSend = async (questionText?: string) => {
    const q = questionText || inputQuestion;
    if (!q.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: q,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuestion('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookContext: book,
          userQuestion: q,
          explanationLevel: chatLevel,
          messages: messages.slice(-6)
        })
      });

      const rawText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        console.error('Non-JSON chat response received:', rawText.slice(0, 300));
      }

      if (!response.ok || !data) {
        throw new Error(data?.error || `Server chat error (${response.status}).`);
      }

      const assistantMsg: ChatMessage = {
        id: 'assistant-' + Date.now(),
        sender: 'assistant',
        text: data.answer,
        citations: data.citations || [],
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages(prev => [
        ...prev,
        {
          id: 'error-' + Date.now(),
          sender: 'assistant',
          text: err?.message || 'I encountered an issue searching the manuscript. Please try rephrasing your question.',
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'assistant',
        text: `Chat history cleared. What else would you like to explore in **"${book.title}"**?`,
        timestamp: Date.now()
      }
    ]);
  };

  return (
    <div className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-2xl flex flex-col h-[calc(100dvh-210px)] min-h-[440px] max-h-[650px] shadow-sm overflow-hidden">
      
      {/* Top Header */}
      <div className={`px-3.5 sm:px-6 py-3 sm:py-4 bg-[#FBF7EE] border-b border-[#E2D4C3] flex flex-wrap items-center justify-between gap-3 sm:gap-4 ${isUrdu ? 'font-urdu' : ''}`}>
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#2A1E17] text-[#D4A373] flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-serif-display font-bold text-sm sm:text-base text-[#2A1E17] truncate">
              {t.chatTitle}
            </h3>
            <p className="text-[11px] sm:text-xs font-sans-ui text-[#7A6B5D] truncate">
              {isUrdu ? `کتاب "${book.title}" پر مبنی باہمی سوال و جواب` : `Interactive Q&A grounded in "${book.title}"`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-xs font-sans-ui text-[#7A6B5D] hidden sm:inline font-medium">
              {isUrdu ? 'گہرائی:' : 'Depth:'}
            </span>
            <ExplanationLevelSelector
              selectedLevel={chatLevel}
              onChange={setChatLevel}
              compact={true}
            />
          </div>

          <button
            onClick={clearHistory}
            className="min-h-[34px] text-xs font-sans-ui text-[#7A6B5D] hover:text-[#2A1E17] flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-[#E8DDCB] transition-colors shrink-0"
            title="Clear chat history"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        </div>
      </div>

      {/* Suggested Prompts */}
      <div className="px-3.5 sm:px-6 py-2.5 bg-[#F8F2E8] border-b border-[#E8DDCB] flex items-center gap-2 overflow-x-auto scrollbar-none touch-pan-x">
        <span className="text-[11px] font-sans-ui font-medium text-[#8C5A2B] uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Prompts:
        </span>
        {suggestedQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            disabled={isLoading}
            className={`min-h-[32px] text-xs font-sans-ui text-[#5E5043] hover:text-[#2A1E17] bg-[#FBF7EE] hover:bg-[#F4EDE2] border border-[#D8C8B4] rounded-lg px-2.5 py-1 transition-colors whitespace-nowrap shrink-0 ${isUrdu ? 'font-urdu' : ''}`}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Message List */}
      <div className="flex-1 p-3.5 sm:p-6 overflow-y-auto space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-4 text-xs font-sans-ui leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-[#2A1E17] text-[#FBF7EE] rounded-tr-none shadow-sm'
                  : 'bg-[#FBF7EE] border border-[#E2D4C3] text-[#2A1E17] rounded-tl-none shadow-sm'
              } ${isUrdu ? 'font-urdu' : ''}`}
            >
              <div className="whitespace-pre-wrap font-sans-ui space-y-2">
                {msg.text}
              </div>

              {/* Citation Cards */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#E8DDCB] space-y-2">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8C5A2B] flex items-center gap-1">
                    <Quote className="w-3 h-3" /> {isUrdu ? 'متعلقہ اقتباس' : 'Relevant Citation'}
                  </span>
                  {msg.citations.map((cite, i) => (
                    <div key={i} className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-lg p-2.5 text-[11px] text-[#3D2F24]">
                      <span className="font-semibold text-[#2A1E17] block mb-0.5">
                        {cite.chapter}
                      </span>
                      <p className="font-serif-body italic">
                        "{cite.excerpt}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <span className="text-[10px] text-[#8C7A6B] mt-1 px-1">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs font-sans-ui text-[#7A6B5D] bg-[#FBF7EE] p-3 rounded-xl border border-[#E2D4C3] w-fit">
            <Loader2 className="w-4 h-4 animate-spin text-[#8C5A2B]" />
            <span>{isUrdu ? 'مسودے کی تلاشی اور فکری جواب تیار کیا جا رہا ہے...' : 'Searching manuscript and compiling answer...'}</span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={e => {
          e.preventDefault();
          handleSend();
        }}
        className={`p-3 sm:p-4 bg-[#FBF7EE] border-t border-[#E2D4C3] flex items-center gap-2 sm:gap-3 ${isUrdu ? 'font-urdu' : ''}`}
      >
        <input
          type="text"
          value={inputQuestion}
          onChange={e => setInputQuestion(e.target.value)}
          placeholder={isUrdu ? `کتاب "${book.title}" کے متعلق کچھ بھی پوچھیں...` : `Ask anything about "${book.title}"...`}
          disabled={isLoading}
          className="min-h-[42px] flex-1 min-w-0 bg-[#F4EDE2] border border-[#D8C8B4] rounded-xl px-3.5 sm:px-4 py-2 text-xs font-sans-ui text-[#2A1E17] placeholder-[#9A8B7C] focus:outline-none focus:border-[#8C5A2B]"
        />
        <button
          type="submit"
          disabled={!inputQuestion.trim() || isLoading}
          className="min-h-[42px] px-3.5 sm:px-4 py-2 text-xs font-sans-ui font-medium text-[#FBF7EE] bg-[#2A1E17] hover:bg-[#3D2C22] disabled:opacity-50 rounded-xl transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
        >
          <Send className={`w-4 h-4 ${isUrdu ? 'rotate-180' : ''}`} />
          <span>{t.btnSend}</span>
        </button>
      </form>

    </div>
  );
};
