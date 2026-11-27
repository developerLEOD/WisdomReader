import { BlcLiteralBlock, BlcLiteralReadingPart } from '../types/blc';
import {
  appendFormattedImportantTextToDom,
  EditorialFormattingPalette,
  EditorialScriptKind,
  splitSentencesPreservingMarkers,
  splitWordsPreservingMarkers,
  stripEditorialMarkers,
} from './editorialFormatting';

export interface CardSpec {
  width: number;
  height: number;
}

export interface ReaderPaginatorPalette extends EditorialFormattingPalette {
  bg: string;
  innerFrame: string;
  quoteBg: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  border: string;
}

function hasRtlScript(text: string): boolean {
  const rtlMatches = text.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g);
  const latinMatches = text.match(/[A-Za-z]/g);
  const rtlCount = rtlMatches ? rtlMatches.length : 0;
  const latinCount = latinMatches ? latinMatches.length : 0;
  return rtlCount > 0 && rtlCount >= latinCount * 0.65;
}

function hasAnyUrduLetters(text: string): boolean {
  return /[\u0679\u067E\u0686\u0688\u0691\u0698\u06A9\u06AF\u06BA\u06BE\u06C1-\u06C3\u06CC\u06D2\u06D3\u06D4]/.test(
    text
  );
}

function detectScriptKind(text: string, bookHasUrduContext: boolean): EditorialScriptKind {
  if (!hasRtlScript(text)) return 'latin';
  const isDenseArabicCitation =
    /﴿|﴾/.test(text) || (text.match(/[\u064B-\u0652]/g)?.length || 0) >= 6;
  if (hasAnyUrduLetters(text)) return 'urdu';
  if (isDenseArabicCitation) return 'arabic';
  return bookHasUrduContext ? 'urdu' : 'arabic';
}

function countCleanBlockWords(block: BlcLiteralBlock): number {
  if (block.type === 'list' && block.items && block.items.length > 0) {
    return stripEditorialMarkers(`${block.text || ''} ${block.items.join(' ')}`)
      .split(/\s+/)
      .filter(Boolean).length;
  }
  return stripEditorialMarkers(block.text || '')
    .split(/\s+/)
    .filter(Boolean).length;
}

