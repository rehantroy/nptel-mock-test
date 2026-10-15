import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import { parseRawTextToQuestions, type ExtractedQuestionDraft } from './questionExtractor';
import {
  parseCombinedDocumentText,
  type ParsedSection,
} from './inlineAnswerParser';

// Initialize PDF.js worker using CDN fallback if local worker is not bundled
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export interface PDFParseProgress {
  currentPage: number;
  totalPages: number;
  status: string;
}

export interface PDFParseResult {
  filename: string;
  totalPages: number;
  isScannedDetected: boolean;
  drafts: ExtractedQuestionDraft[];
  sections: ParsedSection[];
  fullRawText: string;
  pagesText: { pageNumber: number; text: string; isScanned: boolean }[];
  error?: string;
}

/**
 * Extracts text and questions from a PDF file.
 * Automatically flags scanned/image-based pages and optionally applies client-side OCR.
 * Also parses dynamic sections, inline answers, and optional explanations.
 */
export async function parsePdfFile(
  file: File,
  enableOcr = false,
  onProgress?: (p: PDFParseProgress) => void
): Promise<PDFParseResult> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    const allDrafts: ExtractedQuestionDraft[] = [];
    const pagesText: { pageNumber: number; text: string; isScanned: boolean }[] = [];
    let isScannedDetected = false;

    let ocrWorker: any = null;
    if (enableOcr) {
      onProgress?.({ currentPage: 0, totalPages, status: 'Initializing OCR engine...' });
      ocrWorker = await createWorker('eng');
    }

    const fullTextParts: string[] = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      onProgress?.({
        currentPage: pageNum,
        totalPages,
        status: `Reading page ${pageNum} of ${totalPages}...`,
      });

      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Collect text items with spacing awareness
      const pageTextParts: string[] = [];
      let lastY: number | null = null;

      for (const item of textContent.items as any[]) {
        if ('str' in item) {
          if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
            pageTextParts.push('\n');
          } else if (pageTextParts.length > 0 && !pageTextParts[pageTextParts.length - 1].endsWith(' ')) {
            pageTextParts.push(' ');
          }
          pageTextParts.push(item.str);
          lastY = item.transform[5];
        }
      }

      let extractedPageText = pageTextParts.join('').trim();
      const isScanned = extractedPageText.length < 50;

      if (isScanned) {
        isScannedDetected = true;
      }

      // If page is scanned/image-based and OCR is enabled, perform OCR via canvas rendering
      if (isScanned && enableOcr && ocrWorker) {
        onProgress?.({
          currentPage: pageNum,
          totalPages,
          status: `Running OCR on scanned page ${pageNum}...`,
        });

        try {
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (context) {
            await page.render({ canvasContext: context, viewport } as any).promise;
            const ocrResult = await ocrWorker.recognize(canvas);
            extractedPageText = ocrResult.data.text;

            const pageDrafts = parseRawTextToQuestions(
              extractedPageText,
              file.name,
              pageNum
            );

            // Flag OCR extracted items
            for (const draft of pageDrafts) {
              draft.extractionStatus = 'ocr_extracted';
              draft.verificationStatus = 'needs_review';
              draft.notes =
                'Extracted via Client OCR. Potential character recognition uncertainties. Side-by-side verification required.';
            }

            allDrafts.push(...pageDrafts);
          }
        } catch (ocrErr) {
          console.warn(`OCR failed for page ${pageNum}:`, ocrErr);
        }
      } else {
        // Standard text PDF extraction
        const pageDrafts = parseRawTextToQuestions(
          extractedPageText,
          file.name,
          pageNum
        );
        allDrafts.push(...pageDrafts);
      }

      fullTextParts.push(extractedPageText);
      pagesText.push({
        pageNumber: pageNum,
        text: extractedPageText,
        isScanned,
      });
    }

    if (ocrWorker) {
      await ocrWorker.terminate();
    }

    const fullRawText = fullTextParts.join('\n\n');
    // Parse combined sections with inline answers and explanations
    const sections = parseCombinedDocumentText(fullRawText, file.name);

    return {
      filename: file.name,
      totalPages,
      isScannedDetected,
      drafts: allDrafts,
      sections,
      fullRawText,
      pagesText,
    };
  } catch (err: any) {
    return {
      filename: file.name,
      totalPages: 0,
      isScannedDetected: false,
      drafts: [],
      sections: [],
      fullRawText: '',
      pagesText: [],
      error: `Failed to parse PDF: ${err?.message || 'Unknown error'}`,
    };
  }
}
