import { describe, it, expect } from 'vitest';
import { filterQuestionsForTest } from '../lib/testEngine';
import type { Question, WeekNumber } from '../types';

describe('Week Filtering & 5 Required Test Modes', () => {
  const createQ = (
    id: string,
    week: WeekNumber,
    type: 'assignment' | 'other',
    verified = true
  ): Question => ({
    id,
    courseId: 'IIOT',
    week,
    questionType: type,
    originalQuestionNumber: 1,
    questionText: `Question ${id} text`,
    options: [
      { id: `${id}_a`, text: 'A' },
      { id: `${id}_b`, text: 'B' },
    ],
    correctOptionId: `${id}_a`,
    sourceFilename: 'test.pdf',
    extractionStatus: 'parsed',
    verificationStatus: verified ? 'verified' : 'needs_review',
    duplicateStatus: 'unique',
    importTimestamp: new Date().toISOString(),
  });

  const questionBank: Question[] = [
    createQ('q_w0_a1', 0, 'assignment'),
    createQ('q_w0_a2', 0, 'assignment'),
    createQ('q_w0_o1', 0, 'other'),
    createQ('q_w1_a1', 1, 'assignment'),
    createQ('q_w1_o1', 1, 'other'),
    createQ('q_w3_a1', 3, 'assignment'),
    createQ('q_w12_a1', 12, 'assignment'),
    createQ('q_w12_o1', 12, 'other'),
    createQ('q_unverified', 2, 'assignment', false), // unverified question
  ];

  it('Mode 1: Week-wise Test works for Week 0 and excludes other questions', () => {
    const res = filterQuestionsForTest(questionBank, {
      mode: 'week_wise',
      selectedWeeks: [0],
      selectedWeek: 0,
      questionType: 'assignment',
    });

    expect(res.length).toBe(2);
    expect(res.every((q) => q.week === 0 && q.questionType === 'assignment')).toBe(true);
    expect(res.some((q) => q.id === 'q_w0_o1')).toBe(false);
  });

  it('Mode 1: Week-wise Test works for Week 12 and excludes other questions', () => {
    const res = filterQuestionsForTest(questionBank, {
      mode: 'week_wise',
      selectedWeeks: [12],
      selectedWeek: 12,
      questionType: 'assignment',
    });

    expect(res.length).toBe(1);
    expect(res[0].id).toBe('q_w12_a1');
    expect(res[0].week).toBe(12);
  });

  it('Mode 2: Custom Test supports multiple weeks with Assignment only', () => {
    const res = filterQuestionsForTest(questionBank, {
      mode: 'custom',
      selectedWeeks: [0, 1, 3],
      questionType: 'assignment',
    });

    // Should include w0 assignments (2) + w1 assignment (1) + w3 assignment (1) = 4
    expect(res.length).toBe(4);
    expect(res.every((q) => q.questionType === 'assignment')).toBe(true);
    expect(res.some((q) => q.questionType === 'other')).toBe(false);
  });

  it('Mode 2: Custom Test supports multiple weeks with Other only', () => {
    const res = filterQuestionsForTest(questionBank, {
      mode: 'custom',
      selectedWeeks: [0, 1, 12],
      questionType: 'other',
    });

    // w0_o1 (1) + w1_o1 (1) + w12_o1 (1) = 3
    expect(res.length).toBe(3);
    expect(res.every((q) => q.questionType === 'other')).toBe(true);
  });

  it('Mode 2: Custom Test supports Both assignment and other questions', () => {
    const res = filterQuestionsForTest(questionBank, {
      mode: 'custom',
      selectedWeeks: [0, 1],
      questionType: 'both',
    });

    // w0 (2 assignments + 1 other = 3) + w1 (1 assignment + 1 other = 2) = 5
    expect(res.length).toBe(5);
    const types = new Set(res.map((q) => q.questionType));
    expect(types.has('assignment')).toBe(true);
    expect(types.has('other')).toBe(true);
  });

  it('Mode 3: All Week Test includes all assignment questions across all weeks and excludes other questions', () => {
    const res = filterQuestionsForTest(questionBank, {
      mode: 'all_week',
      selectedWeeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      questionType: 'assignment',
    });

    // w0: 2, w1: 1, w3: 1, w12: 1 = 5 assignments (unverified q_unverified is excluded)
    expect(res.length).toBe(5);
    expect(res.every((q) => q.questionType === 'assignment')).toBe(true);
    expect(res.some((q) => q.id === 'q_unverified')).toBe(false);
  });

  it('Mode 4: Other Questions All Weeks includes only other questions and skips weeks without other questions with zero placeholders', () => {
    const res = filterQuestionsForTest(questionBank, {
      mode: 'other_all',
      selectedWeeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      questionType: 'other',
    });

    // w0_o1 (1) + w1_o1 (1) + w12_o1 (1) = 3
    expect(res.length).toBe(3);
    expect(res.every((q) => q.questionType === 'other')).toBe(true);
    // Week 3 has assignment but NO other questions; no fake question generated
    expect(res.some((q) => q.week === 3)).toBe(false);
  });

  it('Mode 5: All Questions Test combines all verified assignments and other questions without duplicates', () => {
    const res = filterQuestionsForTest(questionBank, {
      mode: 'all_questions',
      selectedWeeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      questionType: 'both',
    });

    // 5 assignments + 3 other questions = 8 eligible questions
    expect(res.length).toBe(8);
    const idSet = new Set(res.map((q) => q.id));
    expect(idSet.size).toBe(8);
  });
});
