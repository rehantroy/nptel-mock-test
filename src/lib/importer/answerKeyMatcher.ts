import type { Question } from '../../types';
import type { ExtractedQuestionDraft } from './questionExtractor';

export interface AnswerKeyEntry {
  questionNumber: string;
  answerLabel: string; // "A", "B", "C", "D", or "1", "2", etc.
  notes?: string;
}

export interface KeyMatchResult {
  matchedCount: number;
  unmatchedCount: number;
  conflictsCount: number;
  results: {
    questionNumber: string;
    status: 'matched' | 'missing_in_key' | 'option_not_found' | 'ambiguous';
    assignedOptionId?: string;
    details: string;
  }[];
}

/**
 * Parses raw answer key text into a structured mapping
 * Supports patterns like:
 * 1. A
 * 2. B
 * or Q1: C, Q2: D
 * or 1 - (b)
 * or comma-separated: 1:A, 2:B, 3:C
 */
export function parseAnswerKeyText(keyText: string): Map<string, string> {
  const map = new Map<string, string>();
  const clean = keyText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Match patterns like "Q1: A" or "1. (b)" or "1 - B" or "1: A"
  const regex = /(?:Q(?:uestion)?\.?\s*)?(\d+)\s*[:.\-–)]\s*\(?([a-dA-D1-4])\)?/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(clean)) !== null) {
    const qNum = match[1];
    const ans = match[2].toUpperCase();
    map.set(qNum, ans);
  }

  // Fallback: simple line-by-line if formatted simply as:
  // 1 A
  // 2 B
  if (map.size === 0) {
    const lines = clean.split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
        const qNum = parts[0];
        const ansMatch = parts[1].match(/[a-dA-D1-4]/);
        if (ansMatch) {
          map.set(qNum, ansMatch[0].toUpperCase());
        }
      }
    }
  }

  return map;
}

/**
 * Applies a parsed answer key map to a list of question drafts
 */
export function applyAnswerKeyToDrafts(
  drafts: ExtractedQuestionDraft[],
  keyMap: Map<string, string>,
  keySourceName = 'Official Answer Key'
): { updatedDrafts: ExtractedQuestionDraft[]; matchResult: KeyMatchResult } {
  const updatedDrafts = [...drafts];
  const results: KeyMatchResult['results'] = [];
  let matchedCount = 0;
  let unmatchedCount = 0;
  let conflictsCount = 0;

  for (const draft of updatedDrafts) {
    const qNumStr = String(draft.originalQuestionNumber).trim();
    const keyAnswer = keyMap.get(qNumStr);

    if (!keyAnswer) {
      unmatchedCount++;
      results.push({
        questionNumber: qNumStr,
        status: 'missing_in_key',
        details: `No key entry found for Question #${qNumStr}`,
      });
      draft.verificationStatus = 'needs_answer_key';
      continue;
    }

    // Match answer label to option
    // Map '1'->'A', '2'->'B', '3'->'C', '4'->'D' if numeric
    let normalizedAnswer = keyAnswer;
    if (normalizedAnswer === '1') normalizedAnswer = 'A';
    if (normalizedAnswer === '2') normalizedAnswer = 'B';
    if (normalizedAnswer === '3') normalizedAnswer = 'C';
    if (normalizedAnswer === '4') normalizedAnswer = 'D';

    // Find corresponding option
    const foundOption = draft.options.find(
      (opt, idx) =>
        opt.label.toUpperCase() === normalizedAnswer ||
        (idx === 0 && normalizedAnswer === 'A') ||
        (idx === 1 && normalizedAnswer === 'B') ||
        (idx === 2 && normalizedAnswer === 'C') ||
        (idx === 3 && normalizedAnswer === 'D')
    );

    if (foundOption) {
      draft.detectedAnswerLabel = normalizedAnswer;
      draft.verificationStatus = 'verified';
      draft.notes = `Answer verified against ${keySourceName}. Option ${normalizedAnswer} mapped.`;
      matchedCount++;
      results.push({
        questionNumber: qNumStr,
        status: 'matched',
        assignedOptionId: foundOption.tempId,
        details: `Matched Option (${normalizedAnswer})`,
      });
    } else {
      conflictsCount++;
      draft.verificationStatus = 'needs_review';
      draft.notes = `Conflict: Key indicated answer (${normalizedAnswer}) but question only has ${draft.options.length} options.`;
      results.push({
        questionNumber: qNumStr,
        status: 'option_not_found',
        details: `Key specified (${normalizedAnswer}), but option does not exist in extracted draft`,
      });
    }
  }

  return {
    updatedDrafts,
    matchResult: {
      matchedCount,
      unmatchedCount,
      conflictsCount,
      results,
    },
  };
}

/**
 * Applies answer key map to existing Question objects in the bank
 */
export function applyAnswerKeyToQuestions(
  questions: Question[],
  keyMap: Map<string, string>,
  keySourceName = 'Official Answer Key'
): { updatedQuestions: Question[]; matchResult: KeyMatchResult } {
  const updatedQuestions = questions.map((q) => ({ ...q }));
  const results: KeyMatchResult['results'] = [];
  let matchedCount = 0;
  let unmatchedCount = 0;
  let conflictsCount = 0;

  for (const q of updatedQuestions) {
    const qNumStr = String(q.originalQuestionNumber).trim();
    const keyAnswer = keyMap.get(qNumStr);

    if (!keyAnswer) {
      unmatchedCount++;
      results.push({
        questionNumber: qNumStr,
        status: 'missing_in_key',
        details: `No key entry found for Question #${qNumStr}`,
      });
      continue;
    }

    let normalized = keyAnswer;
    if (normalized === '1') normalized = 'A';
    if (normalized === '2') normalized = 'B';
    if (normalized === '3') normalized = 'C';
    if (normalized === '4') normalized = 'D';

    const optIndex = ['A', 'B', 'C', 'D'].indexOf(normalized);
    if (optIndex >= 0 && q.options[optIndex]) {
      q.correctOptionId = q.options[optIndex].id;
      q.verificationStatus = 'verified';
      q.notes = `Answer verified against ${keySourceName}. Matched option ${normalized}.`;
      matchedCount++;
      results.push({
        questionNumber: qNumStr,
        status: 'matched',
        assignedOptionId: q.correctOptionId,
        details: `Matched Option ${normalized}`,
      });
    } else {
      conflictsCount++;
      q.verificationStatus = 'needs_review';
      q.notes = `Answer key mismatch: Option ${normalized} does not exist in question.`;
      results.push({
        questionNumber: qNumStr,
        status: 'option_not_found',
        details: `Key says ${normalized}, but question options out of range`,
      });
    }
  }

  return {
    updatedQuestions,
    matchResult: {
      matchedCount,
      unmatchedCount,
      conflictsCount,
      results,
    },
  };
}
