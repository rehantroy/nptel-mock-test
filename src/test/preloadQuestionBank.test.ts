import { describe, it, expect, beforeEach } from 'vitest';
import {
  preloadIndustrialIoTBank,
  getPreloadedQuestions,
  getPreloadedQuestionsCount,
  PRELOADED_SUBJECT_ID,
} from '../lib/preloadData';
import {
  getAllQuestions,
  clearAllQuestions,
  getCategories,
} from '../lib/storage';
import {
  filterQuestionsForTest,
  generateTestAttempt,
  gradeAttempt,
} from '../lib/testEngine';
import type { Question, TestAttemptConfig, WeekNumber } from '../types';

describe('Industrial IoT Question Bank Preload & Integrity Suite', () => {
  beforeEach(async () => {
    await clearAllQuestions('all');
  });

  describe('Extracted Dataset Validation (375 Questions)', () => {
    it('has exactly 375 questions in total', () => {
      expect(getPreloadedQuestionsCount()).toBe(375);
      const qs = getPreloadedQuestions();
      expect(qs.length).toBe(375);
    });

    it('has 195 assignment questions and 180 other questions', () => {
      const qs = getPreloadedQuestions();
      const assignments = qs.filter((q) => q.questionType === 'assignment');
      const others = qs.filter((q) => q.questionType === 'other');
      expect(assignments.length).toBe(195);
      expect(others.length).toBe(180);
    });

    it('has correct distribution across Weeks 0 to 12', () => {
      const qs = getPreloadedQuestions();
      
      // Week 0: 15 assignments, 0 others
      const w0Assignments = qs.filter((q) => q.week === 0 && q.questionType === 'assignment');
      const w0Others = qs.filter((q) => q.week === 0 && q.questionType === 'other');
      expect(w0Assignments.length).toBe(15);
      expect(w0Others.length).toBe(0);

      // Weeks 1 through 12: 15 assignments and 15 others each
      for (let w = 1; w <= 12; w++) {
        const weekAssignments = qs.filter((q) => q.week === w && q.questionType === 'assignment');
        const weekOthers = qs.filter((q) => q.week === w && q.questionType === 'other');
        expect(weekAssignments.length).toBe(15);
        expect(weekOthers.length).toBe(15);
      }
    });

    it('ensures every single question has valid options and an existing correctOptionId', () => {
      const qs = getPreloadedQuestions();
      for (const q of qs) {
        expect(q.id).toBeDefined();
        expect(q.questionText.trim().length).toBeGreaterThan(0);
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        
        const optionIds = new Set(q.options.map((o) => o.id));
        expect(optionIds.has(q.correctOptionId)).toBe(true);

        // Verification status must be verified
        expect(q.verificationStatus).toBe('verified');
        expect(q.subjectId).toBe(PRELOADED_SUBJECT_ID);
        expect(q.courseId).toBe('IIOT');
      }
    });

    it('ensures all question IDs and option IDs are unique', () => {
      const qs = getPreloadedQuestions();
      const qIds = new Set<string>();
      const optIds = new Set<string>();

      for (const q of qs) {
        expect(qIds.has(q.id)).toBe(false);
        qIds.add(q.id);

        for (const opt of q.options) {
          expect(optIds.has(opt.id)).toBe(false);
          optIds.add(opt.id);
        }
      }
      expect(qIds.size).toBe(375);
    });
  });

  describe('Preload Operation Safety and Idempotence', () => {
    it('successfully preloads all 375 questions into storage on first run', async () => {
      const res = await preloadIndustrialIoTBank(false);
      expect(res.success).toBe(true);
      expect(res.insertedCount).toBe(375);
      expect(res.totalInSubject).toBe(375);

      const inDb = await getAllQuestions(PRELOADED_SUBJECT_ID);
      expect(inDb.length).toBe(375);
    });

    it('is strictly idempotent: second run does not duplicate questions', async () => {
      const firstRun = await preloadIndustrialIoTBank(false);
      expect(firstRun.insertedCount).toBe(375);

      const secondRun = await preloadIndustrialIoTBank(false);
      expect(secondRun.success).toBe(true);
      expect(secondRun.insertedCount).toBe(0);
      expect(secondRun.totalInSubject).toBe(375);

      const inDb = await getAllQuestions(PRELOADED_SUBJECT_ID);
      expect(inDb.length).toBe(375);
    });

    it('force re-sync safely refreshes questions without duplicate creation', async () => {
      await preloadIndustrialIoTBank(false);
      const resForce = await preloadIndustrialIoTBank(true);
      expect(resForce.success).toBe(true);
      expect(resForce.totalInSubject).toBe(375);

      const inDb = await getAllQuestions(PRELOADED_SUBJECT_ID);
      expect(inDb.length).toBe(375);
    });
  });

  describe('5 Test Modes Regression with Preloaded Questions', () => {
    beforeEach(async () => {
      await preloadIndustrialIoTBank(false);
    });

    it('Mode 1: week_wise filters exactly 15 assignment questions for any chosen week', async () => {
      const allQs = await getAllQuestions(PRELOADED_SUBJECT_ID);

      for (let w = 0; w <= 12; w++) {
        const config: TestAttemptConfig = {
          subjectId: PRELOADED_SUBJECT_ID,
          mode: 'week_wise',
          selectedWeeks: [w as WeekNumber],
          selectedWeek: w as WeekNumber,
          questionType: 'assignment',
        };
        const filtered = filterQuestionsForTest(allQs, config);
        expect(filtered.length).toBe(15);
        expect(filtered.every((q) => q.week === w && q.questionType === 'assignment')).toBe(true);
      }
    });

    it('Mode 2: custom mode supports multi-week, assignment, other, and both', async () => {
      const allQs = await getAllQuestions(PRELOADED_SUBJECT_ID);

      // Custom: Weeks 1, 2, 3 - assignment only
      const configAssignment: TestAttemptConfig = {
        subjectId: PRELOADED_SUBJECT_ID,
        mode: 'custom',
        selectedWeeks: [1, 2, 3],
        questionType: 'assignment',
      };
      const filteredAssignments = filterQuestionsForTest(allQs, configAssignment);
      expect(filteredAssignments.length).toBe(45); // 15 * 3

      // Custom: Weeks 1, 2, 3 - other only
      const configOther: TestAttemptConfig = {
        subjectId: PRELOADED_SUBJECT_ID,
        mode: 'custom',
        selectedWeeks: [1, 2, 3],
        questionType: 'other',
      };
      const filteredOthers = filterQuestionsForTest(allQs, configOther);
      expect(filteredOthers.length).toBe(45); // 15 * 3

      // Custom: Weeks 1, 2, 3 - both
      const configBoth: TestAttemptConfig = {
        subjectId: PRELOADED_SUBJECT_ID,
        mode: 'custom',
        selectedWeeks: [1, 2, 3],
        questionType: 'both',
      };
      const filteredBoth = filterQuestionsForTest(allQs, configBoth);
      expect(filteredBoth.length).toBe(90); // 30 * 3
    });

    it('Mode 3: all_week returns exactly 195 assignment questions across Weeks 0 to 12', async () => {
      const allQs = await getAllQuestions(PRELOADED_SUBJECT_ID);
      const config: TestAttemptConfig = {
        subjectId: PRELOADED_SUBJECT_ID,
        mode: 'all_week',
        selectedWeeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        questionType: 'assignment',
      };
      const filtered = filterQuestionsForTest(allQs, config);
      expect(filtered.length).toBe(195);
      expect(filtered.every((q) => q.questionType === 'assignment')).toBe(true);
    });

    it('Mode 4: other_all returns exactly 180 other questions across Weeks 1 to 12', async () => {
      const allQs = await getAllQuestions(PRELOADED_SUBJECT_ID);
      const config: TestAttemptConfig = {
        subjectId: PRELOADED_SUBJECT_ID,
        mode: 'other_all',
        selectedWeeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        questionType: 'other',
      };
      const filtered = filterQuestionsForTest(allQs, config);
      expect(filtered.length).toBe(180);
      expect(filtered.every((q) => q.questionType === 'other')).toBe(true);
    });

    it('Mode 5: all_questions returns all 375 questions deduplicated', async () => {
      const allQs = await getAllQuestions(PRELOADED_SUBJECT_ID);
      const config: TestAttemptConfig = {
        subjectId: PRELOADED_SUBJECT_ID,
        mode: 'all_questions',
        selectedWeeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        questionType: 'both',
      };
      const filtered = filterQuestionsForTest(allQs, config);
      expect(filtered.length).toBe(375);
    });

    it('generates a randomized test attempt and correctly grades 100% when answers match', async () => {
      const allQs = await getAllQuestions(PRELOADED_SUBJECT_ID);
      const config: TestAttemptConfig = {
        subjectId: PRELOADED_SUBJECT_ID,
        mode: 'week_wise',
        selectedWeeks: [1],
        selectedWeek: 1,
        questionType: 'assignment',
      };
      const filtered = filterQuestionsForTest(allQs, config);
      const attempt = generateTestAttempt(filtered, config);

      expect(attempt.questionOrder.length).toBe(15);

      const qMap = new Map<string, Question>();
      for (const q of filtered) {
        qMap.set(q.id, q);
      }

      // Answer every question correctly using each item's correctOptionId
      for (const qId of attempt.questionOrder) {
        const q = qMap.get(qId)!;
        attempt.userAnswers[qId] = q.correctOptionId;
      }

      const graded = gradeAttempt(attempt, qMap);
      expect(graded.score).toBe(15);
      expect(graded.totalEligible).toBe(15);
      expect(graded.percentage).toBe(100);
      expect(graded.correctCount).toBe(15);
      expect(graded.incorrectCount).toBe(0);
      expect(graded.unansweredCount).toBe(0);
    });
  });
});
