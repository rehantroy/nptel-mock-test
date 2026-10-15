import mammoth from 'mammoth';
import { parseRawTextToQuestions, type ExtractedQuestionDraft } from './questionExtractor';
import {
  parseCombinedDocumentText,
  type ParsedSection,
} from './inlineAnswerParser';

export interface DocxParseResult {
  filename: string;
  drafts: ExtractedQuestionDraft[];
  sections: ParsedSection[];
  rawText: string;
  error?: string;
}

/**
 * Extracts questions from Microsoft Word .docx files using mammoth
 */
export async function parseDocxFile(file: File): Promise<DocxParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const rawText = result.value;

    const drafts = parseRawTextToQuestions(rawText, file.name);
    const sections = parseCombinedDocumentText(rawText, file.name);

    return {
      filename: file.name,
      drafts,
      sections,
      rawText,
    };
  } catch (err: any) {
    return {
      filename: file.name,
      drafts: [],
      sections: [],
      rawText: '',
      error: `Failed to parse DOCX file: ${err?.message || 'Unknown error'}`,
    };
  }
}