function createDomNodeForReaderBlock(
  block: BlcLiteralBlock,
  idx: number,
  prevBlock: BlcLiteralBlock | null,
  hasRenderedDropCapRef: { value: boolean },
  palette: ReaderPaginatorPalette,
  bookHasUrduContext: boolean,
  ratio: '4:5' | '9:16' | '16:9'
): HTMLElement {
  const blockSample =
    block.type === 'list' && block.items ? `${block.text} ${block.items.join(' ')}` : block.text;
  const scriptKind = detectScriptKind(blockSample, bookHasUrduContext);
  const blockRtl = scriptKind !== 'latin';
  const scriptFontClass =
    scriptKind === 'urdu' ? 'font-urdu' : scriptKind === 'arabic' ? 'font-arabic' : 'font-serif-body';

  if (block.type === 'prompt_callout') {
    const side = block.promptSide === 'left' ? 'left' : 'right';
    const aside = document.createElement('aside');
    aside.dir = blockRtl ? 'rtl' : 'ltr';
    aside.style.backgroundColor = palette.quoteBg;
    aside.style.borderColor = palette.innerFrame;
    aside.style.color = palette.textPrimary;
    aside.className = `border rounded-[2px] p-3 mt-1 mb-3 ${
      ratio === '16:9' ? 'w-[224px]' : 'w-[205px]'
    } ${side === 'left' ? 'float-left mr-4' : 'float-right ml-4'}`;

    const head = document.createElement('div');
    head.style.color = palette.accent;
    head.style.borderColor = palette.border;
    head.className = `pb-1.5 mb-1.5 border-b flex items-center gap-1.5 ${
      scriptKind === 'urdu'
        ? 'font-urdu text-[13px] leading-[1.6] justify-start'
        : scriptKind === 'arabic'
        ? 'font-arabic text-[12px] leading-[1.5] justify-start font-bold'
        : 'font-serif-body text-[10px] uppercase tracking-[0.14em] font-semibold'
    }`;
    const star = document.createElement('span');
    star.textContent = '✦';
    const titleSpan = document.createElement('span');
    titleSpan.textContent =
      block.promptTitle ||
      (scriptKind === 'urdu' ? 'نکتۂ غور' : scriptKind === 'arabic' ? 'وقفة تأمل' : 'Point to Ponder');
    head.appendChild(star);
    head.appendChild(titleSpan);

    const p = document.createElement('p');
    p.className = `${scriptFontClass} ${
      scriptKind === 'urdu'
        ? 'text-[14.5px] leading-[1.95] text-right'
        : scriptKind === 'arabic'
        ? 'text-[13.5px] leading-[1.85] text-right'
        : 'text-[12.5px] leading-[1.55] italic text-left'
    }`;
    p.textContent = stripEditorialMarkers(block.text);

    aside.appendChild(head);
    aside.appendChild(p);
    return aside;
  }

  const cleanText = stripEditorialMarkers(block.text);
  const wordTotal = cleanText.split(/\s+/).filter(Boolean).length;
  const canDropCap =
    block.type === 'paragraph' &&
    !block.isContinuation &&
    scriptKind === 'latin' &&
    !hasRenderedDropCapRef.value &&
    wordTotal >= 20 &&
    /^[A-Za-z]/.test(cleanText.trim()) &&
    (idx === 0 || prevBlock?.type === 'heading' || prevBlock?.type === 'subheading');
  if (canDropCap) {
    hasRenderedDropCapRef.value = true;
  }

  const isConsecutiveLatinParagraph =
    block.type === 'paragraph' &&
    !block.isContinuation &&
    scriptKind === 'latin' &&
    !canDropCap &&
    prevBlock?.type === 'paragraph';

  const wrapper = document.createElement('div');
  wrapper.dir = blockRtl ? 'rtl' : 'ltr';
  wrapper.className = `${ratio === '16:9' ? 'mt-2.5' : 'mt-3.5'} first:mt-0 space-y-2 ${
    block.type === 'heading' || block.type === 'subheading' ? 'clear-both' : ''
  }`;

  if (block.type === 'heading') {
    const inner = document.createElement('div');
    inner.className = 'pt-2 pb-1 text-center space-y-1.5';
    const h6 = document.createElement('h6');
    h6.style.color = palette.textPrimary;
    h6.className =
      scriptKind === 'urdu'
        ? 'font-urdu text-[22px] leading-[1.95] font-normal'
        : scriptKind === 'arabic'
        ? 'font-arabic text-[20px] leading-[1.9] font-bold'
        : 'font-serif-display text-[20px] leading-[1.28] font-semibold tracking-tight';
    h6.textContent = cleanText;
    inner.appendChild(h6);
    wrapper.appendChild(inner);
    return wrapper;
  }

  if (block.type === 'subheading') {
    const p = document.createElement('p');
    p.style.color = palette.subheadingColor;
    p.style.borderColor = palette.border;
    p.className = `${ratio === '16:9' ? 'pt-1 pb-1' : 'pt-2 pb-1'} border-b flex items-center gap-2 ${
      scriptKind === 'urdu'
        ? 'font-urdu text-[18.5px] leading-[1.95] text-right font-normal'
        : scriptKind === 'arabic'
        ? 'font-arabic text-[16.5px] leading-[1.85] text-right font-bold'
        : 'font-serif-display italic text-[16.5px] leading-[1.42] font-semibold text-left'
    }`;
    const diamond = document.createElement('span');
    diamond.style.color = palette.subheadingColor;
    diamond.className = 'text-[10px] shrink-0 opacity-80';
    diamond.textContent = '◆';
    const span = document.createElement('span');
    span.textContent = cleanText;
    p.appendChild(diamond);
    p.appendChild(span);
    wrapper.appendChild(p);
    return wrapper;
  }

  if (block.type === 'quote') {
    const bq = document.createElement('blockquote');
    bq.style.backgroundColor = palette.quoteBg;
    bq.style.borderColor = palette.border;
    bq.style.color = palette.textPrimary;
    bq.className = `my-1.5 mx-2 px-4 py-2.5 border-t border-b ${
      scriptKind === 'urdu'
        ? 'font-urdu text-[18px] leading-[2.12] text-right'
        : scriptKind === 'arabic'
        ? 'font-arabic text-[16.5px] leading-[2.0] text-center'
        : 'font-serif-body italic text-[14px] leading-[1.72] text-left'
    }`;
    appendFormattedImportantTextToDom(bq, block.text, palette, scriptKind);
    wrapper.appendChild(bq);
    return wrapper;
  }

  if (block.type === 'list') {
    const listWrap = document.createElement('div');
    listWrap.className = 'space-y-1.5 py-0.5';
    if (block.text) {
      const intro = document.createElement('p');
      intro.style.color = palette.textPrimary;
      intro.className = `${scriptFontClass} ${
        scriptKind === 'urdu'
          ? 'text-[18px] leading-[2.1] text-right'
          : scriptKind === 'arabic'
          ? 'text-[16px] leading-[1.9] text-right'
          : 'text-[14.5px] leading-[1.7] font-medium text-left'
      }`;
      appendFormattedImportantTextToDom(intro, block.text, palette, scriptKind);
      listWrap.appendChild(intro);
    }

    const ul = document.createElement('ul');
    ul.className = `space-y-1.5 ${scriptFontClass} ${
      scriptKind === 'urdu'
        ? 'pr-4 text-[18px] leading-[2.1] text-right'
        : scriptKind === 'arabic'
        ? 'pr-4 text-[16px] leading-[1.9] text-right'
        : 'pl-4 text-[14px] leading-[1.72] text-left'
    }`;
    const items = block.items && block.items.length > 0 ? block.items : [block.text];
    for (const item of items) {
      const li = document.createElement('li');
      li.style.color = palette.textPrimary;
      li.className = 'flex items-start gap-2';
      const bullet = document.createElement('span');
      bullet.style.color = palette.accent;
      bullet.className = `shrink-0 ${scriptKind === 'urdu' ? 'mt-1 text-xs' : 'mt-1.5 text-[10px]'}`;
      bullet.textContent = '❖';
      const span = document.createElement('span');
      span.className = 'flex-1';
      appendFormattedImportantTextToDom(span, item, palette, detectScriptKind(item, bookHasUrduContext));
      li.appendChild(bullet);
      li.appendChild(span);
      ul.appendChild(li);
    }
    listWrap.appendChild(ul);
    wrapper.appendChild(listWrap);
    return wrapper;
  }

  // paragraph
  const p = document.createElement('p');
  p.style.color = palette.textPrimary;
  p.className = `${scriptFontClass} ${
    scriptKind === 'urdu'
      ? `${ratio === '16:9' ? 'text-[18.5px] leading-[2.12]' : 'text-[19px] leading-[2.2]'} text-right`
      : scriptKind === 'arabic'
      ? `${ratio === '16:9' ? 'text-[16.5px] leading-[1.95]' : 'text-[17px] leading-[2.02]'} text-right`
      : `${ratio === '16:9' ? 'text-[14.5px] leading-[1.76]' : 'text-[15px] leading-[1.82]'} ${
          wordTotal >= 22 ? 'text-justify' : 'text-left'
        } ${canDropCap ? 'book-drop-cap' : ''} ${
          isConsecutiveLatinParagraph ? 'indent-5' : ''
        }`
  }`;
  appendFormattedImportantTextToDom(p, block.text, palette, scriptKind);
  wrapper.appendChild(p);
  return wrapper;
}

