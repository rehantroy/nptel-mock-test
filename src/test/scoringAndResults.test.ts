import { describe, it, expect } from 'vitest';
import { gradeAttempt } from '../lib/testEngine';
import type { Question, TestAttempt } from '../types';

describe('Scoring & Results Calculations', () => {
  const createQ = (id: string, correctOptId: string): Question => ({
    id,
    courseId: 'IIOT',
    week: 1,
    questionType: 'assignment',
    originalQuestionNumber: 1,
    questionText: `Question ${id}`,
    options: [
      { id: `${id}_a`, text: 'A' },
      { id: `${id}_b`, text: 'B' },
      { id: `${id}_c`, text: 'C' },
    ],
    correctOptionId: correctOptId,
    sourceFilename: 'file.pdf',
    extractionStatus: 'parsed',
    verificationStatus: 'verified',
    duplicateStatus: 'unique',
    importTimestamp: new Date().toISOString(),
  });

  it('verifies that correct + incorrect + unanswered counts sum exactly to total eligible questions', () => {
    const q1 = createQ('q1', 'q1_a');
    const q2 = createQ('q2', 'q2_b');
    const q3 = createQ('q3', 'q3_c');
    const q4 = createQ('q4', 'q4_a');

    const qMap = new Map<string, Question>([
      ['q1', q1],
      ['q2', q2],
      ['q3', q3],
      ['q4', q4],
    ]);

    const attempt: TestAttempt = {
      id: 'att_1',
      config: { mode: 'all_week', selectedWeeks: [1], questionType: 'assignment' },
      startedAt: new Date().toISOString(),
      isCompleted: false,
      questionOrder: ['q1', 'q2', 'q3', 'q4'],
      shuffledOptions: {},
      userAnswers: {
        q1: 'q1_a', // correct
        q2: 'q2_c', // incorrect (correct is q2_b)
        // q3: unanswered
        // q4: unanswered
      },
      flaggedQuestions: {},
    };

    const report = gradeAttempt(attempt, qMap);

    expect(report.totalEligible).toBe(4);
    expect(report.correctCount).toBe(1);
    expect(report.incorrectCount).toBe(1);
    expect(report.unansweredCount).toBe(2);
    expect(report.answeredCount).toBe(2);

    // Sum invariant check:
    expect(report.correctCount + report.incorrectCount + report.unansweredCount).toBe(
      report.totalEligible
    );

    // Percentage check: 1 / 4 * 100 = 25%
    expect(report.score).toBe(1);
    expect(report.percentage).toBe(25);
  });

  it('calculates score percentage correctly and accurately rounds to 1 decimal place', () => {
    const q1 = createQ('q1', 'q1_a');
    const q2 = createQ('q2', 'q2_a');
    const q3 = createQ('q3', 'q3_a');

    const qMap = new Map<string, Question>([
      ['q1', q1],
      ['q2', q2],
      ['q3', q3],
    ]);

    const attempt: TestAttempt = {
      id: 'att_2',
      config: { mode: 'all_week', selectedWeeks: [1], questionType: 'assignment' },
      startedAt: new Date().toISOString(),
      isCompleted: false,
      questionOrder: ['q1', 'q2', 'q3'],
      shuffledOptions: {},
      userAnswers: {
        q1: 'q1_a', // correct
        q2: 'q2_a', // correct
        q3: 'q3_b', // incorrect
      },
      flaggedQuestions: {},
    };

    const report = gradeAttempt(attempt, qMap);
    // 2 out of 3 = 66.7%
    expect(report.score).toBe(2);
    expect(report.percentage).toBe(66.7);
  });

  it('safely handles empty tests without division by zero errors', () => {
    const qMap = new Map<string, Question>();
    const emptyAttempt: TestAttempt = {
      id: 'att_empty',
      config: { mode: 'all_week', selectedWeeks: [1], questionType: 'assignment' },
      startedAt: new Date().toISOString(),
      isCompleted: false,
      questionOrder: [],
      shuffledOptions: {},
      userAnswers: {},
      flaggedQuestions: {},
    };

    const report = gradeAttempt(emptyAttempt, qMap);
    expect(report.totalEligible).toBe(0);
    expect(report.score).toBe(0);
    expect(report.percentage).toBe(0); // Zero division guard works!
    expect(report.correctCount).toBe(0);
    expect(report.incorrectCount).toBe(0);
    expect(report.unansweredCount).toBe(0);
  });
});
