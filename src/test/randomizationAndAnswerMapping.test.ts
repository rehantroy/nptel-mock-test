import { describe, it, expect } from 'vitest';
import {
  shuffleArray,
  generateTestAttempt,
  gradeAttempt,
} from '../lib/testEngine';
import type { Question, TestAttemptConfig } from '../types';

describe('Randomization & Stable Answer Mapping', () => {
  const createMockQuestion = (
    id: string,
    week: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12,
    correctIdx: number
  ): Question => {
    const options = [
      { id: `${id}_opt_a`, text: 'Alpha' },
      { id: `${id}_opt_b`, text: 'Beta' },
      { id: `${id}_opt_c`, text: 'Gamma' },
      { id: `${id}_opt_d`, text: 'Delta' },
    ];
    return {
      id,
      courseId: 'IIOT',
      week,
      questionType: 'assignment',
      originalQuestionNumber: 1,
      questionText: `Question text for ${id}`,
      options,
      correctOptionId: options[correctIdx].id,
      sourceFilename: 'mock.pdf',
      extractionStatus: 'parsed',
      verificationStatus: 'verified',
      duplicateStatus: 'unique',
      importTimestamp: new Date().toISOString(),
    };
  };

  it('preserves array elements during Fisher-Yates shuffle', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = shuffleArray(original);

    expect(shuffled.length).toBe(original.length);
    expect(new Set(shuffled)).toEqual(new Set(original));
  });

  it('shuffles answer options while keeping correctOptionId stable', () => {
    const q1 = createMockQuestion('q1', 1, 2); // correct is Gamma (id: q1_opt_c)
    const config: TestAttemptConfig = {
      mode: 'week_wise',
      selectedWeeks: [1],
      selectedWeek: 1,
      questionType: 'assignment',
    };

    const attempt = generateTestAttempt([q1], config);
    const shuffledOptionIds = attempt.shuffledOptions['q1'];

    // All original option IDs must be present in shuffled options
    expect(shuffledOptionIds.length).toBe(4);
    expect(new Set(shuffledOptionIds)).toEqual(new Set(q1.options.map((o) => o.id)));

    // Correct option ID in question definition remains unchanged
    expect(q1.correctOptionId).toBe('q1_opt_c');
  });

  it('correctly grades user selection regardless of option shuffle position', () => {
    const q1 = createMockQuestion('q1', 1, 1); // correct is Beta (q1_opt_b)
    const qMap = new Map<string, Question>([['q1', q1]]);

    const config: TestAttemptConfig = {
      mode: 'week_wise',
      selectedWeeks: [1],
      selectedWeek: 1,
      questionType: 'assignment',
    };

    // Test across 50 repeated shuffles to prove invariant
    for (let i = 0; i < 50; i++) {
      const attempt = generateTestAttempt([q1], config);

      // User selects the correct option ID (Beta)
      attempt.userAnswers['q1'] = 'q1_opt_b';

      const grade = gradeAttempt(attempt, qMap);
      expect(grade.correctCount).toBe(1);
      expect(grade.incorrectCount).toBe(0);
      expect(grade.unansweredCount).toBe(0);
      expect(grade.score).toBe(1);
      expect(grade.percentage).toBe(100);

      // User selects incorrect option ID (Alpha)
      attempt.userAnswers['q1'] = 'q1_opt_a';
      const gradeWrong = gradeAttempt(attempt, qMap);
      expect(gradeWrong.correctCount).toBe(0);
      expect(gradeWrong.incorrectCount).toBe(1);
      expect(gradeWrong.score).toBe(0);
      expect(gradeWrong.percentage).toBe(0);
    }
  });

  it('guarantees that each eligible question appears at most once per attempt', () => {
    const questions = [
      createMockQuestion('q1', 0, 0),
      createMockQuestion('q2', 0, 1),
      createMockQuestion('q3', 0, 2),
      createMockQuestion('q4', 0, 3),
    ];

    const config: TestAttemptConfig = {
      mode: 'all_week',
      selectedWeeks: [0],
      questionType: 'assignment',
    };

    const attempt = generateTestAttempt(questions, config);
    expect(attempt.questionOrder.length).toBe(4);

    const uniqueSet = new Set(attempt.questionOrder);
    expect(uniqueSet.size).toBe(4);
  });

  it('generates new randomized attempts on retry with independent IDs', () => {
    const questions = [
      createMockQuestion('q1', 1, 0),
      createMockQuestion('q2', 1, 1),
      createMockQuestion('q3', 1, 2),
      createMockQuestion('q4', 1, 3),
      createMockQuestion('q5', 1, 0),
    ];

    const config: TestAttemptConfig = {
      mode: 'week_wise',
      selectedWeeks: [1],
      selectedWeek: 1,
      questionType: 'assignment',
    };

    const attempt1 = generateTestAttempt(questions, config);
    const attempt2 = generateTestAttempt(questions, config);

    expect(attempt1.id).not.toBe(attempt2.id);
  });
});
