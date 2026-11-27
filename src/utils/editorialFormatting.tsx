import React from 'react';

export type EditorialScriptKind = 'urdu' | 'arabic' | 'latin';

export interface EditorialFormattingPalette {
  highlightBg: string;
  highlightText: string;
  underlineColor: string;
  subheadingColor: string;
}

export interface FormattedSegment {
  text: string;
  style: 'normal' | 'highlight' | 'underline';
}

const ENGLISH_STOPWORDS = new Set([
  'about', 'above', 'after', 'again', 'against', 'almost', 'alone', 'along', 'already', 'also',
  'although', 'always', 'among', 'another', 'anyone', 'anything', 'around', 'because', 'become',
  'becomes', 'before', 'behind', 'being', 'below', 'between', 'beyond', 'cannot', 'could',
  'during', 'either', 'enough', 'every', 'everyone', 'everything', 'first', 'found', 'further',
  'given', 'having', 'hence', 'herself', 'himself', 'however', 'indeed', 'instead', 'itself',
  'large', 'later', 'least', 'little', 'might', 'moreover', 'mostly', 'myself', 'neither',
  'never', 'nothing', 'often', 'other', 'others', 'otherwise', 'ought', 'outside', 'perhaps',
  'quite', 'rather', 'really', 'second', 'several', 'shall', 'should', 'since', 'something',
  'sometimes', 'somewhat', 'still', 'study', 'their', 'theirs', 'them', 'themselves', 'thence',
  'there', 'thereby', 'therefore', 'these', 'thing', 'things', 'think', 'third', 'those',
  'though', 'through', 'throughout', 'together', 'toward', 'towards', 'under', 'unless', 'until',
  'using', 'various', 'where', 'whereas', 'whereby', 'whether', 'which', 'while', 'within',
  'without', 'would', 'writing', 'written', 'people', 'person', 'chapter', 'section', 'pages',
]);

const RTL_STOPWORDS = new Set([
  'اور', 'کے', 'کی', 'کا', 'کو', 'میں', 'سے', 'پر', 'اس', 'یہ', 'وہ', 'جو', 'تو', 'بھی', 'ہی',
  'نہیں', 'ہیں', 'ہے', 'تھا', 'تھی', 'تھے', 'ہوگا', 'ہوگی', 'ہوں', 'گیا', 'گئی', 'گئے', 'کرنا',
  'کرتے', 'کرتی', 'کرنے', 'والے', 'والی', 'والا', 'ہوئے', 'ہوتی', 'ہوتا', 'ہونے', 'لیکن', 'مگر',
  'بلکہ', 'تاکہ', 'کیونکہ', 'چنانچہ', 'لہذا', 'جبکہ', 'اگرچہ', 'اپنے', 'اپنی', 'اپنا', 'انھوں',
  'انہوں', 'انسانوں', 'تمام', 'بہت', 'زیادہ', 'طرح', 'پہلے', 'بعد', 'ساتھ', 'اندر', 'باہر',
  'الذي', 'التي', 'الذين', 'اللواتي', 'هذا', 'هذه', 'ذلك', 'تلك', 'هؤلاء', 'أولئك', 'اليكم',
  'عليكم', 'عليهم', 'فيها', 'منها', 'إليها', 'عندما', 'بينما', 'حيث', 'لكن', 'ولكن', 'لذلك',
  'كذلك', 'أيضا', 'فإن', 'وإن', 'بأن', 'لأن', 'على', 'إلى', 'عن', 'في', 'من', 'مع', 'بين', 'قبل',
]);

const EMPHASIS_CUE_WORDS = new Set([
  'principle', 'essence', 'essential', 'truth', 'wisdom', 'heart', 'soul', 'justice', 'mercy',
  'courage', 'humility', 'discipline', 'purpose', 'meaning', 'virtue', 'character', 'habit',
  'foundation', 'fundamental', 'crucial', 'critical', 'responsibility', 'integrity', 'knowledge',
  'faith', 'patience', 'gratitude', 'awareness', 'mindfulness', 'community', 'service', 'compassion',
  'insight', 'criterion', 'balance', 'harmony', 'freedom', 'conscience', 'reflection', 'action',
  'اصول', 'حکمت', 'حقیقت', 'مقصد', 'نیت', 'اخلاص', 'صبر', 'شکر', 'عدل', 'انصاف', 'احسان',
  'تزکیہ', 'تربیت', 'معرفت', 'تقویٰ', 'تقوی', 'محبت', 'خدمت', 'ذمہ', 'شعور', 'بصیرت',
  'عمل', 'کردار', 'اخلاق', 'علم', 'فکر', 'قلب', 'روح', 'سچائی', 'امانت', 'دیانت', 'توازن',
  'الحكمة', 'الحقيقة', 'الأصل', 'العدل', 'الإحسان', 'التزكية', 'المعرفة', 'التقوى', 'القلب',
  'النية', 'الإخلاص', 'الصبر', 'الشكر', 'البصيرة', 'الأمانة', 'العلم', 'العمل', 'الخلق',
]);