function buildSlideObject(
  basePart: BlcLiteralReadingPart,
  blocks: BlcLiteralBlock[],
  wpm: number,
  sourceFolioNumber: number
): BlcLiteralReadingPart {
  const startPage = blocks.length > 0 ? Math.min(...blocks.map(b => b.pageNumber)) : basePart.startPage;
  const endPage = blocks.length > 0 ? Math.max(...blocks.map(b => b.pageNumber)) : basePart.endPage;
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
  const wordCount = blocks.reduce((acc, b) => acc + countCleanBlockWords(b), 0);

  return {
    ...basePart,
    startPage,
    endPage,
    wordCount,
    estimatedReadingMinutes: Math.max(1, Math.round(wordCount / Math.max(80, wpm))),
    paragraphs,
    blocks,
    plainText,
    sourceFolioNumber,
  };
}

/**
 * Dynamically shifts overflowing text/blocks onto subsequent slides using the exact
 * canvas pixel boundary for 4:5, 9:16, and 16:9 frames without re-calling AI.
 */
export function paginatePartsToCanvasBoundary(options: {
  parts: BlcLiteralReadingPart[];
  ratio: '4:5' | '9:16' | '16:9';
  spec: CardSpec;
  palette: ReaderPaginatorPalette;
  bookTitle: string;
  sessionNumber: number;
  sessionHasUrduContext: boolean;
  wpm: number;
  resolveTitle: (part: BlcLiteralReadingPart) => string | undefined;
}): BlcLiteralReadingPart[] {
  const {
    parts,
    ratio,
    spec,
    palette,
    bookTitle,
    sessionNumber,
    sessionHasUrduContext,
    wpm,
    resolveTitle,
  } = options;

  if (typeof document === 'undefined' || parts.length === 0) {
    return parts;
  }

  // Create offscreen card measurer with exact dimensions & padding
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-99999px';
  host.style.top = '0';
  host.style.visibility = 'hidden';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '-1';

  const card = document.createElement('div');
  card.style.width = `${spec.width}px`;
  card.style.height = `${spec.height}px`;
  card.style.boxSizing = 'border-box';
  card.className = 'border p-4 flex flex-col justify-between';

  const innerFrame = document.createElement('div');
  innerFrame.className = `border flex-1 flex flex-col justify-between overflow-hidden ${
    ratio === '16:9' ? 'px-8 py-4' : 'px-8 py-6'
  }`;
  innerFrame.style.minHeight = '0';

  const titleContainer = document.createElement('div');
  titleContainer.className = `${ratio === '16:9' ? 'pb-2 mb-2' : 'pb-3 mb-3'} border-b text-center shrink-0`;
  const titleH5 = document.createElement('h5');
  titleContainer.appendChild(titleH5);

  const bodySlot = document.createElement('div');
  bodySlot.className = 'py-0.5 flex-1 overflow-hidden';
  bodySlot.style.minHeight = '0';

  const flowRoot = document.createElement('div');
  flowRoot.className = 'flow-root';
  bodySlot.appendChild(flowRoot);

  const footer = document.createElement('div');
  footer.className = `${
    ratio === '16:9' ? 'pt-2 mt-2' : 'pt-3 mt-3'
  } border-t grid grid-cols-3 items-center gap-2 text-[10.5px] font-serif-body tabular-nums shrink-0`;
  footer.innerHTML = `
    <span class="text-left font-semibold tracking-wide whitespace-nowrap">The Wisdom Lounge</span>
    <span class="truncate text-center font-medium"></span>
    <span class="text-right whitespace-nowrap">Session ${sessionNumber} · Folio 99 / 99</span>
  `;
  (footer.children[1] as HTMLElement).textContent = bookTitle;

  innerFrame.appendChild(titleContainer);
  innerFrame.appendChild(bodySlot);
  innerFrame.appendChild(footer);
  card.appendChild(innerFrame);
  host.appendChild(card);
  document.body.appendChild(host);

  const slides: BlcLiteralReadingPart[] = [];

  try {
    for (const part of parts) {
      if (part.isSessionCoverPage || part.isChapterTitlePage) {
        slides.push({
          ...part,
          sourceFolioNumber: part.partNumber,
          slideSplitIndex: 1,
          slideSplitTotal: 1,
        });
        continue;
      }

      const displayTitle = resolveTitle(part);
      if (displayTitle) {
        titleContainer.style.display = 'block';
        const titleScript = detectScriptKind(displayTitle, sessionHasUrduContext);
        titleH5.dir = titleScript === 'latin' ? 'ltr' : 'rtl';
        titleH5.className =
          titleScript === 'urdu'
            ? `${ratio === '16:9' ? 'text-[21px] leading-[1.82]' : 'text-[24px] leading-[1.95]'} font-urdu font-normal`
            : titleScript === 'arabic'
            ? `${ratio === '16:9' ? 'text-[19.5px] leading-[1.75]' : 'text-[22px] leading-[1.85]'} font-arabic font-bold`
            : `${ratio === '16:9' ? 'text-[21px] leading-[1.2]' : 'text-[24px] leading-[1.22]'} font-serif-display font-semibold tracking-tight`;
        titleH5.textContent = stripEditorialMarkers(displayTitle);
      } else {
        titleContainer.style.display = 'none';
        titleH5.textContent = '';
      }

      // Measure exact available vertical space inside bodySlot for this header/footer configuration
      flowRoot.innerHTML = '';
      const maxBodyHeight = Math.max(80, bodySlot.clientHeight - 8);

      const sourceBlocks: BlcLiteralBlock[] =
        part.blocks && part.blocks.length > 0
          ? part.blocks.map(b => ({ ...b }))
          : part.paragraphs.map(p => ({
              type: 'paragraph' as const,
              pageNumber: p.pageNumber,
              text: p.text,
            }));

      const queue: BlcLiteralBlock[] = [...sourceBlocks];
      const partSlides: BlcLiteralReadingPart[] = [];

      let currentSlideBlocks: BlcLiteralBlock[] = [];
      let dropCapRef = { value: false };

      const rebuildFlowRoot = (blocksList: BlcLiteralBlock[]) => {
        flowRoot.innerHTML = '';
        flowRoot.dir = hasRtlScript(part.plainText) ? 'rtl' : 'ltr';
        const dcRef = { value: false };
        for (let i = 0; i < blocksList.length; i++) {
          const dom = createDomNodeForReaderBlock(
            blocksList[i],
            i,
            i > 0 ? blocksList[i - 1] : null,
            dcRef,
            palette,
            sessionHasUrduContext,
            ratio
          );
          flowRoot.appendChild(dom);
        }
      };

      const doesListFit = (candidateBlocks: BlcLiteralBlock[]): boolean => {
        rebuildFlowRoot(candidateBlocks);
        return flowRoot.getBoundingClientRect().height <= maxBodyHeight;
      };

      const flushCurrentSlide = () => {
        if (currentSlideBlocks.length === 0) return;
        partSlides.push(buildSlideObject(part, currentSlideBlocks, wpm, part.partNumber));
        currentSlideBlocks = [];
        dropCapRef = { value: false };
        flowRoot.innerHTML = '';
      };

      let safetySteps = 0;
      while (queue.length > 0 && safetySteps < 500) {
        safetySteps++;
        const block = queue.shift()!;

        // 1. Check if whole block fits in current slide
        const candidateNode = createDomNodeForReaderBlock(
          block,
          currentSlideBlocks.length,
          currentSlideBlocks.length > 0 ? currentSlideBlocks[currentSlideBlocks.length - 1] : null,
          { value: dropCapRef.value },
          palette,
          sessionHasUrduContext,
          ratio
        );
        flowRoot.dir = hasRtlScript(part.plainText) ? 'rtl' : 'ltr';
        flowRoot.appendChild(candidateNode);
        const fitsWhole = flowRoot.getBoundingClientRect().height <= maxBodyHeight;

        if (fitsWhole) {
          // Prevent orphan subheading at the very bottom of a slide with no room for following content
          if (block.type === 'subheading' && queue.length > 0 && currentSlideBlocks.length > 0) {
            const nextBlock = queue[0];
            let nextHasRoom = false;
            if (nextBlock.type === 'paragraph' || nextBlock.type === 'quote') {
              const sents = splitSentencesPreservingMarkers(nextBlock.text);
              const firstPreview: BlcLiteralBlock = {
                ...nextBlock,
                text: sents[0] || nextBlock.text,
              };
              nextHasRoom = doesListFit([...currentSlideBlocks, block, firstPreview]);
            } else {
              nextHasRoom = doesListFit([...currentSlideBlocks, block, nextBlock]);
            }

            if (!nextHasRoom) {
              flushCurrentSlide();
              queue.unshift(block);
              continue;
            }
          }

          currentSlideBlocks.push(block);
          // Re-sync dropCapRef deterministically
          const testRef = { value: false };
          for (let i = 0; i < currentSlideBlocks.length; i++) {
            const b = currentSlideBlocks[i];
            const cleanT = stripEditorialMarkers(b.text);
            const wt = cleanT.split(/\s+/).filter(Boolean).length;
            const prevB = i > 0 ? currentSlideBlocks[i - 1] : null;
            const sk = detectScriptKind(cleanT, sessionHasUrduContext);
            if (
              b.type === 'paragraph' &&
              !b.isContinuation &&
              sk === 'latin' &&
              !testRef.value &&
              wt >= 20 &&
              /^[A-Za-z]/.test(cleanT.trim()) &&
              (i === 0 || prevB?.type === 'heading' || prevB?.type === 'subheading')
            ) {
              testRef.value = true;
            }
          }
          dropCapRef = testRef;
          continue;
        }

        // Remove failed tentative node
        flowRoot.removeChild(candidateNode);

        // 2. Overflowed! Split splittable blocks cleanly at sentence/item/word boundary
        if (block.type === 'paragraph' || block.type === 'quote') {
          const sentences = splitSentencesPreservingMarkers(block.text);

          if (sentences.length > 1) {
            // Binary search largest prefix of sentences that fits
            let lo = 1;
            let hi = sentences.length - 1;
            let bestFit = 0;

            while (lo <= hi) {
              const mid = Math.floor((lo + hi) / 2);
              const prefixBlock: BlcLiteralBlock = {
                ...block,
                text: sentences.slice(0, mid).join(' '),
              };
              if (doesListFit([...currentSlideBlocks, prefixBlock])) {
                bestFit = mid;
                lo = mid + 1;
              } else {
                hi = mid - 1;
              }
            }

            if (bestFit >= 1) {
              currentSlideBlocks.push({
                ...block,
                text: sentences.slice(0, bestFit).join(' '),
              });
              flushCurrentSlide();
              queue.unshift({
                ...block,
                text: sentences.slice(bestFit).join(' '),
                isContinuation: true,
              });
              continue;
            }
          }

          // Fewer than 1 sentence fit in remaining space
          if (currentSlideBlocks.length > 0) {
            flushCurrentSlide();
            queue.unshift(block);
            continue;
          }

          // Slide is completely empty, yet even the first sentence exceeds full card height -> split by words
          const words = splitWordsPreservingMarkers(block.text);
          if (words.length > 1) {
            let lo = 1;
            let hi = words.length - 1;
            let bestW = 1;

            while (lo <= hi) {
              const mid = Math.floor((lo + hi) / 2);
              const prefixBlock: BlcLiteralBlock = {
                ...block,
                text: words.slice(0, mid).join(' '),
              };
              if (doesListFit([prefixBlock])) {
                bestW = mid;
                lo = mid + 1;
              } else {
                hi = mid - 1;
              }
            }

            currentSlideBlocks.push({
              ...block,
              text: words.slice(0, bestW).join(' '),
            });
            flushCurrentSlide();
            if (bestW < words.length) {
              queue.unshift({
                ...block,
                text: words.slice(bestW).join(' '),
                isContinuation: true,
              });
            }
            continue;
          }

          currentSlideBlocks.push(block);
          flushCurrentSlide();
          continue;
        }

        if (block.type === 'list' && block.items && block.items.length > 1) {
          let lo = 1;
          let hi = block.items.length - 1;
          let bestItems = 0;

          while (lo <= hi) {
            const mid = Math.floor((lo + hi) / 2);
            const prefixBlock: BlcLiteralBlock = {
              ...block,
              items: block.items.slice(0, mid),
            };
            if (doesListFit([...currentSlideBlocks, prefixBlock])) {
              bestItems = mid;
              lo = mid + 1;
            } else {
              hi = mid - 1;
            }
          }

          if (bestItems >= 1) {
            currentSlideBlocks.push({
              ...block,
              items: block.items.slice(0, bestItems),
            });
            flushCurrentSlide();
            queue.unshift({
              ...block,
              text: '',
              items: block.items.slice(bestItems),
              isContinuation: true,
            });
            continue;
          }

          if (currentSlideBlocks.length > 0) {
            flushCurrentSlide();
            queue.unshift(block);
            continue;
          }
        }

        // Unsplittable block (prompt_callout, short single-item block, etc.)
        if (currentSlideBlocks.length > 0) {
          flushCurrentSlide();
          queue.unshift(block);
        } else {
          currentSlideBlocks.push(block);
          flushCurrentSlide();
        }
      }

      flushCurrentSlide();

      const totalForThisFolio = partSlides.length;
      partSlides.forEach((ps, sIdx) => {
        ps.slideSplitIndex = sIdx + 1;
        ps.slideSplitTotal = totalForThisFolio;
        slides.push(ps);
      });
    }
  } finally {
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
  }

  const totalSlides = slides.length;
  return slides.map((s, idx) => ({
    ...s,
    partNumber: idx + 1,
    totalParts: totalSlides,
  }));
}

