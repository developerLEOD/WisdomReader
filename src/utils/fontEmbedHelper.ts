const cachedFontBlobs = new Map<string, string>();
let cachedGoogleBookCss: string | null = null;

async function fetchAsDataUrl(url: string): Promise<string> {
  const existing = cachedFontBlobs.get(url);
  if (existing) return existing;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch font asset: ${url}`);
  }
  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('FileReader font conversion failed'));
    reader.readAsDataURL(blob);
  });
  cachedFontBlobs.set(url, dataUrl);
  return dataUrl;
}

async function getGoogleBookSerifCss(): Promise<string> {
  if (cachedGoogleBookCss !== null) {
    return cachedGoogleBookCss;
  }

  try {
    const cssUrl =
      'https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Cairo:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&display=swap';
    const res = await fetch(cssUrl);
    if (!res.ok) {
      cachedGoogleBookCss = '';
      return '';
    }
    let cssText = await res.text();

    // Replace remote woff2 URLs with inlined data URLs so SVG foreignObject renders cleanly
    const urlMatches = Array.from(cssText.matchAll(/url\((https:\/\/[^)]+)\)/g));
    const uniqueUrls = Array.from(new Set(urlMatches.map(m => m[1])));

    await Promise.all(
      uniqueUrls.map(async fontUrl => {
        try {
          const dataUrl = await fetchAsDataUrl(fontUrl);
          if (dataUrl) {
            cssText = cssText.split(fontUrl).join(dataUrl);
          }
        } catch {
          // Leave individual subset rule gracefully if blocked
        }
      })
    );

    cachedGoogleBookCss = cssText;
    return cssText;
  } catch {
    cachedGoogleBookCss = '';
    return '';
  }
}

async function getJameelNooriFontCss(): Promise<string> {
  try {
    const dataUrl = await fetchAsDataUrl('/fonts/JameelNooriNastaleeq.woff');
    if (!dataUrl) return '';
    return `@font-face { font-family: 'Jameel Noori Nastaliq'; src: url('${dataUrl}') format('woff'); font-weight: normal; font-style: normal; }`;
  } catch {
    return '';
  }
}

/**
 * Builds self-contained @font-face CSS for html-to-image PNG exports so book serifs
 * and Jameel Noori Nastaliq render faithfully inside exported PNG cards.
 */
export async function getBookFontEmbedCss(options: {
  includeUrdu: boolean;
}): Promise<string> {
  try {
    const tasks: Promise<string>[] = [getGoogleBookSerifCss()];
    if (options.includeUrdu) {
      tasks.push(getJameelNooriFontCss());
    }
    const chunks = await Promise.all(tasks);
    return chunks.filter(Boolean).join('\n');
  } catch {
    return '';
  }
}
