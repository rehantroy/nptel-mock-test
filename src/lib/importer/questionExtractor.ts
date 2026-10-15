import type {
  Question,
  Option,
  WeekNumber,
  ExtractionStatus,
  VerificationStatus,
  QuestionType,
} from '../../types';

export interface ExtractedQuestionDraft {
  tempId: string;
  originalQuestionNumber: number | string;
  questionText: string;
  options: { tempId: string; label: string; text: string }[];
  detectedAnswerLabel?: string; // e.g. "a", "B"
  explanation?: string;
  sourceFilename: string;
  sourcePageNumber?: number;
  originalSection?: string;
  originalHeading?: string;
  subjectId?: string;
  categoryId?: string;
  categoryName?: string;
  extractionStatus: ExtractionStatus;
  verificationStatus: VerificationStatus;
  notes?: string;
}

/**
 * Parses raw text extracted from PDF, DOCX, or TXT into structured question drafts.
 */
export function parseRawTextToQuestions(
  rawText: string,
  sourceFilename = 'uploaded_document',
  pageNumber?: number
): ExtractedQuestionDraft[] {
  const drafts: ExtractedQuestionDraft[] = [];

  // Normalize line endings
  const cleanText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Match question starting markers:
  // Examples: "1.", "1)", "Q1.", "Q.1", "Question 1:", "Question 1.", "E1.", "1(a)"
  const questionSplitRegex =
    /(?:^|\n\s*)(?:Question\s*(\d+[a-zA-Z]?)|Q\.?\s*(\d+[a-zA-Z]?)|E\s*(\d+[a-zA-Z]?)|(\d+[a-zA-Z]?)\s*[\.\)]|(\d+\([a-zA-Z]\)))\s*[:.\-–]?\s+/gi;

  const matches: { index: number; qNum: string; headerText: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = questionSplitRegex.exec(cleanText)) !== null) {
    const qNum =
      match[1] || match[2] || match[3] || match[4] || match[5] || String(matches.length + 1);
    matches.push({
      index: match.index,
      qNum,
      headerText: match[0],
    });
  }

  if (matches.length === 0) {
    // If no numbered pattern matched, return as a single candidate draft if text is substantial
    if (cleanText.trim().length > 20) {
      const parsedDraft = parseSingleQuestionBlock(cleanText, 1, sourceFilename, pageNumber);
      if (parsedDraft) drafts.push(parsedDraft);
    }
    return drafts;
  }

  for (let i = 0; i < matches.length; i++) {
    const startIdx = matches[i].index + matches[i].headerText.length;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index : cleanText.length;
    const block = cleanText.substring(startIdx, endIdx).trim();

    const draft = parseSingleQuestionBlock(
      block,
      matches[i].qNum,
      sourceFilename,
      pageNumber
    );
    if (draft) {
      drafts.push(draft);
    }
  }

  return drafts;
}

/**
 * Breaks a single question block into text, options, and any inline detected answer/explanation.
 */
