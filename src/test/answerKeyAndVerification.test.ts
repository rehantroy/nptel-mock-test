import { describe, it, expect } from 'vitest';
import { validateQuestionCandidate } from '../lib/validation';
import {
  parseAnswerKeyText,
  applyAnswerKeyToDrafts,
} from '../lib/importer/answerKeyMatcher';
import { filterQuestionsForTest } from '../lib/testEngine';
import type { ExtractedQuestionDraft } from '../lib/importer/questionExtractor';
import type { Question } from '../types';

describe('Answer Key Validation & Verification Status', () => {
  it('rejects a question marked as verified if correctOptionId does not match any option', () => {
    const invalidQuestion = {
      id: 'q_invalid_key',
      courseId: 'IIOT',
      week: 1,
      questionType: 'assignment',
      originalQuestionNumber: 1,
      questionText: 'Which protocol is lightweight?',
      options: [
        { id: 'opt_1', text: 'CoAP' },
        { id: 'opt_2', text: 'HTTP/1.1' },
      ],
      correctOptionId: 'non_existent_opt_999',
      verificationStatus: 'verified', // Marked verified with bogus option ID
      sourceFilename: 'test.pdf',
    };

    const res = validateQuestionCandidate(invalidQuestion);
    expect(res.success).toBe(false);
    expect(res.errors?.some((e) => e.includes('correctOptionId'))).toBe(true);
  });

  it('correctly parses various answer key formats (1. A, Q2: (b), 3 - C)', () => {
    const keyText = `
      1. A
      Q2: (b)
      3 - C
      4: D
    `;
    const map = parseAnswerKeyText(keyText);
    expect(map.get('1')).toBe('A');
    expect(map.get('2')).toBe('B');
    expect(map.get('3')).toBe('C');
    expect(map.get('4')).toBe('D');
  });

  it('flags missing answer keys as needs_answer_key', () => {
    const drafts: ExtractedQuestionDraft[] = [
      {
        tempId: 'draft_1',
        originalQuestionNumber: '1',
        questionText: 'Q1 Text',
        options: [
          { tempId: 'opt_1', label: 'A', text: 'Opt A' },
          { tempId: 'opt_2', label: 'B', text: 'Opt B' },
        ],
        sourceFilename: 'file.pdf',
        extractionStatus: 'parsed',
        verificationStatus: 'extracted',
      },
      {
        tempId: 'draft_2',
        originalQuestionNumber: '2',
        questionText: 'Q2 Text',
        options: [
          { tempId: 'opt_3', label: 'A', text: 'Opt A' },
          { tempId: 'opt_4', label: 'B', text: 'Opt B' },
        ],
        sourceFilename: 'file.pdf',
        extractionStatus: 'parsed',
        verificationStatus: 'extracted',
      },
    ];

    // Key only contains answer for Question 1
    const keyMap = new Map<string, string>([['1', 'A']]);
    const { updatedDrafts, matchResult } = applyAnswerKeyToDrafts(drafts, keyMap);

    expect(matchResult.matchedCount).toBe(1);
    expect(matchResult.unmatchedCount).toBe(1);
    expect(updatedDrafts[0].verificationStatus).toBe('verified');
    expect(updatedDrafts[1].verificationStatus).toBe('needs_answer_key');
  });

  it('flags conflicts when key specifies an option that does not exist in the question', () => {
    const drafts: ExtractedQuestionDraft[] = [
      {
        tempId: 'draft_1',
        originalQuestionNumber: '1',
        questionText: 'Q1 Text',
        options: [
          { tempId: 'opt_1', label: 'A', text: 'Opt A' },
          { tempId: 'opt_2', label: 'B', text: 'Opt B' },
        ],
        sourceFilename: 'file.pdf',
        extractionStatus: 'parsed',
        verificationStatus: 'extracted',
      },
    ];

    // Key says answer is (D), but question only has 2 options (A, B)
    const keyMap = new Map<string, string>([['1', 'D']]);
    const { updatedDrafts, matchResult } = applyAnswerKeyToDrafts(drafts, keyMap);

    expect(matchResult.conflictsCount).toBe(1);
    expect(updatedDrafts[0].verificationStatus).toBe('needs_review');
    expect(updatedDrafts[0].notes).toContain('Conflict');
  });

  it('unverified questions never enter scored test attempts', () => {
    const questions: Question[] = [
      {
        id: 'q_unverified_1',
        courseId: 'IIOT',
        week: 1,
        questionType: 'assignment',
        originalQuestionNumber: 1,
        questionText: 'Unverified Question',
        options: [
          { id: 'opt_1', text: 'A' },
          { id: 'opt_2', text: 'B' },
        ],
        correctOptionId: 'opt_1',
        verificationStatus: 'needs_review',
        sourceFilename: 'file.pdf',
        extractionStatus: 'parsed',
        duplicateStatus: 'unique',
        importTimestamp: new Date().toISOString(),
      },
      {
        id: 'q_verified_1',
        courseId: 'IIOT',
        week: 1,
        questionType: 'assignment',
        originalQuestionNumber: 2,
        questionText: 'Verified Question',
        options: [
          { id: 'opt_3', text: 'A' },
          { id: 'opt_4', text: 'B' },
        ],
        correctOptionId: 'opt_3',
        verificationStatus: 'verified',
        sourceFilename: 'file.pdf',
        extractionStatus: 'parsed',
        duplicateStatus: 'unique',
        importTimestamp: new Date().toISOString(),
      },
    ];

    const eligible = filterQuestionsForTest(questions, {
      mode: 'all_questions',
      selectedWeeks: [1],
      questionType: 'both',
    });

    expect(eligible.length).toBe(1);
    expect(eligible[0].id).toBe('q_verified_1');
  });
});
