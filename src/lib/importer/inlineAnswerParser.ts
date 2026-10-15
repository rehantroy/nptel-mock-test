import type {
  Option,
  WeekNumber,
  QuestionType,
  ExtractionStatus,
  VerificationStatus,
} from '../../types';

export interface ParsedSection {
  id: string;
  originalHeading: string;
  detectedWeek: WeekNumber | null;
  week?: WeekNumber | null;
  detectedCategory: string; // e.g. "Assignment Questions", "Important Numerical Questions"
  categoryName?: string;
  questionType: QuestionType; // 'assignment' | 'other'
  isAmbiguous: boolean;
  notes?: string;
  questions: ParsedInlineQuestionDraft[];
}

export interface ParsedInlineQuestionDraft {
  tempId: string;
  originalQuestionNumber: string | number;
  questionNumber?: string | number;
  questionText: string;
  options: { id?: string; tempId: string; label: string; text: string }[];
  rawAnswerText?: string;
  detectedAnswerLabel?: string; // e.g. "A", "B", "C", "D"
  matchedAnswerLabel?: string;
  matchedOptionId?: string;
  correctOptionId?: string;
  explanation?: string; // Optional, ONLY if present in source! Never fabricated.
  sourceFilename: string;
  sourcePageNumber?: number;
  originalHeading?: string;
  detectedWeek: WeekNumber | null;
  detectedCategory: string;
  questionType: QuestionType;
  extractionStatus: ExtractionStatus;
  verificationStatus: VerificationStatus;
  notes?: string;
}

/**
 * Normalizes text for matching option content
 */
function cleanTextForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a line is a section heading like:
 * "Week 1: Assignment Questions 2026"
 * "Week 2 — Assignment Questions"
 * "Week 1: Extra High Probability Questions"
 * "Week 2: Important Numerical Questions"
 * "Week 3: Previous Year Questions"
 * "Week 4: Conceptual Questions"
 */
