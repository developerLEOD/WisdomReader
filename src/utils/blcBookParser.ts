import * as pdfjsLib from 'pdfjs-dist';
import {
  ParsedBookForBlc,
  ParsedPage,
  DetectedChapter,
  BlcScheduleConfig,
  SessionPartitionPreview,
  BlcCadence,
  BlcLiteralPartSize,
  BlcLiteralBlock,
  BlcLiteralReadingPart,
  BlcDiscussionPrompt,
  BlcSessionPillar,
} from '../types/blc';
import { stripEditorialMarkers } from './editorialFormatting';

// Configure local bundled PDF.js worker so parsing works reliably offline and in sandboxes
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch (e) {
  console.warn('PDF.js local worker setup notice:', e);
}

export async function parseBookPages(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<ParsedBookForBlc> {
  const fileName = file.name;
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (ext === 'pdf') {
    return parsePdfWithPages(file, nameWithoutExt, onProgress);
  }

  // Fallback for TXT / MD / EPUB uploads
  const rawText = await file.text();
  const cleanText = (ext === 'epub' ? rawText.replace(/<[^>]+>/g, ' ') : rawText)
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleanText) {
    throw new Error('Could not extract readable text from the uploaded file.');
  }

  const words = cleanText.split(/\s+/).filter(Boolean);
  const wordsPerVirtualPage = 300;
  const pages: ParsedPage[] = [];
  for (let i = 0; i < words.length; i += wordsPerVirtualPage) {
    const slice = words.slice(i, i + wordsPerVirtualPage);
    pages.push({
      pageNumber: pages.length + 1,
      text: slice.join(' '),
      wordCount: slice.length,
    });
  }

  if (onProgress) {
    onProgress(pages.length, pages.length);
  }

  const chapters = detectChaptersFromPages(pages);

  return {
    title: formatTitleFromFilename(nameWithoutExt),
    author: '',
    fileName,
    totalPages: pages.length,
    totalWords: words.length,
    pages,
    chapters,
  };
}

async function parsePdfWithPages(
  file: File,
  fallbackName: string,
  onProgress?: (current: number, total: number) => void
): Promise<ParsedBookForBlc> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  let metadataTitle = '';
  let metadataAuthor = '';
  try {
    const meta = await pdf.getMetadata();
    const info = (meta?.info || {}) as Record<string, any>;
    if (typeof info.Title === 'string' && info.Title.trim().length > 1) {
      metadataTitle = info.Title.trim();
    }
    if (typeof info.Author === 'string' && info.Author.trim().length > 1) {
      metadataAuthor = info.Author.trim();
    }
  } catch {
    // Metadata optional
  }

  const pages: ParsedPage[] = [];
  let totalWords = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    let lastY: number | null = null;
    let lastEndX: number | null = null;
    const lines: string[] = [];
    let currentLine = '';

    for (const item of textContent.items as any[]) {
      const rawStr = typeof item.str === 'string' ? item.str.normalize('NFKC') : '';
      if (!rawStr) continue;

      const transformX = Array.isArray(item.transform) ? Number(item.transform[4]) : null;
      const transformY = Array.isArray(item.transform) ? Number(item.transform[5]) : null;
      const itemWidth = typeof item.width === 'number' ? item.width : 0;
      const itemHeight =
        typeof item.height === 'number' && item.height > 0
          ? item.height
          : Array.isArray(item.transform)
          ? Math.abs(Number(item.transform[0])) || 10
          : 10;

      const lineBreak =
        item.hasEOL ||
        (lastY !== null && transformY !== null && Math.abs(transformY - lastY) > 4);

      if (lineBreak && currentLine.trim()) {
        lines.push(cleanTranscriptionLine(currentLine));
        currentLine = rawStr;
      } else if (!currentLine) {
        currentLine = rawStr;
      } else {
        const endsWithSpace = /\s$/.test(currentLine);
        const startsWithSpace = /^\s/.test(rawStr);
        let needsSpace = false;

        if (!endsWithSpace && !startsWithSpace) {
          if (lastEndX !== null && transformX !== null) {
            const gap = transformX - lastEndX;
            // Only insert a space when the horizontal glyph gap exceeds typical kerning
            needsSpace = gap > itemHeight * 0.16 || gap < -itemHeight * 0.5;
          } else {
            needsSpace = true;
          }
        }
        currentLine += (needsSpace ? ' ' : '') + rawStr;
      }

      if (transformY !== null) {
        lastY = transformY;
      }
      if (transformX !== null) {
        lastEndX = transformX + itemWidth;
      }
    }
    if (currentLine.trim()) {
      lines.push(cleanTranscriptionLine(currentLine));
    }

    const pageText = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const wordCount = pageText ? pageText.split(/\s+/).filter(Boolean).length : 0;
    totalWords += wordCount;

    pages.push({
      pageNumber: pageNum,
      text: pageText,
      wordCount,
    });

    if (onProgress && (pageNum % 5 === 0 || pageNum === numPages)) {
      onProgress(pageNum, numPages);
    }
  }

  if (totalWords < 30) {
    throw new Error(
      'No readable text was found in this PDF (it appears to be scanned images). Please upload a text-based PDF or TXT/MD file.'
    );
  }

  // Try extracting embedded PDF bookmarks/outline first
  let chapters = await extractChaptersFromOutline(pdf, pages);
  if (chapters.length <= 1) {
    chapters = detectChaptersFromPages(pages);
  }

  return {
    title: metadataTitle || formatTitleFromFilename(fallbackName),
    author: metadataAuthor,
    fileName: file.name,
    totalPages: numPages,
    totalWords,
    pages,
    chapters,
  };
}

async function extractChaptersFromOutline(
  pdf: pdfjsLib.PDFDocumentProxy,
  pages: ParsedPage[]
): Promise<DetectedChapter[]> {
  try {
    const outline = await pdf.getOutline();
    if (!outline || outline.length === 0) return [];

    const anchors: { title: string; startPage: number }[] = [];

    for (const item of outline) {
      if (!item.title || !item.dest) continue;
      let destArray: any = item.dest;
      if (typeof item.dest === 'string') {
        destArray = await pdf.getDestination(item.dest);
      }
      if (Array.isArray(destArray) && destArray[0]) {
        try {
          const pageIndex = await pdf.getPageIndex(destArray[0]);
          const pageNumber = pageIndex + 1;
          if (pageNumber >= 1 && pageNumber <= pages.length) {
            anchors.push({
              title: item.title.trim().replace(/\s+/g, ' '),
              startPage: pageNumber,
            });
          }
        } catch {
          // Ignore unresolvable outline destination
        }
      }
    }

    if (anchors.length < 2) return [];

    // Sort and deduplicate by startPage
    anchors.sort((a, b) => a.startPage - b.startPage);
    const uniqueAnchors: { title: string; startPage: number }[] = [];
    for (const a of anchors) {
      const existing = uniqueAnchors.find(u => u.startPage === a.startPage);
      if (!existing) {
        uniqueAnchors.push(a);
      }
    }

    return buildChaptersFromAnchors(uniqueAnchors, pages);
  } catch {
    return [];
  }
}