export function stripEditorialMarkers(text: string): string {
  if (!text) return '';
  return text
    .replace(/==([^=\n]+)==/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1');
}

function normalizeMarkerPairs(chunk: string, activeStyle: 'none' | 'highlight' | 'underline'): {
  output: string;
  nextStyle: 'none' | 'highlight' | 'underline';
} {
  // Count balanced markers in chunk while preserving clean closing/reopening across split slides
  let style = activeStyle;
  let result = '';
  if (style === 'highlight') result += '==';
  if (style === 'underline') result += '__';

  let i = 0;
  while (i < chunk.length) {
    const two = chunk.slice(i, i + 2);
    if (two === '==') {
      if (style === 'none') {
        style = 'highlight';
        result += '==';
      } else if (style === 'highlight') {
        style = 'none';
        result += '==';
      }
      // If currently inside underline, skip nested == so styles never overlap
      i += 2;
      continue;
    }
    if (two === '__') {
      if (style === 'none') {
        style = 'underline';
        result += '__';
      } else if (style === 'underline') {
        style = 'none';
        result += '__';
      }
      i += 2;
      continue;
    }
    result += chunk[i];
    i++;
  }

  if (style === 'highlight') result += '==';
  if (style === 'underline') result += '__';

  return { output: result, nextStyle: style };
}

export function splitSentencesPreservingMarkers(text: string): string[] {
  const clean = text.trim();
  if (!clean) return [];

  const rawSentences =
    clean.match(/[^.?!\u061F\u06D4]+[.?!\u061F\u06D4]+["'”’\)\]=_]*\s*|[^.?!\u061F\u06D4]+$/g) ||
    [clean];

  const balanced: string[] = [];
  let activeStyle: 'none' | 'highlight' | 'underline' = 'none';

  for (const s of rawSentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    const { output, nextStyle } = normalizeMarkerPairs(trimmed, activeStyle);
    balanced.push(output);
    activeStyle = nextStyle;
  }

  return balanced.length > 0 ? balanced : [clean];
}

export function splitWordsPreservingMarkers(text: string): string[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const balanced: string[] = [];
  let activeStyle: 'none' | 'highlight' | 'underline' = 'none';

  for (const tok of tokens) {
    const { output, nextStyle } = normalizeMarkerPairs(tok, activeStyle);
    balanced.push(output);
    activeStyle = nextStyle;
  }
  return balanced;
}

function cleanWordForScore(token: string): string {
  return token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function stableWordHash(word: string): number {
  let h = 0;
  for (let i = 0; i < word.length; i++) {
    h = (h * 31 + word.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Splits a block's text into non-overlapping segments marked as 'normal', 'highlight', or 'underline'.
 * - Respects explicit ==highlight== and __underline__ markers if present (making them mutually exclusive).
 * - Otherwise selects important words/phrases intelligently across English, Urdu, and Arabic,
 *   guaranteeing colored highlighting and underlining never overlap on the same words.
 */
function coalesceSegments(segments: FormattedSegment[]): FormattedSegment[] {
  const result: FormattedSegment[] = [];
  for (const seg of segments) {
    if (!seg.text) continue;
    const last = result[result.length - 1];
    if (last && last.style === seg.style) {
      last.text += seg.text;
    } else {
      result.push({ text: seg.text, style: seg.style });
    }
  }
  return result;
}

/**
 * Splits a block's text into non-overlapping segments marked as 'normal', 'highlight', or 'underline'.
 * - Respects explicit ==highlight== and __underline__ markers if present (capped to 1 each per paragraph to avoid overcrowding).
 * - Otherwise selects at most 1–2 genuinely important keywords across English, Urdu, and Arabic,
 *   guaranteeing highlights and underlines never overcrowd the text or overlap.
 */
export function buildFormattedSegments(text: string): FormattedSegment[] {
  if (!text) return [];

  // Multi-paragraph splitting: process each paragraph with its own clean emphasis budget
  if (text.includes('\n\n')) {
    const rawParagraphs = text.split(/\n\s*\n/);
    const combined: FormattedSegment[] = [];
    for (let pIdx = 0; pIdx < rawParagraphs.length; pIdx++) {
      if (pIdx > 0) {
        combined.push({ text: '\n\n', style: 'normal' });
      }
      const pSegments = buildFormattedSegments(rawParagraphs[pIdx]);
      combined.push(...pSegments);
    }
    return coalesceSegments(combined);
  }

  const hasExplicitMarkers = /==[^=\n]+==|__[^_\n]+__/.test(text);
  if (hasExplicitMarkers) {
    const segments: FormattedSegment[] = [];
    const regex = /(==[^=\n]+==|__[^_\n]+__)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // Strict caps to prevent visual overcrowding: at most 1 highlight and 1 underline per paragraph
    let highlightCount = 0;
    let underlineCount = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const plain = stripEditorialMarkers(text.slice(lastIndex, match.index));
        if (plain) segments.push({ text: plain, style: 'normal' });
      }
      const rawToken = match[0];
      if (rawToken.startsWith('==') && rawToken.endsWith('==')) {
        const inner = stripEditorialMarkers(rawToken.slice(2, -2));
        const words = inner.trim().split(/\s+/).filter(Boolean);
        // Only keep if not overcrowded (at most 1 per paragraph, and at most 4 words)
        if (inner && highlightCount < 1 && words.length <= 4) {
          segments.push({ text: inner, style: 'highlight' });
          highlightCount++;
        } else if (inner) {
          segments.push({ text: inner, style: 'normal' });
        }
      } else if (rawToken.startsWith('__') && rawToken.endsWith('__')) {
        const inner = stripEditorialMarkers(rawToken.slice(2, -2));
        const words = inner.trim().split(/\s+/).filter(Boolean);
        // Only keep if not overcrowded (at most 1 per paragraph, and at most 5 words)
        if (inner && underlineCount < 1 && words.length <= 5) {
          segments.push({ text: inner, style: 'underline' });
          underlineCount++;
        } else if (inner) {
          segments.push({ text: inner, style: 'normal' });
        }
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      const tail = stripEditorialMarkers(text.slice(lastIndex));
      if (tail) segments.push({ text: tail, style: 'normal' });
    }

    return coalesceSegments(segments);
  }

  // Automatic smart semantic emphasis for unmarked text (English, Urdu, Arabic)
  const rawTokens = text.split(/(\s+)/);
  const wordTokenIndices: number[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    if (rawTokens[i] && !/^\s+$/.test(rawTokens[i])) {
      wordTokenIndices.push(i);
    }
  }

  // Do not emphasize short blocks (under 22 words) to keep them clean and uncrowded
  if (wordTokenIndices.length < 22) {
    return [{ text, style: 'normal' }];
  }

  const assignedStyle = new Array<'normal' | 'highlight' | 'underline'>(rawTokens.length).fill('normal');
  const wordScores: Array<{ wordPos: number; tokenIdx: number; score: number; clean: string }> = [];

  for (let wPos = 0; wPos < wordTokenIndices.length; wPos++) {
    const tokenIdx = wordTokenIndices[wPos];
    const token = rawTokens[tokenIdx];
    const clean = cleanWordForScore(token);
    if (!clean) continue;

    const isRtl = /[\u0600-\u06FF]/.test(clean);
    const lower = clean.toLowerCase();

    if (isRtl) {
      if (clean.length < 4 || RTL_STOPWORDS.has(clean)) continue;
    } else {
      if (clean.length < 5 || ENGLISH_STOPWORDS.has(lower)) continue;
    }

    let score = Math.min(8, clean.length);
    if (EMPHASIS_CUE_WORDS.has(lower) || EMPHASIS_CUE_WORDS.has(clean)) {
      score += 15;
    }
    if (/^[“"«]/.test(token) || /[”"»][,.;:!?۔؟]?$/.test(token)) {
      score += 4;
    }
    if (!isRtl && wPos > 0 && /^[A-Z][a-z]{3,}$/.test(clean)) {
      score += 2;
    }
    // Slight deterministic tie-breaker
    score += (stableWordHash(clean) % 5) * 0.4;

    // Only consider genuinely strong semantic words (score >= 12)
    if (score >= 12) {
      wordScores.push({ wordPos: wPos, tokenIdx, score, clean });
    }
  }

  if (wordScores.length === 0) {
    return [{ text, style: 'normal' }];
  }

  // Sort candidates by semantic salience descending
  wordScores.sort((a, b) => b.score - a.score);

  // Very restrained limits: at most 1 styled item for paragraphs under 60 words, at most 2 for 60+ words
  const maxStyledGroups = wordTokenIndices.length >= 60 ? 2 : 1;
  const blockedWordPositions = new Set<number>();
  let highlightCount = 0;
  let underlineCount = 0;

  for (const cand of wordScores) {
    if (highlightCount + underlineCount >= maxStyledGroups) break;
    if (blockedWordPositions.has(cand.wordPos)) continue;

    // Balance highlight vs underline so at most 1 of each appears in a paragraph
    const chosenStyle: 'highlight' | 'underline' =
      highlightCount === 0 && (underlineCount > 0 || stableWordHash(cand.clean) % 2 === 0)
        ? 'highlight'
        : underlineCount === 0
        ? 'underline'
        : 'highlight';

    assignedStyle[cand.tokenIdx] = chosenStyle;

    // Block a generous window around this word so emphasis never clusters (at least 10 words distance)
    const blockRadius = Math.max(10, Math.floor(wordTokenIndices.length / 5));
    for (
      let b = Math.max(0, cand.wordPos - blockRadius);
      b <= Math.min(wordTokenIndices.length - 1, cand.wordPos + blockRadius);
      b++
    ) {
      blockedWordPositions.add(b);
    }

    if (chosenStyle === 'highlight') highlightCount++;
    else underlineCount++;
  }

  // Coalesce adjacent tokens sharing the same style
  const segments: FormattedSegment[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const tok = rawTokens[i];
    if (!tok) continue;
    const style = assignedStyle[i];
    const last = segments[segments.length - 1];
    if (last && last.style === style) {
      last.text += tok;
    } else {
      segments.push({ text: tok, style });
    }
  }

  return coalesceSegments(segments);
}

export function renderFormattedImportantText(
  text: string,
  palette: EditorialFormattingPalette,
  scriptKind: EditorialScriptKind = 'latin'
): React.ReactNode {
  const segments = buildFormattedSegments(text);
  const isRtl = scriptKind !== 'latin';

  return segments.map((seg, idx) => {
    if (seg.style === 'highlight') {
      return (
        <span
          key={idx}
          style={{
            color: palette.highlightText,
            fontWeight: 'inherit',
          }}
        >
          {seg.text}
        </span>
      );
    }

    if (seg.style === 'underline') {
      return (
        <span
          key={idx}
          style={{
            textDecorationLine: 'underline',
            textDecorationStyle: 'solid',
            textDecorationColor: palette.underlineColor,
            textDecorationThickness: '1.5px',
            textUnderlineOffset: isRtl ? '5px' : '3.5px',
            fontWeight: 'inherit',
          }}
        >
          {seg.text}
        </span>
      );
    }

    return <React.Fragment key={idx}>{seg.text}</React.Fragment>;
  });
}

/**
 * Pure DOM counterpart used by the real-time offscreen canvas-boundary measurer
 * so font-weight and line metrics match React rendering pixel-for-pixel.
 */
export function appendFormattedImportantTextToDom(
  parent: HTMLElement,
  text: string,
  palette: EditorialFormattingPalette,
  scriptKind: EditorialScriptKind = 'latin'
): void {
  const segments = buildFormattedSegments(text);
  const isRtl = scriptKind !== 'latin';

  for (const seg of segments) {
    if (seg.style === 'highlight') {
      const span = document.createElement('span');
      span.style.color = palette.highlightText;
      span.textContent = seg.text;
      parent.appendChild(span);
    } else if (seg.style === 'underline') {
      const span = document.createElement('span');
      span.style.textDecorationLine = 'underline';
      span.style.textDecorationStyle = 'solid';
      span.style.textDecorationColor = palette.underlineColor;
      span.style.textDecorationThickness = '1.5px';
      span.style.textUnderlineOffset = isRtl ? '5px' : '3.5px';
      span.textContent = seg.text;
      parent.appendChild(span);
    } else {
      parent.appendChild(document.createTextNode(seg.text));
    }
  }
}