export function parseSectionHeading(line: string): {
  isHeading: boolean;
  detectedWeek: WeekNumber | null;
  week: WeekNumber | null;
  detectedCategory: string;
  categoryName: string;
  questionType: QuestionType;
  isAmbiguous: boolean;
  needsManualReview: boolean;
  cleanedHeading: string;
} | null {
  const trimmed = line.trim().replace(/^\*+|\*+$/g, '').trim();

  // Pattern for Week-based headings:
  // e.g. "Week 1: Assignment Questions", "Week 2 — Important Numerical Questions", "WEEK 03 - Extra Questions"
  const weekHeadingRegex =
    /^(?:#+\s*)?(?:Week|Wk|W)\s*(\d+)\s*(?:[:—–\-–|]\s*|\s+)(.*)$/i;
  const weekMatch = trimmed.match(weekHeadingRegex);

  if (weekMatch) {
    const rawWeekNum = parseInt(weekMatch[1], 10);
    const validWeek =
      rawWeekNum >= 0 && rawWeekNum <= 12 ? (rawWeekNum as WeekNumber) : null;
    let categoryPart = weekMatch[2].trim();

    // Clean trailing punctuation or year e.g. "Assignment Questions 2026"
    categoryPart = categoryPart.replace(/^[:—–\-–|]\s*/, '').trim();

    const isAssignment = /assignment/i.test(categoryPart);
    const categoryName = categoryPart || (isAssignment ? 'Assignment Questions' : 'General Questions');

    return {
      isHeading: true,
      detectedWeek: validWeek,
      week: validWeek,
      detectedCategory: categoryName,
      categoryName,
      questionType: isAssignment ? 'assignment' : 'other',
      isAmbiguous: validWeek === null,
      needsManualReview: validWeek === null,
      cleanedHeading: trimmed,
    };
  }

  // Pattern for standalone Assignment headings e.g. "Assignment 1", "Assignment - 2: Digital Twin"
  const assignmentHeadingRegex = /^(?:#+\s*)?Assignment\s*(\d+)(?:\s*[:—–\-–|]\s*(.*))?$/i;
  const assignMatch = trimmed.match(assignmentHeadingRegex);
  if (assignMatch) {
    const rawWeekNum = parseInt(assignMatch[1], 10);
    const validWeek =
      rawWeekNum >= 0 && rawWeekNum <= 12 ? (rawWeekNum as WeekNumber) : null;
    const subtitle = assignMatch[2]?.trim();
    const categoryName = subtitle
      ? `Assignment Questions - ${subtitle}`
      : 'Assignment Questions';

    return {
      isHeading: true,
      detectedWeek: validWeek,
      week: validWeek,
      detectedCategory: categoryName,
      categoryName,
      questionType: 'assignment',
      isAmbiguous: validWeek === null,
      needsManualReview: validWeek === null,
      cleanedHeading: trimmed,
    };
  }

  // Pattern for general categorized headings without explicit week
  // e.g. "Important Numerical Questions", "General Practice Questions - Mixed Modules", "Module 4 Conceptual Problems"
  const generalHeadingRegex =
    /^(?:#+\s*)?([A-Za-z0-9\s—–\-–:()]+(?:Questions|Numerical|Problems|Practice|Module|Conceptual|Quiz).*)$/i;
  const genMatch = trimmed.match(generalHeadingRegex);
  if (genMatch) {
    const rawCategory = genMatch[1].trim();
    return {
      isHeading: true,
      detectedWeek: null,
      week: 0,
      detectedCategory: rawCategory,
      categoryName: rawCategory,
      questionType: 'other',
      isAmbiguous: true,
      needsManualReview: true,
      cleanedHeading: trimmed,
    };
  }

  return null;
}

/**
 * Extracts questions, inline answers, and optional explanations from raw text
 * with automatic section heading and week/category detection.
 */
export function parseCombinedDocumentText(
  rawText: string,
  sourceFilename = 'uploaded_document',
  pageNumber?: number
): ParsedSection[] {
  // Normalize line endings
  const clean = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.split('\n');

  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection = {
    id: 'sec_initial_' + Math.random().toString(36).substring(2, 7),
    originalHeading: 'General Questions',
    detectedWeek: 1,
    detectedCategory: 'Assignment Questions',
    questionType: 'assignment',
    isAmbiguous: false,
    questions: [],
  };

  let currentBlockLines: string[] = [];
  let currentQNum: string | number = 1;
  let inQuestion = false;

  const flushQuestionBlock = () => {
    if (currentBlockLines.length === 0) return;
    const blockText = currentBlockLines.join('\n').trim();
    currentBlockLines = [];

    if (blockText.length < 10) return;

    const parsedQuestion = parseInlineQuestionBlock(
      blockText,
      currentQNum,
      sourceFilename,
      currentSection.detectedWeek,
      currentSection.detectedCategory,
      currentSection.questionType,
      currentSection.originalHeading,
      pageNumber
    );

    if (parsedQuestion) {
      currentSection.questions.push(parsedQuestion);
    }
  };

  // Question header regex:
  // e.g. "Q1.", "Q1:", "Q.1", "Question 1:", "Question 1.", "1.", "1)", "E1.", "E1:", "1(a)", "1(b)"
  const questionStartRegex =
    /^\s*(?:\*{0,2})(?:Question\s*(\d+[a-zA-Z]?)|Q\.?\s*(\d+[a-zA-Z]?)|E\s*(\d+[a-zA-Z]?)|(\d+[a-zA-Z]?)\s*[\.\)]|(\d+\([a-zA-Z]\)))(?:\*{0,2})\s*[:.\-–]?\s*/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if line is a section heading
    const headingInfo = parseSectionHeading(trimmed);
    if (headingInfo && headingInfo.isHeading) {
      flushQuestionBlock();
      inQuestion = false;

      // If current section already has questions or is not empty, start a new section
      if (currentSection.questions.length > 0) {
        sections.push(currentSection);
      }

      currentSection = {
        id: 'sec_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
        originalHeading: headingInfo.cleanedHeading,
        detectedWeek: headingInfo.detectedWeek,
        week: headingInfo.detectedWeek,
        detectedCategory: headingInfo.detectedCategory,
        categoryName: headingInfo.detectedCategory,
        questionType: headingInfo.questionType,
        isAmbiguous: headingInfo.isAmbiguous,
        notes: headingInfo.isAmbiguous
          ? 'Notice: Week number could not be determined automatically from heading. Please select week in preview.'
          : undefined,
        questions: [],
      };
      continue;
    }

    // Check if line starts a new question
    const qMatch = trimmed.match(questionStartRegex);
    if (qMatch) {
      flushQuestionBlock();
      inQuestion = true;
      currentQNum =
        qMatch[1] || qMatch[2] || qMatch[3] || qMatch[4] || qMatch[5] || String(currentSection.questions.length + 1);

      // Strip question prefix from the line
      const restOfLine = trimmed.substring(qMatch[0].length).trim();
      currentBlockLines.push(restOfLine);
      continue;
    }

    if (inQuestion) {
      currentBlockLines.push(line);
    } else if (trimmed.length > 0) {
      // Possible preamble before Q1, or standalone question
      currentBlockLines.push(line);
    }
  }

  flushQuestionBlock();

  if (currentSection.questions.length > 0) {
    sections.push(currentSection);
  }

  // If no sections were explicitly created by headings, treat all questions under default
  if (sections.length === 0 && currentSection.questions.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Parses an isolated question block into text, options, inline answer, and optional explanation.
 */
export function parseInlineQuestionBlock(
  block: string,
  qNum: string | number = 1,
  sourceFilename = 'manual',
  week: WeekNumber | null = 1,
  category = 'Assignment Questions',
  questionType: QuestionType = 'assignment',
  originalHeading?: string,
  pageNumber?: number
): ParsedInlineQuestionDraft | null {
  if (!block.trim()) return null;

  let textRemaining = block.trim();
  let explanationText: string | undefined = undefined;
  let rawAnswerLine: string | undefined = undefined;

  // Question header regex to extract and strip leading Q# if present:
  const questionStartRegex =
    /^\s*(?:\*{0,2})(?:Question\s*(\d+[a-zA-Z]?)|Q\.?\s*(\d+[a-zA-Z]?)|E\s*(\d+[a-zA-Z]?)|(\d+[a-zA-Z]?)\s*[\.\)]|(\d+\([a-zA-Z]\)))(?:\*{0,2})\s*[:.\-–]?\s*/i;
  const qNumMatch = textRemaining.match(questionStartRegex);
  let actualQNum: string | number = qNum;

  if (qNumMatch) {
    const rawVal =
      qNumMatch[1] || qNumMatch[2] || qNumMatch[3] || qNumMatch[4] || qNumMatch[5];
    if (rawVal) {
      actualQNum = /^\d+$/.test(rawVal) ? parseInt(rawVal, 10) : rawVal;
    }
    textRemaining = textRemaining.substring(qNumMatch[0].length).trim();
  } else if (typeof actualQNum === 'string' && /^\d+$/.test(actualQNum)) {
    actualQNum = parseInt(actualQNum, 10);
  }

  // Option markers regex:
  // e.g. "(A)", "(B)", "(C)", "(D)" or "A.", "B.", "C.", "D." or "A)", "B)" or "[A]", "[B]"
  const optionRegex =
    /(?:^|\n)\s*(?:\*{0,2})(?:\(([a-dA-D1-4])\)|([a-dA-D1-4])[\.\)]|\[([a-dA-D1-4])\])(?:\*{0,2})\s+/g;

  // Inline Answer marker regex:
  // e.g. "Correct Answer:", "Correct answer -", "Answer:", "Ans:", "Correct Option:", "Key:"
  const answerMarkerRegex =
    /(?:^|\n)\s*(?:\*{0,2})(?:Correct\s*Answer|Correct\s*Option|Answer|Ans|Key)\s*[:=–\-]\s*(?:\*{0,2})\s*(.*)$/im;

  // Inline Explanation marker regex:
  // e.g. "Explanation:", "Explanations:", "Detailed Solution:", "Solution:", "Reason:"
  const explanationMarkerRegex =
    /(?:^|\n)\s*(?:\*{0,2})(?:Detailed\s*Solution|Solution|Explanation|Explanations|Reason|Justification)\s*[:=–\-]\s*(?:\*{0,2})\s*(.*)$/im;

  // 1. Extract Explanation if present at the end of the block
  const explMatch = textRemaining.match(explanationMarkerRegex);
  if (explMatch && explMatch.index !== undefined) {
    const explStart = explMatch.index + explMatch[0].indexOf(explMatch[1]);
    const extractedExpl = textRemaining.substring(explStart).trim();
    if (extractedExpl.length > 0) {
      explanationText = extractedExpl;
    }
    // Remove explanation from the block
    textRemaining = textRemaining.substring(0, explMatch.index).trim();
  }

  // 2. Extract Answer line
  const ansMatch = textRemaining.match(answerMarkerRegex);
  if (ansMatch && ansMatch.index !== undefined) {
    rawAnswerLine = ansMatch[1].trim();
    // Remove answer line from the block
    textRemaining = textRemaining.substring(0, ansMatch.index).trim();
  }

  // 3. Extract Options from the remaining text
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
  const options: { id?: string; tempId: string; label: string; text: string }[] = [];

  if (optionMatches.length >= 2) {
    questionText = textRemaining.substring(0, optionMatches[0].index).trim();

    for (let i = 0; i < optionMatches.length; i++) {
      const start = optionMatches[i].index + optionMatches[i].fullMatch.length;
      const end =
        i + 1 < optionMatches.length ? optionMatches[i + 1].index : textRemaining.length;
      const optText = textRemaining.substring(start, end).trim();

      const optId = 'opt_' + i + '_' + Math.random().toString(36).substring(2, 6);
      options.push({
        id: optId,
        tempId: optId,
        label: optionMatches[i].label,
        text: optText,
      });
    }
  }

  // 4. Resolve correct answer mapping to an option ID
  let detectedAnswerLabel: string | undefined = undefined;
  let matchedOptionId: string | undefined = undefined;

  if (rawAnswerLine) {
    // Try matching letter label: "(B)", "B", "Option B", "B - Option text"
    const letterMatch = rawAnswerLine.match(/(?:Option\s*)?\(?([a-dA-D1-4])\)?/i);
    if (letterMatch) {
      let letter = letterMatch[1].toUpperCase();
      if (letter === '1') letter = 'A';
      if (letter === '2') letter = 'B';
      if (letter === '3') letter = 'C';
      if (letter === '4') letter = 'D';

      detectedAnswerLabel = letter;
      const foundOpt = options.find(
        (o, idx) =>
          o.label.toUpperCase() === letter ||
          ['A', 'B', 'C', 'D'][idx] === letter
      );
      if (foundOpt) {
        matchedOptionId = foundOpt.tempId;
      }
    }

    // Fallback: If no letter matched, or to verify full option text match:
    if (!matchedOptionId && options.length > 0) {
      const cleanAns = cleanTextForMatching(rawAnswerLine);
      for (const opt of options) {
        const cleanOpt = cleanTextForMatching(opt.text);
        if (cleanAns.includes(cleanOpt) || cleanOpt.includes(cleanAns)) {
          matchedOptionId = opt.tempId;
          detectedAnswerLabel = opt.label;
          break;
        }
      }
    }
  }

  // Verification status
  // CRITICAL RULE: A question with a verified correct answer and NO explanation is 100% eligible!
  const hasValidAnswer = !!matchedOptionId;
  const hasValidOptions = options.length >= 2;
  const hasValidWeek = week !== null;

  let verificationStatus: VerificationStatus = 'verified';
  let notes: string | undefined = undefined;

  if (!hasValidAnswer) {
    verificationStatus = 'needs_review';
    notes = rawAnswerLine
      ? `Answer notation '${rawAnswerLine}' could not be matched to an option reliably.`
      : 'No inline correct answer detected for this question.';
  } else if (!hasValidOptions) {
    verificationStatus = 'needs_review';
    notes = 'Fewer than 2 options detected. Please check question formatting.';
  } else if (!hasValidWeek) {
    verificationStatus = 'needs_review';
    notes = 'Week could not be determined automatically from section heading.';
  }

  return {
    tempId: 'draft_' + Math.random().toString(36).substring(2, 9),
    originalQuestionNumber: actualQNum,
    questionNumber: actualQNum,
    questionText,
    options,
    rawAnswerText: rawAnswerLine,
    detectedAnswerLabel,
    matchedAnswerLabel: detectedAnswerLabel,
    matchedOptionId,
    correctOptionId: matchedOptionId,
    explanation: explanationText, // Optional!
    sourceFilename,
    sourcePageNumber: pageNumber,
    originalHeading,
    detectedWeek: week,
    detectedCategory: category,
    questionType,
    extractionStatus: 'parsed',
    verificationStatus,
    notes,
  };
}