export interface ModalSlideParagraph {
  text: string;
  label: string;
}

export interface ModalSlideChunk {
  partIndex: number;
  totalParts: number;
  paragraphs: ModalSlideParagraph[];
  quotes: string[];
  keyEvents: string[];
}

export function paginateModalChunksToCanvasBoundary(options: {
  paragraphs: string[];
  paragraphLabels: string[];
  quotes: string[];
  keyEvents: string[];
  paragraphsPerPart: number;
  spec: CardSpec;
  isWidescreen: boolean;
  isUrdu: boolean;
  density: 'compact' | 'normal' | 'relaxed';
  densityStyles: {
    title: string;
    paragraph: string;
    headerPadding: string;
    bodyPadding: string;
    footerPadding: string;
  };
  theme: {
    cardBg: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
    accentBg: string;
    border: string;
    quoteBg: string;
    badgeBg: string;
    subheadingColor: string;
    highlightBg: string;
    highlightText: string;
    underlineColor: string;
  };
  chapterNumber: number;
  totalChapters: number;
  displayTitle: string;
  bookTitle: string;
  bookAuthor: string;
  aspectRatioLabel: string;
}): ModalSlideChunk[] {
  const {
    paragraphs,
    paragraphLabels,
    quotes,
    keyEvents,
    paragraphsPerPart,
    spec,
    isWidescreen,
    isUrdu,
    densityStyles,
    theme,
    chapterNumber,
    totalChapters,
    displayTitle,
    bookTitle,
    bookAuthor,
    aspectRatioLabel,
  } = options;

  const baseParagraphs: ModalSlideParagraph[] = paragraphs.map((p, idx) => ({
    text: p,
    label: paragraphLabels[idx] || `Section ${idx + 1}`,
  }));

  if (typeof document === 'undefined' || baseParagraphs.length === 0) {
    return [
      {
        partIndex: 0,
        totalParts: 1,
        paragraphs: baseParagraphs,
        quotes,
        keyEvents,
      },
    ];
  }

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-99999px';
  host.style.top = '0';
  host.style.visibility = 'hidden';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '-1';

  const card = document.createElement('div');
  card.style.width = `${spec.width}px`;
  card.style.height = `${spec.height}px`;
  card.className = `w-full flex flex-col justify-between overflow-hidden relative font-serif-body ${
    isUrdu ? 'font-urdu' : ''
  }`;

  const header = document.createElement('div');
  header.className = `border-b ${densityStyles.headerPadding} flex flex-col space-y-1 shrink-0`;
  header.innerHTML = `
    <div class="flex items-center justify-between text-[10px] uppercase font-sans-ui tracking-wider opacity-80">
      <span class="font-bold">WISDOM READER</span>
      <span class="px-2 py-0.5 rounded font-mono font-bold">CHAPTER ${String(chapterNumber).padStart(2, '0')} · PART 1/9</span>
    </div>
    <div class="flex items-center justify-between gap-2">
      <span class="text-[11px] font-sans-ui truncate">"${bookTitle}" by ${bookAuthor}</span>
      <span class="text-[10px] font-mono shrink-0">${aspectRatioLabel}</span>
    </div>
    <h3 dir="${isUrdu ? 'rtl' : 'ltr'}" class="font-serif-display font-bold leading-snug tracking-tight ${densityStyles.title}"></h3>
  `;
  (header.querySelector('h3') as HTMLElement).textContent = `Chapter ${chapterNumber}: ${displayTitle}`;

  const body = document.createElement('div');
  body.className = `flex-1 ${densityStyles.bodyPadding} overflow-hidden flex flex-col justify-start`;
  body.style.minHeight = '0';

  const measureFlow = document.createElement('div');
  measureFlow.className = 'w-full';
  body.appendChild(measureFlow);

  const footer = document.createElement('div');
  footer.className = `border-t ${densityStyles.footerPadding} flex items-center justify-between text-[10px] font-sans-ui shrink-0`;
  footer.innerHTML = `
    <span>The Wisdom Lounge</span>
    <span>Ch ${chapterNumber} of ${totalChapters} · 1/9</span>
  `;

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);
  host.appendChild(card);
  document.body.appendChild(host);

  const formattingPalette: EditorialFormattingPalette = {
    highlightBg: theme.highlightBg,
    highlightText: theme.highlightText,
    underlineColor: theme.underlineColor,
    subheadingColor: theme.subheadingColor,
  };

  const renderModalPreviewContents = (
    pList: ModalSlideParagraph[],
    evList: string[],
    qList: string[]
  ) => {
    measureFlow.innerHTML = '';

    const pGrid = document.createElement('div');
    pGrid.className =
      isWidescreen && pList.length >= 2
        ? 'grid grid-cols-2 gap-3 items-start'
        : 'space-y-2.5';

    for (const pObj of pList) {
      const pScript = detectScriptKind(pObj.text, isUrdu);
      const pRtl = pScript !== 'latin';
      const box = document.createElement('div');
      box.className = 'border rounded-xl p-3 space-y-1';
      const lbl = document.createElement('span');
      lbl.style.color = theme.subheadingColor;
      lbl.className = 'text-[9.5px] font-sans-ui font-bold uppercase tracking-wider block';
      lbl.textContent = pObj.label;
      const pEl = document.createElement('p');
      pEl.dir = pRtl ? 'rtl' : 'ltr';
      pEl.className = `${
        pScript === 'urdu'
          ? 'font-urdu text-right leading-loose'
          : pScript === 'arabic'
          ? 'font-arabic text-right leading-[1.85]'
          : 'font-serif-body text-left'
      } ${densityStyles.paragraph}`;
      appendFormattedImportantTextToDom(pEl, pObj.text, formattingPalette, pScript);
      box.appendChild(lbl);
      box.appendChild(pEl);
      pGrid.appendChild(box);
    }
    measureFlow.appendChild(pGrid);

    if (evList.length > 0) {
      const evBox = document.createElement('div');
      evBox.className = 'border rounded-xl p-2.5 space-y-1 mt-2';
      const evTitle = document.createElement('span');
      evTitle.style.color = theme.subheadingColor;
      evTitle.className = 'text-[9.5px] font-sans-ui font-bold uppercase tracking-wider block';
      evTitle.textContent = 'Core Premises & Key Arguments';
      evBox.appendChild(evTitle);
      const ul = document.createElement('ul');
      ul.className = 'space-y-1';
      for (const ev of evList.slice(0, isWidescreen ? 2 : 3)) {
        const evScript = detectScriptKind(ev, isUrdu);
        const li = document.createElement('li');
        li.dir = evScript === 'latin' ? 'ltr' : 'rtl';
        li.className = `text-[10px] flex items-start gap-1.5 leading-snug ${
          evScript === 'urdu'
            ? 'font-urdu text-right'
            : evScript === 'arabic'
            ? 'font-arabic text-right'
            : 'font-serif-body'
        }`;
        const bullet = document.createElement('span');
        bullet.textContent = '•';
        const span = document.createElement('span');
        appendFormattedImportantTextToDom(span, ev, formattingPalette, evScript);
        li.appendChild(bullet);
        li.appendChild(span);
        ul.appendChild(li);
      }
      evBox.appendChild(ul);
      measureFlow.appendChild(evBox);
    }

    if (qList.length > 0) {
      const qText = `"${qList[0].replace(/^["']|["']$/g, '')}"`;
      const qScript = detectScriptKind(qText, isUrdu);
      const qBox = document.createElement('div');
      qBox.className = 'border rounded-xl p-2.5 space-y-1 mt-2';
      const qHead = document.createElement('div');
      qHead.className = 'flex items-center justify-between text-[9px] font-sans-ui uppercase tracking-wider font-bold';
      qHead.innerHTML = '<span>Source Text Citation</span><span>Direct Excerpt</span>';
      const qp = document.createElement('p');
      qp.dir = qScript === 'latin' ? 'ltr' : 'rtl';
      qp.className = `text-[11px] leading-snug ${
        qScript === 'urdu'
          ? 'text-right font-urdu'
          : qScript === 'arabic'
          ? 'text-right font-arabic'
          : 'font-serif-body italic'
      }`;
      appendFormattedImportantTextToDom(
        qp,
        qText,
        formattingPalette,
        qScript
      );
      qBox.appendChild(qHead);
      qBox.appendChild(qp);
      measureFlow.appendChild(qBox);
    }
  };

  const chunks: Array<{ paragraphs: ModalSlideParagraph[]; quotes: string[]; keyEvents: string[] }> = [];

  try {
    const maxBodyHeight = Math.max(80, body.clientHeight - 8);
    const fitsLayout = (pList: ModalSlideParagraph[], evList: string[], qList: string[]) => {
      renderModalPreviewContents(pList, evList, qList);
      return measureFlow.getBoundingClientRect().height <= maxBodyHeight;
    };

    const queue: ModalSlideParagraph[] = [...baseParagraphs];
    let currentParagraphs: ModalSlideParagraph[] = [];

    let steps = 0;
    while (queue.length > 0 && steps < 300) {
      steps++;
      const item = queue.shift()!;

      if (
        currentParagraphs.length < Math.max(1, paragraphsPerPart) &&
        fitsLayout([...currentParagraphs, item], [], [])
      ) {
        currentParagraphs.push(item);
        continue;
      }

      if (currentParagraphs.length >= Math.max(1, paragraphsPerPart)) {
        chunks.push({ paragraphs: currentParagraphs, quotes: [], keyEvents: [] });
        currentParagraphs = [];
        queue.unshift(item);
        continue;
      }

      // Overflowed canvas height -> split at sentence boundary
      const sents = splitSentencesPreservingMarkers(item.text);
      if (sents.length > 1) {
        let lo = 1;
        let hi = sents.length - 1;
        let bestFit = 0;
        while (lo <= hi) {
          const mid = Math.floor((lo + hi) / 2);
          const candidate: ModalSlideParagraph = {
            ...item,
            text: sents.slice(0, mid).join(' '),
          };
          if (fitsLayout([...currentParagraphs, candidate], [], [])) {
            bestFit = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }

        if (bestFit >= 1) {
          currentParagraphs.push({
            ...item,
            text: sents.slice(0, bestFit).join(' '),
          });
          chunks.push({ paragraphs: currentParagraphs, quotes: [], keyEvents: [] });
          currentParagraphs = [];
          queue.unshift({
            ...item,
            label: item.label.includes('(cont.)') ? item.label : `${item.label} (cont.)`,
            text: sents.slice(bestFit).join(' '),
          });
          continue;
        }
      }

      if (currentParagraphs.length > 0) {
        chunks.push({ paragraphs: currentParagraphs, quotes: [], keyEvents: [] });
        currentParagraphs = [];
        queue.unshift(item);
        continue;
      }

      // Single item on empty slide exceeds height -> split by words
      const words = splitWordsPreservingMarkers(item.text);
      if (words.length > 1) {
        let lo = 1;
        let hi = words.length - 1;
        let bestW = 1;
        while (lo <= hi) {
          const mid = Math.floor((lo + hi) / 2);
          const candidate: ModalSlideParagraph = {
            ...item,
            text: words.slice(0, mid).join(' '),
          };
          if (fitsLayout([candidate], [], [])) {
            bestW = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        chunks.push({
          paragraphs: [{ ...item, text: words.slice(0, bestW).join(' ') }],
          quotes: [],
          keyEvents: [],
        });
        if (bestW < words.length) {
          queue.unshift({
            ...item,
            label: item.label.includes('(cont.)') ? item.label : `${item.label} (cont.)`,
            text: words.slice(bestW).join(' '),
          });
        }
        continue;
      }

      chunks.push({ paragraphs: [item], quotes: [], keyEvents: [] });
    }

    if (currentParagraphs.length > 0) {
      chunks.push({ paragraphs: currentParagraphs, quotes: [], keyEvents: [] });
    }

    if (chunks.length === 0) {
      chunks.push({ paragraphs: baseParagraphs.slice(0, 1), quotes: [], keyEvents: [] });
    }

    // Place keyEvents & quotes on the last slide if they fit; otherwise shift onto a clean closing slide
    const last = chunks[chunks.length - 1];
    if (keyEvents.length > 0 || quotes.length > 0) {
      if (fitsLayout(last.paragraphs, keyEvents, quotes)) {
        last.keyEvents = keyEvents;
        last.quotes = quotes;
      } else if (keyEvents.length > 0 && fitsLayout(last.paragraphs, keyEvents, [])) {
        last.keyEvents = keyEvents;
        if (quotes.length > 0) {
          chunks.push({ paragraphs: [], quotes, keyEvents: [] });
        }
      } else {
        chunks.push({ paragraphs: [], quotes, keyEvents });
      }
    }
  } finally {
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
  }

  const totalParts = chunks.length;
  return chunks.map((c, idx) => ({
    partIndex: idx,
    totalParts,
    paragraphs: c.paragraphs,
    quotes: c.quotes,
    keyEvents: c.keyEvents,
  }));
}
