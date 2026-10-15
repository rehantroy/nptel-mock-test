import type {
  Question,
  TestMode,
  TestAttemptConfig,
  TestAttempt,
  WeekNumber,
} from '../types';

/**
 * Robust, cryptographically sound Fisher-Yates (Knuth) Shuffle algorithm.
 * Returns a new shuffled array without mutating the original.
 */
export function shuffleArray<T>(array: readonly T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * Filter questions based on the selected test mode and configuration.
 * Strictly enforces subject isolation and verified status.
 */
export function filterQuestionsForTest(
  allQuestions: Question[],
  config: TestAttemptConfig
): Question[] {
  // 1. Subject Isolation: if config specifies a subjectId, strictly filter by it
  let pool = allQuestions;
  if (config.subjectId) {
    pool = pool.filter((q) => (q.subjectId || 'iiot') === config.subjectId);
  }

  // 2. Only verified questions with valid answer mappings are eligible for scored tests
  // Notice: explanation is OPTIONAL. Having no explanation never prevents scoring eligibility!
  const verifiedQuestions = pool.filter(
    (q) => q.verificationStatus === 'verified' && q.correctOptionId
  );

  switch (config.mode) {
    case 'week_wise': {
      const targetWeek = config.selectedWeek ?? config.selectedWeeks[0];
      return verifiedQuestions.filter(
        (q) => q.week === targetWeek && q.questionType === 'assignment' && q.isOfficial !== false
      );
    }

    case 'custom': {
      const allowedWeeks = new Set(config.selectedWeeks);
      return verifiedQuestions.filter((q) => {
        if (!allowedWeeks.has(q.week)) return false;

        // Dynamic category filter if specified
        if (config.categoryIds && config.categoryIds.length > 0) {
          if (!q.categoryId || !config.categoryIds.includes(q.categoryId)) {
            return false;
          }
        }

        // Question type filter
        if (config.questionType === 'assignment') return q.questionType === 'assignment';
        if (config.questionType === 'other') return q.questionType === 'other';
        return true; // 'both'
      });
    }

    case 'all_week': {
      // Include all eligible original assignment questions across Week 0 through 12.
      // Exclude all additional questions and unofficial uploads.
      return verifiedQuestions.filter(
        (q) => q.questionType === 'assignment' && q.isOfficial !== false
      );
    }

    case 'other_all': {
      // Include all eligible additional questions across Week 0 through 12.
      // Exclude original assignment questions. Missing weeks are skipped automatically.
      return verifiedQuestions.filter(
        (q) => q.questionType === 'other' && q.isOfficial !== false
      );
    }

    case 'all_questions': {
      // All eligible original assignment questions AND additional questions from Week 0 to 12.
      // Deduplicated by question ID. Unofficial uploads separated into custom mode.
      const map = new Map<string, Question>();
      for (const q of verifiedQuestions) {
        if (q.isOfficial !== false && !map.has(q.id)) {
          map.set(q.id, q);
        }
      }
      return Array.from(map.values());
    }

    default:
      return [];
  }
}

/**
 * Generates a newly randomized test attempt.
 * Shuffles question order and shuffles options independently for every question.
 * Preserves stable IDs, subject isolation, and correct answer mapping.
 */
export function generateTestAttempt(
  eligibleQuestions: Question[],
  config: TestAttemptConfig
): TestAttempt {
  // Ensure no duplicate questions within one attempt
  const uniqueQuestionsMap = new Map<string, Question>();
  for (const q of eligibleQuestions) {
    uniqueQuestionsMap.set(q.id, q);
  }
  const uniqueQuestions = Array.from(uniqueQuestionsMap.values());

  // Shuffle question order
  const shuffledQuestions = shuffleArray(uniqueQuestions);
  const questionOrder = shuffledQuestions.map((q) => q.id);

  // Shuffle options for each question independently
  const shuffledOptions: Record<string, string[]> = {};
  for (const q of shuffledQuestions) {
    const optionIds = q.options.map((o) => o.id);
    shuffledOptions[q.id] = shuffleArray(optionIds);
  }

  const attemptId =
    'att_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);

  return {
    id: attemptId,
    subjectId: config.subjectId || 'iiot',
    config,
    startedAt: new Date().toISOString(),
    isCompleted: false,
    questionOrder,
    shuffledOptions,
    userAnswers: {},
    flaggedQuestions: {},
    totalEligible: questionOrder.length,
    answeredCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    unansweredCount: questionOrder.length,
  };
}

export interface ScoreReport {
  totalEligible: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  score: number;
  percentage: number;
}

/**
 * Calculates official test score and stats based on user answers.
 * Handles zero questions safely without division by zero.
 */
export function gradeAttempt(
  attempt: TestAttempt,
  questionMap: Map<string, Question>
): ScoreReport {
  const totalEligible = attempt.questionOrder.length;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  for (const qid of attempt.questionOrder) {
    const question = questionMap.get(qid);
    const selectedOptionId = attempt.userAnswers[qid];

    if (!selectedOptionId) {
      unansweredCount++;
    } else if (question && question.correctOptionId === selectedOptionId) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  }

  const score = correctCount;
  const percentage =
    totalEligible > 0 ? Math.round((correctCount / totalEligible) * 1000) / 10 : 0;
  const answeredCount = correctCount + incorrectCount;

  return {
    totalEligible,
    answeredCount,
    correctCount,
    incorrectCount,
    unansweredCount,
    score,
    percentage,
  };
}

/**
 * Returns distinct week statistics for the question bank scoped to the active subject
 */
export function computeWeekStats(questions: Question[]): Record<
  WeekNumber,
  {
    totalVerified: number;
    assignmentsVerified: number;
    otherVerified: number;
    unverified: number;
  }
> {
  const stats: Record<
    WeekNumber,
    {
      totalVerified: number;
      assignmentsVerified: number;
      otherVerified: number;
      unverified: number;
    }
  > = {
    0: { totalVerified: 0, assignmentsVerified: 0, otherVerified: 0, unverified: 0 },
    1: { totalVerified: 0, assignmentsVerified: 0, otherVerified: 0, unverified: 0 },
    2: { totalVerified: 0, assignmentsVerified: 0, otherVerified: 0, unverified: 0 },
    3: { totalVerified: 0, assignmentsVerified: 0, otherVerified: 0, unverified: 0 },
    4: { totalVerified: 0, assignmentsVerified: 0, otherVerified: 0, unverified: 0 },
    5: { totalVerified: 0, assignmentsVerified: 0, otherVerified: 0, unverified: 0 },
    6: { totalVerified: 0, assignmentsVerified: 0, otherVerified: 0, unverified: 0 },
    7: { totalVerified: 0, assignmentsVerified: 0, otherVerified: 0, unverified: 0 },
    8: { totalVerified: 0, assignmentsVerified: 0, otherVerified: 0, unverified: 0 },
    9: { totalVerified: 0, assignmentsVerified: 0, otherVerified: 0, unverified: 0 },
    10: { totalVerified: 0, assignmentsVerified: 0, otherVerified: 0, unverified: 0 },
    11: { totalVerified: 0, assignmentsVerified: 0, otherVerified: 0, unverified: 0 },
    12: { totalVerified: 0, assignmentsVerified: 0, otherVerified: 0, unverified: 0 },
  };

  for (const q of questions) {
    if (q.week >= 0 && q.week <= 12) {
      if (q.verificationStatus === 'verified') {
        stats[q.week].totalVerified++;
        if (q.questionType === 'assignment') {
          stats[q.week].assignmentsVerified++;
        } else {
          stats[q.week].otherVerified++;
        }
      } else {
        stats[q.week].unverified++;
      }
    }
  }

  return stats;
}