export function parseSingleQuestionBlock(
  block: string,
  qNum: number | string,
  sourceFilename: string,
  pageNumber?: number
): ExtractedQuestionDraft | null {
  if (!block.trim()) return null;

  // Detect option patterns:
  // e.g., "(a)", "a)", "[a]", "a.", "(A)", "A)", "[A]", "A."
  const optionRegex =
    /(?:^|\n)\s*(?:\(([a-dA-D1-4])\)|([a-dA-D1-4])[\.\)]|\[([a-dA-D1-4])\])\s+/g;

  // Inline Answer marker regex
  const answerMarkerRegex =
    /(?:^|\n)\s*(?:\*{0,2})(?:Correct\s*Answer|Correct\s*Option|Answer|Ans|Key)\s*[:=–\-]\s*(?:\*{0,2})\s*(.*)$/im;

  // Inline Explanation marker regex
  const explanationMarkerRegex =
    /(?:^|\n)\s*(?:\*{0,2})(?:Detailed\s*Solution|Solution|Explanation|Explanations|Reason|Justification)\s*[:=–\-]\s*(?:\*{0,2})\s*(.*)$/im;

  let textRemaining = block;
  let explanation: string | undefined = undefined;
  let detectedAnswerLabel: string | undefined = undefined;

  // 1. Extract Explanation if present at the end
  const explMatch = textRemaining.match(explanationMarkerRegex);
  if (explMatch && explMatch.index !== undefined) {
    const explStart = explMatch.index + explMatch[0].indexOf(explMatch[1]);
    const extractedExpl = textRemaining.substring(explStart).trim();
    if (extractedExpl.length > 0) {
      explanation = extractedExpl;
    }
    textRemaining = textRemaining.substring(0, explMatch.index).trim();
  }

  // 2. Extract Answer line
  const ansMatch = textRemaining.match(answerMarkerRegex);
  if (ansMatch && ansMatch.index !== undefined) {
    const rawAns = ansMatch[1].trim();
    const letterMatch = rawAns.match(/(?:Option\s*)?\(?([a-dA-D1-4])\)?/i);
    if (letterMatch) {
      let l = letterMatch[1].toUpperCase();
      if (l === '1') l = 'A';
      if (l === '2') l = 'B';
      if (l === '3') l = 'C';
      if (l === '4') l = 'D';
      detectedAnswerLabel = l;
    }
    textRemaining = textRemaining.substring(0, ansMatch.index).trim();
  }

  const optionMatches: { index: number; label: string; fullMatch: string }[] = [];
  let optMatch: RegExpExecArray | null;

  while ((optMatch = optionRegex.exec(textRemaining)) !== null) {
    const label = (optMatch[1] || optMatch[2] || optMatch[3] || '').toUpperCase();
    optionMatches.push({
      index: optMatch.index,
      label,
      fullMatch: optMatch[0],
    });
  }

  let questionText = textRemaining;
  const options: { tempId: string; label: string; text: string }[] = [];

  if (optionMatches.length >= 2) {
    questionText = textRemaining.substring(0, optionMatches[0].index).trim();

    for (let i = 0; i < optionMatches.length; i++) {
      const start = optionMatches[i].index + optionMatches[i].fullMatch.length;
      const end =
        i + 1 < optionMatches.length ? optionMatches[i + 1].index : textRemaining.length;
      const optText = textRemaining.substring(start, end).trim();

      options.push({
        tempId: 'opt_' + i + '_' + Math.random().toString(36).substring(2, 6),
        label: optionMatches[i].label,
        text: optText,
      });
    }
  }

  const needsReview = options.length < 2 || !detectedAnswerLabel;

  return {
    tempId: 'draft_' + Math.random().toString(36).substring(2, 9),
    originalQuestionNumber: qNum,
    questionText,
    options,
    detectedAnswerLabel,
    explanation,
    sourceFilename,
    sourcePageNumber: pageNumber,
    extractionStatus: 'parsed',
    verificationStatus: needsReview ? 'needs_review' : 'verified',
    notes:
      options.length < 2
        ? 'Warning: Less than 2 options extracted. Manual review needed.'
        : undefined,
  };
}

/**
 * Converts an extracted draft into a full validated Question object once week and answer mapping are set.
 */
export function draftToVerifiedQuestion(
  draft: ExtractedQuestionDraft,
  week: WeekNumber,
  questionType: QuestionType,
  correctOptionId: string,
  verificationStatus: VerificationStatus = 'verified',
  extraMeta?: {
    subjectId?: string;
    categoryId?: string;
    categoryName?: string;
    originalHeading?: string;
  }
): Question {
  const options: Option[] = draft.options.map((opt) => ({
    id: opt.tempId.startsWith('opt_')
      ? opt.tempId
      : 'opt_' + Math.random().toString(36).substring(2, 8),
    text: opt.text,
  }));

  // Ensure correctOptionId points to one of the final options
  let finalCorrectOptionId = correctOptionId;
  const validOptionIds = options.map((o) => o.id);

  if (!validOptionIds.includes(finalCorrectOptionId) && options.length > 0) {
    finalCorrectOptionId = options[0].id;
  }

  return {
    id: 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
    subjectId: extraMeta?.subjectId || draft.subjectId || 'iiot',
    courseId: 'IIOT',
    week,
    questionType,
    categoryId: extraMeta?.categoryId || draft.categoryId,
    categoryName: extraMeta?.categoryName || draft.categoryName,
    originalHeading: extraMeta?.originalHeading || draft.originalHeading,
    originalQuestionNumber: draft.originalQuestionNumber,
    questionText: draft.questionText,
    options,
    correctOptionId: finalCorrectOptionId,
    explanation: draft.explanation,
    sourceFilename: draft.sourceFilename,
    sourcePageNumber: draft.sourcePageNumber,
    originalSection: draft.originalSection,
    extractionStatus: draft.extractionStatus,
    verificationStatus,
    duplicateStatus: 'unique',
    isOfficial: false,
    sourceType: 'user_upload',
    importTimestamp: new Date().toISOString(),
    notes: draft.notes,
  };
}
