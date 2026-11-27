/**
 * TWL Circle Attribution Utilities
 *
 * Generates natural, varied attributions referencing The Wisdom Lounge (TWL) study circles
 * for modern remedy slides, ensuring phrases are varied across slides and never repeat
 * the exact same template sentence.
 */

export const TWL_CIRCLE_TEMPLATES = [
  (book: string, insight: string) => `In the ${book} circle by TWL, we learned that ${insight}`,
  (book: string, insight: string) => `Reflecting in TWL's ${book} study circle, we realized that ${insight}`,
  (book: string, insight: string) => `During the ${book} reading circle convened by TWL, it became clear that ${insight}`,
  (book: string, insight: string) => `As we discovered together in TWL's ${book} circle, ${insight}`,
  (book: string, insight: string) => `In our ${book} discussion circle with TWL, one central takeaway was that ${insight}`,
  (book: string, insight: string) => `Drawing from the ${book} circle by TWL, we recognized that ${insight}`,
  (book: string, insight: string) => `In the ${book} inquiry circle guided by TWL, the group arrived at this principle: ${insight}`,
  (book: string, insight: string) => `During our collective exploration in TWL's ${book} circle, we uncovered that ${insight}`,
  (book: string, insight: string) => `As reflected in the ${book} wisdom circle by TWL, ${insight}`,
  (book: string, insight: string) => `When examining this in TWL's ${book} reflection circle, our key realization was that ${insight}`
];

export const TWL_CIRCLE_TEMPLATES_URDU = [
  (book: string, insight: string) => `ٹی ڈبلیو ایل کے زیرِ اہتمام "${book}" کے حلقۂ مطالعہ میں ہم نے جانا کہ ${insight}`,
  (book: string, insight: string) => `دی وزڈم لاؤنج (TWL) کے "${book}" فکری دائرے میں غور و فکر کے دوران یہ حقیقت واضح ہوئی کہ ${insight}`,
  (book: string, insight: string) => `"${book}" کے مطالعاتی حلقے (TWL) میں ہم سب نے مشترکہ طور پر اخذ کیا کہ ${insight}`,
  (book: string, insight: string) => `ٹی ڈبلیو ایل کے مطالعۂ "${book}" کے دوران بنیادی سبق یہ حاصل ہوا کہ ${insight}`,
  (book: string, insight: string) => `دی وزڈم لاؤنج کے مباحثاتی حلقے میں "${book}" کا جائزہ لیتے ہوئے یہ نکتہ نکھر کر سامنے آیا کہ ${insight}`,
  (book: string, insight: string) => `جب ہم نے TWL کے حلقۂ مطالعہ میں "${book}" پر تدبر کیا تو یہ رہنما اصول سامنے آیا کہ ${insight}`
];

/**
 * Returns a varied attribution sentence for a given book name and insight.
 * Varies based on seed index or random choice so no two remedies look identical.
 */
export function generateTwlCircleAttribution(
  bookName: string, 
  coreInsight: string, 
  seed: number = 0,
  lang: 'en' | 'ur' = 'en'
): string {
  const isUrdu = lang === 'ur' || /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(coreInsight);
  const safeBook = (bookName || (isUrdu ? 'کلاسیکی حکمت' : 'Classical Wisdom')).trim();

  if (isUrdu) {
    const cleanInsight = coreInsight.trim().replace(/^،\s*|^\.\s*/, '').replace(/[\.۔]$/, '');
    const templateIndex = Math.abs(seed) % TWL_CIRCLE_TEMPLATES_URDU.length;
    return TWL_CIRCLE_TEMPLATES_URDU[templateIndex](safeBook, cleanInsight) + '۔';
  }

  const cleanInsight = coreInsight.trim().replace(/^[A-Z]/, c => c.toLowerCase()).replace(/\.$/, '');
  const templateIndex = Math.abs(seed) % TWL_CIRCLE_TEMPLATES.length;
  const template = TWL_CIRCLE_TEMPLATES[templateIndex];
  
  return template(safeBook, cleanInsight) + '.';
}

/**
 * Detects if a text block contains a TWL circle attribution
 */
export function containsTwlCircleAttribution(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (lower.includes('twl') && lower.includes('circle')) ||
         text.includes('حلقۂ مطالعہ') ||
         text.includes('حلقہ مطالعہ') ||
         text.includes('ٹی ڈبلیو ایل') ||
         text.includes('وزڈم لاؤنج');
}