function detectChaptersFromPages(pages: ParsedPage[]): DetectedChapter[] {
  const headingPatterns = [
    /^(chapter|chap\.?)\s+([0-9]+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b[:.\-—\s]*(.*)$/i,
    /^(part|book|section|discourse|bab|fasl|maqala)\s+([0-9]+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)\b[:.\-—\s]*(.*)$/i,
    /^(preface|introduction|prologue|epilogue|conclusion|foreword)\b[:.\-—\s]*(.*)$/i,
    /^(باب|فصل|مقدمہ|خاتمہ)\s*(.*)$/i,
  ];

  const anchors: { title: string; startPage: number }[] = [];

  for (const page of pages) {
    if (!page.text) continue;
    const topLines = page.text
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .slice(0, 6);

    for (const line of topLines) {
      if (line.length > 90) continue;
      let matched = false;
      for (const regex of headingPatterns) {
        if (regex.test(line)) {
          matched = true;
          break;
        }
      }
      if (matched) {
        const alreadyNear = anchors.some(a => Math.abs(a.startPage - page.pageNumber) <= 1);
        if (!alreadyNear) {
          anchors.push({ title: line, startPage: page.pageNumber });
        }
        break;
      }
    }
  }

  if (anchors.length >= 2) {
    return buildChaptersFromAnchors(anchors, pages);
  }

  // Fallback: evenly divided structural sections (~20 pages or ~5 sections) so partitioning remains topic-aware
  const sectionCount = Math.min(pages.length, Math.max(4, Math.ceil(pages.length / 20)));
  const pagesPerSection = Math.ceil(pages.length / sectionCount);
  const fallbackChapters: DetectedChapter[] = [];

  for (let i = 0; i < sectionCount; i++) {
    const startPage = i * pagesPerSection + 1;
    const endPage = Math.min(pages.length, (i + 1) * pagesPerSection);
    if (startPage > pages.length) break;
    const wc = pages
      .slice(startPage - 1, endPage)
      .reduce((acc, p) => acc + p.wordCount, 0);

    fallbackChapters.push({
      title: `Section ${i + 1} (Pages ${startPage}–${endPage})`,
      startPage,
      endPage,
      wordCount: wc,
    });
  }

  return fallbackChapters;
}

function buildChaptersFromAnchors(
  anchors: { title: string; startPage: number }[],
  pages: ParsedPage[]
): DetectedChapter[] {
  const result: DetectedChapter[] = [];

  // If the first anchor starts after page 1, group opening pages as Front Matter / Opening
  if (anchors[0].startPage > 1) {
    const endPage = anchors[0].startPage - 1;
    const wc = pages.slice(0, endPage).reduce((acc, p) => acc + p.wordCount, 0);
    if (wc > 40) {
      result.push({
        title: 'Opening & Front Matter',
        startPage: 1,
        endPage,
        wordCount: wc,
      });
    } else {
      anchors[0].startPage = 1;
    }
  }

  for (let i = 0; i < anchors.length; i++) {
    const current = anchors[i];
    const next = anchors[i + 1];
    const startPage = current.startPage;
    const endPage = next ? Math.max(startPage, next.startPage - 1) : pages.length;
    const wc = pages
      .slice(startPage - 1, endPage)
      .reduce((acc, p) => acc + p.wordCount, 0);

    result.push({
      title: current.title,
      startPage,
      endPage,
      wordCount: wc,
    });
  }

  return result;
}

export function getEffectiveSessionsPerWeek(
  cadence: BlcCadence,
  customSessionsPerWeek: number
): number {
  switch (cadence) {
    case 'weekly':
      return 1;
    case 'twice_weekly':
      return 2;
    case 'biweekly':
      return 0.5;
    case 'custom':
    default:
      return Math.max(0.25, Math.min(7, Number(customSessionsPerWeek) || 1));
  }
}

export interface PacingMetrics {
  totalReadingMinutes: number;
  recommendedSessions: number;
  estimatedWeeks: number;
  estimatedMinutesPerSession: number;
  avgPagesPerSession: number;
  avgWordsPerSession: number;
}

export function calculatePacingMetrics(
  totalWords: number,
  totalPages: number,
  config: BlcScheduleConfig,
  overrideSessions?: number
): PacingMetrics {
  const wpm = Math.max(80, config.readingSpeedWpm || 200);
  const totalReadingMinutes = Math.max(5, Math.ceil(totalWords / wpm));
  const sessionsPerWeek = getEffectiveSessionsPerWeek(config.cadence, config.sessionsPerWeek);

  let recommendedSessions: number;
  if (overrideSessions && overrideSessions >= 1) {
    recommendedSessions = Math.min(totalPages, Math.max(1, Math.round(overrideSessions)));
  } else if (config.pacingMode === 'by_duration') {
    const weeks = Math.max(1, config.durationWeeks || 8);
    recommendedSessions = Math.min(totalPages, Math.max(1, Math.round(weeks * sessionsPerWeek)));
  } else {
    const targetMins = Math.max(5, config.targetReadingMinutes || 25);
    recommendedSessions = Math.min(totalPages, Math.max(1, Math.round(totalReadingMinutes / targetMins)));
  }

  const estimatedWeeks = Math.max(1, Math.ceil(recommendedSessions / sessionsPerWeek));
  const estimatedMinutesPerSession = Math.max(1, Math.round(totalReadingMinutes / recommendedSessions));
  const avgPagesPerSession = Math.max(1, Math.round(totalPages / recommendedSessions));
  const avgWordsPerSession = Math.max(1, Math.round(totalWords / recommendedSessions));

  return {
    totalReadingMinutes,
    recommendedSessions,
    estimatedWeeks,
    estimatedMinutesPerSession,
    avgPagesPerSession,
    avgWordsPerSession,
  };
}

export function partitionBookIntoSessions(
  book: ParsedBookForBlc,
  config: BlcScheduleConfig,
  overrideSessions?: number
): SessionPartitionPreview[] {
  const metrics = calculatePacingMetrics(book.totalWords, book.totalPages, config, overrideSessions);
  const targetSessions = Math.min(book.totalPages, Math.max(1, metrics.recommendedSessions));
  const idealWords = book.totalWords / targetSessions;
  const wpm = Math.max(80, config.readingSpeedWpm || 200);

  // Step 1: Normalize atomic units from chapters (splitting overly large chapters by page)
  interface TopicBlock {
    title: string;
    startPage: number;
    endPage: number;
    wordCount: number;
  }

  const blocks: TopicBlock[] = [];
  for (const ch of book.chapters) {
    const pageSpan = ch.endPage - ch.startPage + 1;
    if (ch.wordCount > idealWords * 1.65 && pageSpan >= 2) {
      const subParts = Math.min(pageSpan, Math.max(2, Math.round(ch.wordCount / idealWords)));
      const targetPartWords = ch.wordCount / subParts;
      let curStart = ch.startPage;
      let curWords = 0;
      let partIdx = 1;

      for (let p = ch.startPage; p <= ch.endPage; p++) {
        const pageObj = book.pages[p - 1];
        curWords += pageObj?.wordCount || 0;
        const remainingPages = ch.endPage - p;
        const remainingParts = subParts - partIdx;

        if (
          remainingParts > 0 &&
          curWords >= targetPartWords * 0.85 &&
          remainingPages >= remainingParts
        ) {
          blocks.push({
            title: `${ch.title} (Part ${partIdx}/${subParts})`,
            startPage: curStart,
            endPage: p,
            wordCount: curWords,
          });
          curStart = p + 1;
          curWords = 0;
          partIdx++;
        }
      }
      if (curStart <= ch.endPage) {
        blocks.push({
          title: `${ch.title} (Part ${partIdx}/${subParts})`,
          startPage: curStart,
          endPage: ch.endPage,
          wordCount: curWords,
        });
      }
    } else {
      blocks.push({
        title: ch.title,
        startPage: ch.startPage,
        endPage: ch.endPage,
        wordCount: ch.wordCount,
      });
    }
  }

  // Step 2: Group blocks into `targetSessions` cleanly
  const partitions: SessionPartitionPreview[] = [];

  if (blocks.length >= targetSessions) {
    let blockIdx = 0;
    for (let s = 1; s <= targetSessions; s++) {
      const isLast = s === targetSessions;
      const sessionsLeft = targetSessions - s;
      const sessionBlocks: TopicBlock[] = [];
      let accumWords = 0;

      while (blockIdx < blocks.length) {
        const nextBlock = blocks[blockIdx];
        const blocksRemainingAfterThis = blocks.length - (blockIdx + 1);

        if (!isLast && blocksRemainingAfterThis < sessionsLeft) {
          break;
        }

        if (
          !isLast &&
          sessionBlocks.length > 0 &&
          accumWords + nextBlock.wordCount * 0.5 > idealWords &&
          blocksRemainingAfterThis >= sessionsLeft
        ) {
          break;
        }

        sessionBlocks.push(nextBlock);
        accumWords += nextBlock.wordCount;
        blockIdx++;

        if (!isLast && accumWords >= idealWords * 0.92 && blocksRemainingAfterThis >= sessionsLeft) {
          break;
        }
      }

      if (sessionBlocks.length === 0 && blockIdx < blocks.length) {
        sessionBlocks.push(blocks[blockIdx]);
        accumWords += blocks[blockIdx].wordCount;
        blockIdx++;
      }

      if (sessionBlocks.length > 0) {
        const startPage = sessionBlocks[0].startPage;
        const endPage = sessionBlocks[sessionBlocks.length - 1].endPage;
        const wc = book.pages
          .slice(startPage - 1, endPage)
          .reduce((acc, p) => acc + p.wordCount, 0);

        partitions.push({
          sessionNumber: partitions.length + 1,
          startPage,
          endPage,
          chaptersCovered: Array.from(new Set(sessionBlocks.map(b => b.title))),
          wordCount: wc,
          estimatedReadingMinutes: Math.max(1, Math.round(wc / wpm)),
          scheduledDate: computeSessionDate(config, partitions.length),
        });
      }
    }
  } else {
    // Fewer blocks than target sessions: allocate cleanly across pages
    let curPage = 1;
    for (let s = 1; s <= targetSessions && curPage <= book.totalPages; s++) {
      const isLast = s === targetSessions;
      const sessionsLeft = targetSessions - s;
      const startPage = curPage;
      let accumWords = 0;

      while (curPage <= book.totalPages) {
        const pageObj = book.pages[curPage - 1];
        accumWords += pageObj?.wordCount || 0;
        const pagesLeftAfterThis = book.totalPages - curPage;

        curPage++;
        if (!isLast && accumWords >= idealWords * 0.9 && pagesLeftAfterThis >= sessionsLeft) {
          break;
        }
        if (!isLast && pagesLeftAfterThis <= sessionsLeft) {
          break;
        }
      }

      const endPage = isLast ? book.totalPages : Math.min(book.totalPages, curPage - 1);
      const wc = book.pages
        .slice(startPage - 1, endPage)
        .reduce((acc, p) => acc + p.wordCount, 0);
      const overlappingChapters = book.chapters
        .filter(c => c.startPage <= endPage && c.endPage >= startPage)
        .map(c => c.title);

      partitions.push({
        sessionNumber: partitions.length + 1,
        startPage,
        endPage,
        chaptersCovered: overlappingChapters.length > 0 ? overlappingChapters : [`Pages ${startPage}–${endPage}`],
        wordCount: wc,
        estimatedReadingMinutes: Math.max(1, Math.round(wc / wpm)),
        scheduledDate: computeSessionDate(config, partitions.length),
      });
    }
  }

  return partitions;
}

function computeSessionDate(config: BlcScheduleConfig, zeroBasedIndex: number): string | undefined {
  if (!config.startDate) return undefined;
  const parsed = new Date(config.startDate + 'T00:00:00');
  if (isNaN(parsed.getTime())) return undefined;

  const sessionsPerWeek = getEffectiveSessionsPerWeek(config.cadence, config.sessionsPerWeek);
  const daysStep = 7 / sessionsPerWeek;
  const offsetDays = Math.round(zeroBasedIndex * daysStep);
  parsed.setDate(parsed.getDate() + offsetDays);
  return parsed.toISOString().split('T')[0];
}

export function extractSessionExcerpt(
  book: ParsedBookForBlc,
  startPage: number,
  endPage: number,
  maxChars: number = 14000
): string {
  const slice = book.pages.slice(Math.max(0, startPage - 1), Math.min(book.pages.length, endPage));
  const fullAnnotated = slice
    .map(p => `[Page ${p.pageNumber}]\n${p.text}`)
    .join('\n\n');

  if (fullAnnotated.length <= maxChars) {
    return fullAnnotated;
  }

  // Sample evenly from start, middle, and end pages of this session's reading assignment
  const segmentBudget = Math.floor(maxChars / 3);
  const head = fullAnnotated.slice(0, segmentBudget);
  const midStart = Math.max(segmentBudget, Math.floor((fullAnnotated.length - segmentBudget) / 2));
  const mid = fullAnnotated.slice(midStart, midStart + segmentBudget);
  const tail = fullAnnotated.slice(fullAnnotated.length - segmentBudget);

  return `${head}\n\n[... Middle Excerpt ...]\n\n${mid}\n\n[... Closing Excerpt ...]\n\n${tail}`;
}

function cleanTranscriptionLine(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/\u200B|\uFEFF/g, '') // strip zero-width garbage characters
    .replace(/\s+([,.;:!?،؛؟۔])/g, '$1') // remove stray spaces before Latin/Urdu/Arabic punctuation
    .replace(/([,;!?،؛؟۔])([^\s"'”’\)\]\d])/g, '$1 $2') // ensure space after punctuation
    .replace(/\.([A-Z])/g, '. $1') // space after period before capitalized sentence start
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function formatTitleFromFilename(filename: string): string {
  return filename
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export type PrimaryBookLanguage = 'English' | 'Urdu' | 'Arabic';

export function detectPrimaryBookLanguage(pages: ParsedPage[]): PrimaryBookLanguage {
  if (!pages || pages.length === 0) return 'English';

  // Skip brief front-matter (first ~5%) on longer books so opening prayers/prefaces don't skew main content language
  const startIdx = pages.length >= 16 ? Math.floor(pages.length * 0.05) : 0;
  const bodyPages = pages.slice(startIdx);
  const step = Math.max(1, Math.floor(bodyPages.length / 24));
  let sampleText = '';
  for (let i = 0; i < bodyPages.length; i += step) {
    if (bodyPages[i]?.text) {
      sampleText += ' ' + bodyPages[i].text.slice(0, 1200);
    }
  }

  const latinCount = (sampleText.match(/[A-Za-z]/g) || []).length;
  const rtlCount = (sampleText.match(/[\u0600-\u06FF]/g) || []).length;

  if (latinCount >= rtlCount * 1.1) {
    return 'English';
  }

  // Distinct Urdu letters (ٹ ڈ ڑ ں ھ ے ۔ گ چ پ ژ ک ی) + common Urdu particles
  const urduLetterCount = (
    sampleText.match(/[\u0679\u067E\u0686\u0688\u0691\u0698\u06A9\u06AF\u06BA\u06BE\u06C1-\u06C3\u06CC\u06D2\u06D3\u06D4]/g) ||
    []
  ).length;
  const urduWordCount = (
    sampleText.match(/(?:^|\s)(?:اور|کے|کی|کا|میں|ہے|ہیں|نہیں|کو|سے|پر|اس|یہ|تو|جو|بھی)(?=\s|$)/g) ||
    []
  ).length;

  if (urduLetterCount >= 4 || urduWordCount >= 3) {
    return 'Urdu';
  }

  if (rtlCount > latinCount) {
    return 'Arabic';
  }

  return 'English';
}

export function getLiteralPartTargetWords(size: BlcLiteralPartSize = 'standard'): number {
  switch (size) {
    case 'compact':
      return 145;
    case 'extended':
      return 340;
    case 'standard':
    default:
      return 230;
  }
}

function isStandalonePageNoise(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^[-–—\s]*[\d\u0660-\u0669\u06F0-\u06F9]{1,4}[-–—\s]*$/.test(trimmed)) return true;
  if (/^(page|p\.?|pp\.?|صفحہ|ص)\s*[\d\u0660-\u0669\u06F0-\u06F9]{1,4}(\s*of\s*\d{1,4})?$/i.test(trimmed)) {
    return true;
  }
  return false;
}

function stripRunningHeadersAndFooters(sessionPages: ParsedPage[]): Map<number, string[]> {
  const pageLinesMap = new Map<number, string[]>();
  const topLineFreq = new Map<string, number>();
  const bottomLineFreq = new Map<string, number>();

  for (const p of sessionPages) {
    const lines = (p.text || '')
      .split('\n')
      .map(l => l.trim());
    pageLinesMap.set(p.pageNumber, lines);

    const nonEmpty = lines.filter(Boolean);
    if (nonEmpty.length >= 2) {
      const topNorm = nonEmpty[0].replace(/\d+/g, '#').toLowerCase();
      const botNorm = nonEmpty[nonEmpty.length - 1].replace(/\d+/g, '#').toLowerCase();
      if (nonEmpty[0].length <= 85) {
        topLineFreq.set(topNorm, (topLineFreq.get(topNorm) || 0) + 1);
      }
      if (nonEmpty[nonEmpty.length - 1].length <= 85) {
        bottomLineFreq.set(botNorm, (bottomLineFreq.get(botNorm) || 0) + 1);
      }
    }
  }

  const repeatThreshold = Math.max(3, Math.ceil(sessionPages.length * 0.4));

  for (const [pageNumber, lines] of pageLinesMap.entries()) {
    const cleaned = [...lines];
    // Strip leading page noise or repeated running header
    while (cleaned.length > 0 && !cleaned[0]) cleaned.shift();
    if (cleaned.length > 0) {
      const topNorm = cleaned[0].replace(/\d+/g, '#').toLowerCase();
      if (isStandalonePageNoise(cleaned[0]) || (topLineFreq.get(topNorm) || 0) >= repeatThreshold) {
        cleaned.shift();
      }
    }
    // Strip trailing page noise or repeated running footer
    while (cleaned.length > 0 && !cleaned[cleaned.length - 1]) cleaned.pop();
    if (cleaned.length > 0) {
      const botNorm = cleaned[cleaned.length - 1].replace(/\d+/g, '#').toLowerCase();
      if (
        isStandalonePageNoise(cleaned[cleaned.length - 1]) ||
        (bottomLineFreq.get(botNorm) || 0) >= repeatThreshold
      ) {
        cleaned.pop();
      }
    }
    pageLinesMap.set(pageNumber, cleaned);
  }

  return pageLinesMap;
}

function isMajorHeadingLine(line: string, atBlockBoundary: boolean = false): boolean {
  if (!line || line.length > 78 || line.length < 3) return false;
  if (/^(chapter|chap\.?|part|book|section|discourse|bab|fasl|preface|introduction|prologue|epilogue|conclusion|foreword|باب|فصل|مقدمہ|تمہید|خاتمہ|الباب|الفصل|المقدمة|عنوان)\b/i.test(line)) {
    return true;
  }
  if (/^(\d+|[IVXLCDM]+)[\.\)]\s+[A-Z\u0600-\u06FF]/.test(line) && !/[.?!,;۔؟]$/.test(line) && line.split(/\s+/).length <= 10) {
    return true;
  }
  if (
    line === line.toUpperCase() &&
    /[A-Z]/.test(line) &&
    line.split(/\s+/).length <= 10 &&
    !/[.,;!?]$/.test(line)
  ) {
    return true;
  }
  // Standalone short Urdu/Arabic/Title-Case line at a clean paragraph boundary without terminal punctuation
  if (atBlockBoundary) {
    const words = line.split(/\s+/).filter(Boolean);
    const endsWithSentencePunct = /[.?!,;:\u061F\u06D4\u060C\u061B"'”’»)]$/.test(line);
    const hasUrduOrArabic = /[\u0600-\u06FF]/.test(line);
    if (!endsWithSentencePunct && hasUrduOrArabic && words.length >= 2 && words.length <= 7 && line.length <= 48) {
      return true;
    }
  }
  return false;
}

function isSubheadingLine(line: string): boolean {
  if (!line || line.length > 88 || line.length < 4) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length > 11) return false;
  if ((line.endsWith(':') || line.endsWith('：')) && words.length <= 9) return true;
  if (/^\d+\.\d+\s+/.test(line) && !/[.?!۔؟]$/.test(line)) return true;
  // Short standalone Title-Case English or short RTL topic header without terminal sentence punctuation
  const endsWithSentencePunct = /[.?!,;\u061F\u06D4\u060C\u061B"'”’»)]$/.test(line);
  if (!endsWithSentencePunct && words.length >= 2 && words.length <= 7) {
    const hasRtl = /[\u0600-\u06FF]/.test(line);
    if (hasRtl && line.length <= 54) return true;
    const capitalizedWords = words.filter(w => /^[A-Z][a-zA-Z'’-]*$/.test(w));
    if (!hasRtl && capitalizedWords.length >= Math.max(2, words.length - 1)) return true;
  }
  return false;
}

function matchListItemLine(line: string): string | null {
  const bulletMatch = line.match(
    /^(?:[•\-\*▪▸◦]|\d+[\.\)]|\([a-zA-Z0-9\u0660-\u0669\u06F0-\u06F9]+\)|[a-zA-Z\u0621-\u064A]\)|[\u0660-\u0669\u06F0-\u06F9]+[\.\-\)])\s+(.+)$/
  );
  return bulletMatch ? bulletMatch[1].trim() : null;
}

function isQuoteParagraph(text: string): boolean {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  if (words < 8) return false;
  return (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('“') && trimmed.endsWith('”')) ||
    (trimmed.startsWith('«') && trimmed.endsWith('»')) ||
    (trimmed.startsWith('﴿') && trimmed.endsWith('﴾'))
  );
}

function splitOversizedParagraph(text: string, maxWords: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return [text];

  const sentences =
    text.match(/[^.?!\u061F\u06D4]+[.?!\u061F\u06D4]+["'”’\)]*\s*|[^.?!\u061F\u06D4]+$/g) || [
      text,
    ];
  const chunks: string[] = [];
  let current = '';
  let currentWords = 0;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const sWords = trimmed.split(/\s+/).filter(Boolean).length;

    if (currentWords > 0 && currentWords + sWords > maxWords) {
      chunks.push(current.trim());
      current = trimmed;
      currentWords = sWords;
    } else {
      current = current ? `${current} ${trimmed}` : trimmed;
      currentWords += sWords;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

function reconstructContextualBlocksFromLines(
  lines: string[],
  pageNumber: number,
  maxBlockWords: number
): BlcLiteralBlock[] {
  const blocks: BlcLiteralBlock[] = [];
  let proseBuffer = '';
  let listItems: string[] = [];

  const flushProse = () => {
    let cleaned = proseBuffer.replace(/\s+/g, ' ').trim();
    proseBuffer = '';
    if (!cleaned) return;

    const colonLeadMatch = cleaned.match(/^([^:\n]{4,56}):\s+(.{35,})$/);
    if (colonLeadMatch) {
      const lead = colonLeadMatch[1].trim();
      const rest = colonLeadMatch[2].trim();
      const leadWords = lead.split(/\s+/).filter(Boolean);
      if (leadWords.length >= 2 && leadWords.length <= 7 && !/[.?!۔؟]/.test(lead)) {
        blocks.push({
          type: 'subheading',
          pageNumber,
          text: lead,
        });
        cleaned = rest;
      }
    }

    const pieces = splitOversizedParagraph(cleaned, maxBlockWords);
    for (const piece of pieces) {
      blocks.push({
        type: isQuoteParagraph(piece) ? 'quote' : 'paragraph',
        pageNumber,
        text: piece,
      });
    }
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({
      type: 'list',
      pageNumber,
      text: listItems.join('\n'),
      items: [...listItems],
    });
    listItems = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      flushProse();
      flushList();
      continue;
    }

    const atBlockBoundary = !proseBuffer && listItems.length === 0;
    if (isMajorHeadingLine(line, atBlockBoundary)) {
      flushProse();
      flushList();
      blocks.push({ type: 'heading', pageNumber, text: line });
      continue;
    }

    if (isSubheadingLine(line) && !proseBuffer) {
      flushList();
      blocks.push({ type: 'subheading', pageNumber, text: line });
      continue;
    }

    const listContent = matchListItemLine(line);
    if (listContent && !proseBuffer) {
      listItems.push(listContent);
      continue;
    }

    // If a wrapped continuation line follows a list item (doesn't start a new item), append cleanly to last list item if short prose break
    if (listItems.length > 0 && !proseBuffer && !/^[A-Z]/.test(line)) {
      listItems[listItems.length - 1] = `${listItems[listItems.length - 1]} ${line}`;
      continue;
    } else if (listItems.length > 0) {
      flushList();
    }

    if (!proseBuffer) {
      proseBuffer = line;
    } else if (proseBuffer.endsWith('-') && /^[a-zA-Z]/.test(line)) {
      proseBuffer = proseBuffer.slice(0, -1) + line;
    } else {
      proseBuffer = `${proseBuffer} ${line}`;
    }

    const wordCount = proseBuffer.split(/\s+/).filter(Boolean).length;
    const endsSentence = /[.?!]["'”’\)]?$|[\u061F\u06D4][»"”\)]?$/.test(line);
    if ((endsSentence && wordCount >= 45) || wordCount >= 110) {
      flushProse();
    }
  }

  flushProse();
  flushList();
  return blocks.map(b => ({
    ...b,
    text: cleanTranscriptionLine(b.text),
    items: b.items?.map(cleanTranscriptionLine),
  }));
}

function countBlockWords(block: BlcLiteralBlock): number {
  if (block.type === 'list' && block.items && block.items.length > 0) {
    return stripEditorialMarkers(block.items.join(' ')).split(/\s+/).filter(Boolean).length;
  }
  return stripEditorialMarkers(block.text).split(/\s+/).filter(Boolean).length;
}

function buildPartFromBlocks(
  blocks: BlcLiteralBlock[],
  wpm: number,
  options: {
    contextualTitle?: string;
    chapterName?: string;
    isSessionCoverPage?: boolean;
    isChapterTitlePage?: boolean;
    sessionOverview?: string;
    sessionPillars?: BlcSessionPillar[];
    isAiOrganized?: boolean;
  }
): Omit<BlcLiteralReadingPart, 'partNumber' | 'totalParts'> {
  const startPage = Math.min(...blocks.map(b => b.pageNumber));
  const endPage = Math.max(...blocks.map(b => b.pageNumber));
  const paragraphs = blocks.map(b => ({
    pageNumber: b.pageNumber,
    text:
      b.type === 'list' && b.items
        ? stripEditorialMarkers(
            `${b.text ? `${b.text}\n` : ''}${b.items.map(it => `• ${it}`).join('\n')}`
          )
        : stripEditorialMarkers(b.text),
  }));
  const plainText = paragraphs.map(p => p.text).join('\n\n');
  const wordCount = blocks.reduce((acc, b) => acc + countBlockWords(b), 0);

  return {
    contextualTitle: options.contextualTitle,
    chapterName: options.chapterName,
    isSessionCoverPage: options.isSessionCoverPage,
    isChapterTitlePage: options.isChapterTitlePage,
    sessionOverview: options.sessionOverview,
    sessionPillars: options.sessionPillars,
    startPage,
    endPage,
    wordCount,
    estimatedReadingMinutes: Math.max(1, Math.round(wordCount / Math.max(80, wpm))),
    paragraphs,
    blocks,
    plainText,
    isAiOrganized: options.isAiOrganized,
  };
}

export interface SessionCoverMeta {
  sessionNumber: number;
  sessionTitle: string;
  bookTitle: string;
  author?: string;
  startPage: number;
  endPage: number;
  estimatedReadingMinutes: number;
  chaptersCovered?: string[];
  sessionOverview?: string;
  sessionPillars?: BlcSessionPillar[];
}

/**
 * Extracts unique, ordered chapter/section names directly from the current (post-organization) folios.
 */
export function extractAdaptiveChaptersFromParts(parts: BlcLiteralReadingPart[]): string[] {
  if (!parts || parts.length === 0) return [];
  const seen = new Set<string>();
  const headings: string[] = [];

  for (const part of parts) {
    if (part.isSessionCoverPage) continue;
    for (const block of part.blocks || []) {
      if (block.type === 'heading') {
        const clean = block.text.replace(/:$/, '').trim();
        if (clean && !seen.has(clean.toLowerCase())) {
          seen.add(clean.toLowerCase());
          headings.push(clean);
        }
      }
    }
  }

  if (headings.length > 0) {
    return headings;
  }

  // Fallback: collect distinct organized section/contextual titles when no explicit 'heading' blocks exist
  const sectionTitles: string[] = [];
  for (const part of parts) {
    if (part.isSessionCoverPage) continue;
    const candidate = (part.chapterName || part.contextualTitle || '').replace(/:$/, '').trim();
    if (candidate && !seen.has(candidate.toLowerCase())) {
      seen.add(candidate.toLowerCase());
      sectionTitles.push(candidate);
      if (sectionTitles.length >= 4) break;
    }
  }
  return sectionTitles;
}

/**
 * Ensures every session starts with a dedicated 1st-page Session Cover Graphic,
 * every major chapter heading ('heading' block) occupies its own dedicated full Chapter Title Folio,
 * and every folio carries an adaptive chapterName aligned to the latest organized headings.
 */
function truncateToSentenceLimit(text: string, maxChars: number = 175): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= maxChars) return clean;
  const firstSentenceMatch = clean.match(/^.+?[.!?\u06D4\u061F](?=\s|$)/);
  if (firstSentenceMatch && firstSentenceMatch[0].length <= maxChars + 25) {
    return firstSentenceMatch[0].trim();
  }
  const clipped = clean.slice(0, maxChars);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > maxChars * 0.55 ? clipped.slice(0, lastSpace) : clipped).trim()}…`;
}

export function expandPartsWithDedicatedChapterPages(
  rawParts: BlcLiteralReadingPart[],
  readingSpeedWpm: number = 200,
  coverMetaOrTitle?: string | SessionCoverMeta
): BlcLiteralReadingPart[] {
  if (!rawParts || rawParts.length === 0) return [];

  const coverMeta: SessionCoverMeta | undefined =
    typeof coverMetaOrTitle === 'object' && coverMetaOrTitle !== null
      ? coverMetaOrTitle
      : undefined;

  const priorCover = rawParts.find(p => p.isSessionCoverPage);
  const sourceParts = rawParts.filter(p => !p.isSessionCoverPage);
  const expanded: Array<Omit<BlcLiteralReadingPart, 'partNumber' | 'totalParts'>> = [];
  let activeChapterName = '';

  for (const part of sourceParts) {
    const blocks: BlcLiteralBlock[] =
      part.blocks && part.blocks.length > 0
        ? part.blocks
        : part.paragraphs.map(p => ({
            type: 'paragraph' as const,
            pageNumber: p.pageNumber,
            text: p.text,
          }));

    if (blocks.length === 0) continue;

    let buffer: BlcLiteralBlock[] = [];
    let i = 0;

    while (i < blocks.length) {
      const b = blocks[i];
      if (b.type === 'heading') {
        if (buffer.length > 0) {
          const bufferSub = buffer.find(x => x.type === 'subheading')?.text.replace(/:$/, '').trim();
          const adaptiveTitle =
            (part.contextualTitle && part.contextualTitle.trim()) || bufferSub || activeChapterName || undefined;
          expanded.push(
            buildPartFromBlocks(buffer, readingSpeedWpm, {
              contextualTitle: adaptiveTitle,
              chapterName: activeChapterName || adaptiveTitle,
              isChapterTitlePage: false,
              isAiOrganized: part.isAiOrganized,
            })
          );
          buffer = [];
        }

        activeChapterName = b.text.replace(/:$/, '').trim();
        const titleBlocks: BlcLiteralBlock[] = [b];
        if (i + 1 < blocks.length && blocks[i + 1].type === 'subheading') {
          titleBlocks.push(blocks[i + 1]);
          i++;
        }

        expanded.push(
          buildPartFromBlocks(titleBlocks, readingSpeedWpm, {
            contextualTitle: activeChapterName,
            chapterName: activeChapterName,
            isChapterTitlePage: true,
            isAiOrganized: part.isAiOrganized,
          })
        );
      } else {
        buffer.push(b);
      }
      i++;
    }

    if (buffer.length > 0) {
      const bufferSub = buffer.find(x => x.type === 'subheading')?.text.replace(/:$/, '').trim();
      const rawCtx = (part.contextualTitle || '').trim();
      const adaptiveTitle =
        rawCtx && (!activeChapterName || rawCtx !== activeChapterName || part.isAiOrganized)
          ? rawCtx
          : bufferSub || activeChapterName || rawCtx || undefined;

      expanded.push(
        buildPartFromBlocks(buffer, readingSpeedWpm, {
          contextualTitle: adaptiveTitle,
          chapterName: activeChapterName || adaptiveTitle,
          isChapterTitlePage: false,
          isAiOrganized: part.isAiOrganized,
        })
      );
    }
  }

  // Inject Folio I as a Whole-Session Summary Cover Slide summing up ALL topics & chapters of the session
  if (coverMeta && expanded.length > 0) {
    const discoveredHeadings = expanded
      .filter(p => p.isChapterTitlePage && p.chapterName)
      .map(p => p.chapterName as string);
    const adaptiveCoverChapters =
      discoveredHeadings.length > 0
        ? Array.from(new Set(discoveredHeadings))
        : coverMeta.chaptersCovered && coverMeta.chaptersCovered.length > 0
        ? coverMeta.chaptersCovered
        : [];

    // Build fallback section-by-section pillars spanning the ENTIRE session if sessionPillars were not supplied
    let wholeSessionPillars: BlcSessionPillar[] = [];
    if (coverMeta.sessionPillars && coverMeta.sessionPillars.length > 0) {
      wholeSessionPillars = coverMeta.sessionPillars
        .filter(p => p.title && p.title.trim())
        .slice(0, 4)
        .map(p => ({
          title: p.title.trim(),
          summary: truncateToSentenceLimit(p.summary || '', 160),
        }));
    } else if (priorCover?.sessionPillars && priorCover.sessionPillars.length > 0) {
      wholeSessionPillars = priorCover.sessionPillars.slice(0, 4);
    }

    if (wholeSessionPillars.length === 0) {
      const seenTitles = new Set<string>();
      const candidateParts = expanded.filter(p => !p.isChapterTitlePage && p.blocks.length > 0);
      for (const p of candidateParts) {
        const title = (p.contextualTitle || p.chapterName || '').trim();
        const key = title.toLowerCase();
        if (!title || seenTitles.has(key)) continue;
        seenTitles.add(key);
        const firstProse =
          p.blocks.find(b => b.type === 'paragraph' || b.type === 'quote')?.text || '';
        wholeSessionPillars.push({
          title,
          summary: truncateToSentenceLimit(firstProse, 130),
        });
        if (wholeSessionPillars.length >= 4) break;
      }
      // If still under 2 pillars, include discovered chapter headings
      if (wholeSessionPillars.length < 2 && adaptiveCoverChapters.length > 0) {
        for (const ch of adaptiveCoverChapters) {
          const cleanCh = ch.trim();
          if (cleanCh && !seenTitles.has(cleanCh.toLowerCase())) {
            seenTitles.add(cleanCh.toLowerCase());
            wholeSessionPillars.push({ title: cleanCh, summary: '' });
            if (wholeSessionPillars.length >= 4) break;
          }
        }
      }
    }

    let wholeSessionOverview = (
      coverMeta.sessionOverview ||
      priorCover?.sessionOverview ||
      ''
    ).trim();

    if (!wholeSessionOverview && wholeSessionPillars.length > 0) {
      const pillarSnippets = wholeSessionPillars
        .map(p => p.summary || p.title)
        .filter(Boolean)
        .slice(0, 3);
      wholeSessionOverview = truncateToSentenceLimit(pillarSnippets.join(' '), 320);
    }

    const coverBlocks: BlcLiteralBlock[] = [
      {
        type: 'heading',
        pageNumber: coverMeta.startPage,
        text: coverMeta.sessionTitle,
      },
      ...(adaptiveCoverChapters.length > 0
        ? [
            {
              type: 'subheading' as const,
              pageNumber: coverMeta.startPage,
              text: adaptiveCoverChapters.slice(0, 4).join(' · '),
            },
          ]
        : []),
      ...(wholeSessionOverview
        ? [
            {
              type: 'paragraph' as const,
              pageNumber: coverMeta.startPage,
              text: wholeSessionOverview,
            },
          ]
        : []),
    ];

    const builtCover = buildPartFromBlocks(coverBlocks, readingSpeedWpm, {
      contextualTitle: coverMeta.sessionTitle,
      chapterName: adaptiveCoverChapters.join(' · ') || coverMeta.sessionTitle,
      isSessionCoverPage: true,
      isChapterTitlePage: false,
      sessionOverview: wholeSessionOverview || undefined,
      isAiOrganized: expanded.some(p => p.isAiOrganized),
    });
    builtCover.startPage = coverMeta.startPage;
    builtCover.endPage = coverMeta.endPage;
    builtCover.estimatedReadingMinutes =
      coverMeta.estimatedReadingMinutes || builtCover.estimatedReadingMinutes;

    expanded.unshift(builtCover);
  }

  const totalParts = expanded.length;
  return expanded.map((part, idx) => ({
    ...part,
    partNumber: idx + 1,
    totalParts,
  }));
}

export function splitSessionLiteralTextIntoParts(
  pages: ParsedPage[],
  startPage: number,
  endPage: number,
  partSize: BlcLiteralPartSize = 'standard',
  readingSpeedWpm: number = 200
): BlcLiteralReadingPart[] {
  const targetWords = getLiteralPartTargetWords(partSize);
  const wpm = Math.max(80, readingSpeedWpm || 200);

  const sessionPages = pages.filter(
    p => p.pageNumber >= startPage && p.pageNumber <= endPage
  );
  if (sessionPages.length === 0) return [];

  const cleanedPageLines = stripRunningHeadersAndFooters(sessionPages);
  const allBlocks: Array<{ block: BlcLiteralBlock; words: number }> = [];

  for (const page of sessionPages) {
    const lines = cleanedPageLines.get(page.pageNumber) || [];
    const blocks = reconstructContextualBlocksFromLines(
      lines,
      page.pageNumber,
      Math.round(targetWords * 1.05)
    );
    for (const block of blocks) {
      const words = countBlockWords(block);
      if (words > 0) {
        allBlocks.push({ block, words });
      }
    }
  }

  if (allBlocks.length === 0) {
    return [];
  }

  const rawParts: Array<{
    blocks: BlcLiteralBlock[];
    wordCount: number;
    contextualTitle?: string;
    isChapterTitlePage?: boolean;
  }> = [];

  let currentBlocks: BlcLiteralBlock[] = [];
  let currentWords = 0;
  let lastSeenHeading = '';

  const flushPart = () => {
    if (currentBlocks.length === 0) return;
    const ownHeading = currentBlocks.find(b => b.type === 'heading' || b.type === 'subheading');
    const title = ownHeading
      ? ownHeading.text.replace(/:$/, '')
      : lastSeenHeading || undefined;

    for (const b of currentBlocks) {
      if (b.type === 'heading') {
        lastSeenHeading = b.text;
      }
    }

    rawParts.push({
      blocks: currentBlocks,
      wordCount: currentWords,
      contextualTitle: title,
      isChapterTitlePage: false,
    });
    currentBlocks = [];
    currentWords = 0;
  };

  for (let i = 0; i < allBlocks.length; i++) {
    const { block, words } = allBlocks[i];

    // Give every major heading its own dedicated full Chapter Title Page
    if (block.type === 'heading') {
      flushPart();
      const titleBlocks: BlcLiteralBlock[] = [block];
      let titleWords = words;
      if (i + 1 < allBlocks.length && allBlocks[i + 1].block.type === 'subheading') {
        titleBlocks.push(allBlocks[i + 1].block);
        titleWords += allBlocks[i + 1].words;
        i++;
      }
      lastSeenHeading = block.text.replace(/:$/, '');
      rawParts.push({
        blocks: titleBlocks,
        wordCount: titleWords,
        contextualTitle: lastSeenHeading,
        isChapterTitlePage: true,
      });
      continue;
    }

    const isSub = block.type === 'subheading';
    const nextWords = i + 1 < allBlocks.length ? allBlocks[i + 1].words : 0;

    if (
      isSub &&
      currentWords > 0 &&
      (currentWords >= targetWords * 0.55 || currentWords + words + nextWords > targetWords * 1.2)
    ) {
      flushPart();
    } else if (currentWords > 0 && currentWords + words > targetWords * 1.15) {
      flushPart();
    }

    currentBlocks.push(block);
    currentWords += words;
  }

  flushPart();

  // Merge tiny trailing content fragment (< 35% of target) into previous non-title part if reasonable
  if (
    rawParts.length > 1 &&
    !rawParts[rawParts.length - 1].isChapterTitlePage &&
    !rawParts[rawParts.length - 2].isChapterTitlePage &&
    rawParts[rawParts.length - 1].wordCount < targetWords * 0.35 &&
    rawParts[rawParts.length - 2].wordCount + rawParts[rawParts.length - 1].wordCount <=
      targetWords * 1.38
  ) {
    const tail = rawParts.pop()!;
    const prev = rawParts[rawParts.length - 1];
    prev.blocks.push(...tail.blocks);
    prev.wordCount += tail.wordCount;
  }

  const totalParts = rawParts.length;
  const preliminaryParts: BlcLiteralReadingPart[] = rawParts.map((part, idx) => {
    const partStart = part.blocks[0].pageNumber;
    const partEnd = part.blocks[part.blocks.length - 1].pageNumber;
    const paragraphs = part.blocks.map(b => ({
      pageNumber: b.pageNumber,
      text:
        b.type === 'list' && b.items
          ? stripEditorialMarkers(b.items.map(it => `• ${it}`).join('\n'))
          : stripEditorialMarkers(b.text),
    }));

    return {
      partNumber: idx + 1,
      totalParts,
      contextualTitle: part.contextualTitle,
      isChapterTitlePage: part.isChapterTitlePage,
      startPage: partStart,
      endPage: partEnd,
      wordCount: part.wordCount,
      estimatedReadingMinutes: Math.max(1, Math.round(part.wordCount / wpm)),
      paragraphs,
      blocks: part.blocks,
      plainText: paragraphs.map(p => p.text).join('\n\n'),
      isAiOrganized: false,
    };
  });

  return expandPartsWithDedicatedChapterPages(preliminaryParts, wpm);
}

function getEditorialPromptBoxTitle(
  category: BlcDiscussionPrompt['category'] | string,
  questionText: string,
  forceUrdu: boolean
): string {
  const hasUrduChars = /[\u0679\u067E\u0686\u0688\u0691\u0698\u06A9\u06AF\u06BA\u06BE\u06C1-\u06C3\u06CC\u06D2\u06D3\u06D4]/.test(
    questionText
  );
  const hasRtlChars = /[\u0600-\u06FF]/.test(questionText);

  if (forceUrdu || hasUrduChars) {
    switch (category) {
      case 'Comprehension':
        return 'نکتۂ غور';
      case 'Critical Reflection':
        return 'لمحۂ فکر';
      case 'Practical Application':
        return 'عملی سوال';
      default:
        return 'حلقۂ گفتگو';
    }
  }

  if (hasRtlChars) {
    switch (category) {
      case 'Comprehension':
        return 'وقفة تأمل';
      case 'Critical Reflection':
        return 'نقطة للحوار';
      case 'Practical Application':
        return 'تطبيق عملي';
      default:
        return 'تأملات';
    }
  }

  switch (category) {
    case 'Comprehension':
      return 'Key Inquiry';
    case 'Critical Reflection':
      return 'Point to Ponder';
    case 'Practical Application':
      return 'Living Question';
    default:
      return 'Pause & Reflect';
  }
}

const PROMPT_STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'how', 'what', 'why', 'when', 'where',
  'who', 'which', 'into', 'does', 'your', 'about', 'their', 'they', 'have', 'been', 'will',
  'would', 'could', 'should', 'author', 'reading', 'session', 'circle', 'اور', 'کے', 'کی',
  'کا', 'میں', 'ہے', 'ہیں', 'نہیں', 'کو', 'سے', 'پر', 'اس', 'یہ', 'تو', 'جو', 'بھی', 'کیا', 'کس', 'طرح',
]);

function extractSearchTerms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !PROMPT_STOP_WORDS.has(w));
}

export function injectDiscussionPromptsIntoParts(
  parts: BlcLiteralReadingPart[],
  prompts: BlcDiscussionPrompt[],
  forceUrduTitles = false
): BlcLiteralReadingPart[] {
  if (!parts || parts.length === 0 || !prompts || prompts.length === 0) {
    return parts;
  }

  const contentPartIndices = parts
    .map((p, idx) =>
      !p.isSessionCoverPage && !p.isChapterTitlePage && p.blocks && p.blocks.length > 0
        ? idx
        : -1
    )
    .filter(idx => idx !== -1);

  if (contentPartIndices.length === 0) {
    return parts;
  }

  // Clone parts & strip any pre-existing prompt_callout blocks so placement stays idempotent
  const resultParts: BlcLiteralReadingPart[] = parts.map(part => ({
    ...part,
    blocks: (part.blocks || []).filter(b => b.type !== 'prompt_callout').map(b => ({ ...b })),
  }));

  // Build candidate anchor slots (insert before target blockIdx so prose wraps cleanly alongside float box)
  interface CandidateSlot {
    partIdx: number;
    contentOrder: number;
    insertBeforeIdx: number;
    sampleText: string;
    wordCount: number;
    pageNumber: number;
  }

  const slots: CandidateSlot[] = [];
  contentPartIndices.forEach((partIdx, contentOrder) => {
    const blocks = resultParts[partIdx].blocks;
    blocks.forEach((block, bIdx) => {
      if (block.type === 'paragraph' || block.type === 'quote') {
        const wc = block.text.split(/\s+/).filter(Boolean).length;
        // Skip tiny fragments unless the folio only has short blocks
        if (wc >= 14 || blocks.length <= 2) {
          const contextPrev = bIdx > 0 ? blocks[bIdx - 1].text : '';
          slots.push({
            partIdx,
            contentOrder,
            insertBeforeIdx: bIdx,
            sampleText: `${contextPrev} ${block.text}`.toLowerCase(),
            wordCount: wc,
            pageNumber: block.pageNumber,
          });
        }
      }
    });
  });

  if (slots.length === 0) {
    return parts;
  }

  const usedPartCounts = new Map<number, number>();
  const usedSlotKeys = new Set<string>();
  const plannedInsertions: Array<{
    partIdx: number;
    insertBeforeIdx: number;
    block: BlcLiteralBlock;
  }> = [];

  prompts.forEach((prompt, pIdx) => {
    if (!prompt?.question || !prompt.question.trim()) return;

    const terms = extractSearchTerms(`${prompt.question} ${prompt.facilitatorCue || ''}`);
    const targetProgress = (pIdx + 0.5) / Math.max(1, prompts.length);

    let bestSlot: CandidateSlot | null = null;
    let bestScore = -Infinity;

    for (const slot of slots) {
      const slotKey = `${slot.partIdx}:${slot.insertBeforeIdx}`;
      if (usedSlotKeys.has(slotKey)) continue;

      const partCount = usedPartCounts.get(slot.partIdx) || 0;
      const slotProgress =
        contentPartIndices.length > 1
          ? slot.contentOrder / Math.max(1, contentPartIndices.length - 1)
          : slot.insertBeforeIdx / Math.max(1, resultParts[slot.partIdx].blocks.length - 1);

      let keywordHits = 0;
      for (const term of terms) {
        if (slot.sampleText.includes(term)) {
          keywordHits++;
        }
      }

      const distancePenalty = Math.abs(slotProgress - targetProgress) * 14;
      const spreadPenalty =
        contentPartIndices.length >= prompts.length ? partCount * 18 : partCount * 5;
      const proseWrapBonus = slot.wordCount >= 28 ? 5 : slot.wordCount >= 18 ? 3 : 0;
      const notFirstHeadingBonus = slot.insertBeforeIdx > 0 ? 2 : 0;

      const score =
        keywordHits * 9 + proseWrapBonus + notFirstHeadingBonus - distancePenalty - spreadPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestSlot = slot;
      }
    }

    if (bestSlot) {
      usedSlotKeys.add(`${bestSlot.partIdx}:${bestSlot.insertBeforeIdx}`);
      usedPartCounts.set(bestSlot.partIdx, (usedPartCounts.get(bestSlot.partIdx) || 0) + 1);

      plannedInsertions.push({
        partIdx: bestSlot.partIdx,
        insertBeforeIdx: bestSlot.insertBeforeIdx,
        block: {
          type: 'prompt_callout',
          pageNumber: bestSlot.pageNumber,
          text: prompt.question.trim(),
          promptTitle: getEditorialPromptBoxTitle(
            prompt.category,
            prompt.question,
            forceUrduTitles
          ),
          promptSide: pIdx % 2 === 0 ? 'right' : 'left',
        },
      });
    }
  });

  // Apply insertions in reverse index order per part so indices remain exact
  const byPart = new Map<number, typeof plannedInsertions>();
  for (const ins of plannedInsertions) {
    const arr = byPart.get(ins.partIdx) || [];
    arr.push(ins);
    byPart.set(ins.partIdx, arr);
  }

  for (const [partIdx, items] of byPart.entries()) {
    items.sort((a, b) => b.insertBeforeIdx - a.insertBeforeIdx);
    const targetBlocks = resultParts[partIdx].blocks;
    for (const item of items) {
      targetBlocks.splice(item.insertBeforeIdx, 0, item.block);
    }
  }

  return resultParts;
}


