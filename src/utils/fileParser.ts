import * as pdfjsLib from 'pdfjs-dist';

// Set worker source for pdfjs-dist
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
} catch (e) {
  console.warn('PDF.js worker initialization notice:', e);
}

export interface ParsedFileResult {
  title: string;
  author: string;
  text: string;
  wordCount: number;
  fileName: string;
}

export async function parseFileToText(file: File): Promise<ParsedFileResult> {
  const fileName = file.name;
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
  let extractedText = '';

  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (ext === 'pdf') {
    extractedText = await parsePdfFile(file);
  } else if (ext === 'epub') {
    extractedText = await parseEpubFile(file);
  } else {
    // Default plain text, markdown, json, etc.
    extractedText = await file.text();
  }

  // Sanitize and clean up whitespace
  extractedText = extractedText
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!extractedText) {
    throw new Error('Could not extract text content from the uploaded file.');
  }

  const words = extractedText.split(/\s+/).filter(Boolean);
  
  return {
    title: formatTitleFromName(nameWithoutExt),
    author: 'Uploaded Document',
    text: extractedText,
    wordCount: words.length,
    fileName
  };
}

async function parsePdfFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');
      fullText += `\n--- Page ${pageNum} ---\n` + pageText;
    }

    return fullText;
  } catch (err) {
    console.error('PDF parsing error:', err);
    // Fallback if pdfjs fails
    return await file.text();
  }
}

async function parseEpubFile(file: File): Promise<string> {
  try {
    const text = await file.text();
    // Strip XML/HTML tags from EPUB file stream
    const docText = text.replace(/<[^>]+>/g, ' ');
    return docText;
  } catch (err) {
    return await file.text();
  }
}

function formatTitleFromName(filename: string): string {
  return filename
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}
