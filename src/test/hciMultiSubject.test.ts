import { describe, it, expect, beforeEach } from 'vitest';
import {
  preloadIndustrialIoTBank,
  preloadHCIBank,
  getPreloadedQuestions,
  getPreloadedHCIQuestions,
  getPreloadedHCIQuestionsCount,
  PRELOADED_SUBJECT_ID,
  PRELOADED_HCI_SUBJECT_ID,
} from '../lib/preloadData';
import {
  getAllQuestions,
  clearAllQuestions,
  deleteQuestion,
  getSubjects,
  getAttempts,
  saveAttempt,
  clearAttempts,
} from '../lib/storage';
import {
  filterQuestionsForTest,
  generateTestAttempt,
  gradeAttempt,
} from '../lib/testEngine';
import { HCI_SUBJECT, DEFAULT_SUBJECT, type TestAttemptConfig, type WeekNumber } from '../types';

describe('HCI Multi-Subject Platform and Isolation Test Suite', () => {
  beforeEach(async () => {
    await clearAllQuestions('all');
    await clearAttempts('all');
  });

  describe('1. HCI Question Bank Extraction & Data Integrity (240 Questions across Weeks 1-12)', () => {
    it('contains exactly 240 preloaded HCI questions in total', () => {
      expect(getPreloadedHCIQuestionsCount()).toBe(240);
      const qs = getPreloadedHCIQuestions();
      expect(qs.length).toBe(240);
    });

    it('contains exactly 120 Assignment and 120 Other questions across Weeks 1-12', () => {
      const qs = getPreloadedHCIQuestions();
      const assignments = qs.filter((q) => q.questionType === 'assignment');
      const others = qs.filter((q) => q.questionType === 'other');

      expect(assignments.length).toBe(120);
      expect(others.length).toBe(120);

      // Verify each week from 1 to 12 has exactly 10 assignment and 10 other questions
      for (let w = 1; w <= 12; w++) {
        const wAssignments = assignments.filter((q) => q.week === w);
        const wOthers = others.filter((q) => q.week === w);
        expect(wAssignments.length).toBe(10);
        expect(wOthers.length).toBe(10);
      }
    });

    it('maps all 240 questions accurately to Weeks 1-12 from the source PDF', () => {
      const qs = getPreloadedHCIQuestions();
      for (const q of qs) {
        expect(q.week).toBeGreaterThanOrEqual(1);
        expect(q.week).toBeLessThanOrEqual(12);
        expect(q.subjectId).toBe('hci');
        expect(q.courseId).toBe('HCI');
        expect(q.verificationStatus).toBe('verified');
      }
    });

    it('verifies that every question has 4 distinct options and a valid correct option', () => {
      const qs = getPreloadedHCIQuestions();
      for (const q of qs) {
        expect(q.options.length).toBe(4);
        const optionIds = q.options.map((o) => o.id);
        const uniqueOptionIds = new Set(optionIds);
        expect(uniqueOptionIds.size).toBe(4);
        expect(optionIds).toContain(q.correctOptionId);

        // All options have non-empty text
        for (const opt of q.options) {
          expect(opt.text.trim().length).toBeGreaterThan(0);
        }
      }
    });

    it('verifies stable question IDs and option IDs across all 12 weeks', () => {
      const qs = getPreloadedHCIQuestions();
      const qIds = new Set<string>();
      const optIds = new Set<string>();

      // Check assignment IDs for all 12 weeks
      for (let w = 1; w <= 12; w++) {
        for (let i = 1; i <= 10; i++) {
          const expectedId = `hci_w${w}_q${String(i).padStart(2, '0')}`;
          const found = qs.find((q) => q.id === expectedId);
          expect(found).toBeDefined();
          expect(found?.questionType).toBe('assignment');
          expect(found?.originalQuestionNumber).toBe(i);
          expect(found?.week).toBe(w);
        }
      }

      // Check practice / other IDs for all 12 weeks
      for (let w = 1; w <= 12; w++) {
        for (let i = 1; i <= 10; i++) {
          const expectedId = `hci_w${w}_p${String(i).padStart(2, '0')}`;
          const found = qs.find((q) => q.id === expectedId);
          expect(found).toBeDefined();
          expect(found?.questionType).toBe('other');
          expect(found?.originalQuestionNumber).toBe(`P${i}`);
          expect(found?.week).toBe(w);
        }
      }

      // Check overall uniqueness of IDs
      for (const q of qs) {
        expect(qIds.has(q.id)).toBe(false);
        qIds.add(q.id);
        for (const opt of q.options) {
          expect(optIds.has(opt.id)).toBe(false);
          optIds.add(opt.id);
        }
      }
      expect(qIds.size).toBe(240);
      expect(optIds.size).toBe(960);
    });
  });

  describe('2. HCI Preload Idempotency and Database Integrity', () => {
    it('successfully preloads 240 questions on first run and zero duplicates on subsequent runs', async () => {
      const firstRun = await preloadHCIBank(false);
      expect(firstRun.success).toBe(true);
      expect(firstRun.insertedCount).toBe(240);
      expect(firstRun.totalInSubject).toBe(240);

      const inDbFirst = await getAllQuestions('hci');
      expect(inDbFirst.length).toBe(240);

      // Second preload should insert 0 new questions
      const secondRun = await preloadHCIBank(false);
      expect(secondRun.success).toBe(true);
      expect(secondRun.insertedCount).toBe(0);
      expect(secondRun.totalInSubject).toBe(240);

      const inDbSecond = await getAllQuestions('hci');
      expect(inDbSecond.length).toBe(240);
    });

    it('force re-sync safely updates existing questions without duplicating', async () => {
      await preloadHCIBank(false);
      const forceRes = await preloadHCIBank(true);
      expect(forceRes.success).toBe(true);
      expect(forceRes.insertedCount).toBe(240);
      expect(forceRes.totalInSubject).toBe(240);

      const inDb = await getAllQuestions('hci');
      expect(inDb.length).toBe(240);
    });
  });

  describe('3. Strict Subject Isolation between Industrial IoT and HCI', () => {
    it('preloads both subjects independently without data leakage or contamination', async () => {
      // Preload Industrial IoT (375 questions)
      const iiotRes = await preloadIndustrialIoTBank(false);
      expect(iiotRes.insertedCount).toBe(375);

      // Preload HCI (240 questions)
      const hciRes = await preloadHCIBank(false);
      expect(hciRes.insertedCount).toBe(240);

      // Query separately
      const iiotQuestions = await getAllQuestions(PRELOADED_SUBJECT_ID);
      const hciQuestions = await getAllQuestions(PRELOADED_HCI_SUBJECT_ID);
      const allQuestions = await getAllQuestions('all');

      expect(iiotQuestions.length).toBe(375);
      expect(hciQuestions.length).toBe(240);
      expect(allQuestions.length).toBe(615);

      // Ensure no IIoT questions have subjectId 'hci' and vice versa
      expect(iiotQuestions.every((q) => q.subjectId === 'iiot')).toBe(true);
      expect(hciQuestions.every((q) => q.subjectId === 'hci')).toBe(true);
    });

    it('re-preloading Industrial IoT does not overwrite or remove HCI questions', async () => {
      await preloadHCIBank(false);
      await preloadIndustrialIoTBank(false);

      // Force re-sync IIoT
      await preloadIndustrialIoTBank(true);

      const hciQuestions = await getAllQuestions('hci');
      expect(hciQuestions.length).toBe(240);

      const iiotQuestions = await getAllQuestions('iiot');
      expect(iiotQuestions.length).toBe(375);
    });

    it('deleting an HCI question leaves the Industrial IoT bank completely intact', async () => {
      await preloadIndustrialIoTBank(false);
      await preloadHCIBank(false);

      expect((await getAllQuestions('hci')).length).toBe(240);
      expect((await getAllQuestions('iiot')).length).toBe(375);

      // Delete one HCI question
      const deleted = await deleteQuestion('hci_w1_q01');
      expect(deleted.success).toBe(true);

      const hciRemaining = await getAllQuestions('hci');
      const iiotRemaining = await getAllQuestions('iiot');

      expect(hciRemaining.length).toBe(239);
      expect(iiotRemaining.length).toBe(375);
    });
  });

  describe('4. Test Modes Verification for HCI', () => {
    let allHciQuestions: any[] = [];

    beforeEach(async () => {
      await preloadHCIBank(false);
      allHciQuestions = await getAllQuestions('hci');
    });

    it('Mode 1 (Week-wise): generates test with specified week assignment questions only', () => {
      const targetWeeks: WeekNumber[] = [1, 5, 12];
      for (const targetWeek of targetWeeks) {
        const config: TestAttemptConfig = {
          mode: 'week_wise',
          selectedWeeks: [targetWeek],
          selectedWeek: targetWeek,
          questionType: 'assignment',
          subjectId: 'hci',
        };

        const eligible = filterQuestionsForTest(allHciQuestions, config);
        expect(eligible.length).toBe(10);
        expect(eligible.every((q) => q.questionType === 'assignment' && q.week === targetWeek)).toBe(true);

        const attempt = generateTestAttempt(eligible, config);
        expect(attempt.subjectId).toBe('hci');
        expect(attempt.questionOrder.length).toBe(10);
        expect(attempt.totalEligible).toBe(10);
      }
    });

    it('Mode 2 (Custom Test): correctly filters by categories in HCI', () => {
      // Assignment only for Week 1
      const configAssignment: TestAttemptConfig = {
        mode: 'custom',
        selectedWeeks: [1],
        questionType: 'assignment',
        subjectId: 'hci',
      };
      const eligibleAssign = filterQuestionsForTest(allHciQuestions, configAssignment);
      expect(eligibleAssign.length).toBe(10);

      // Other only for Week 1
      const configOther: TestAttemptConfig = {
        mode: 'custom',
        selectedWeeks: [1],
        questionType: 'other',
        subjectId: 'hci',
      };
      const eligibleOther = filterQuestionsForTest(allHciQuestions, configOther);
      expect(eligibleOther.length).toBe(10);

      // Both for Week 1
      const configBoth: TestAttemptConfig = {
        mode: 'custom',
        selectedWeeks: [1],
        questionType: 'both',
        subjectId: 'hci',
      };
      const eligibleBoth = filterQuestionsForTest(allHciQuestions, configBoth);
      expect(eligibleBoth.length).toBe(20);

      // Both for Weeks 1..3 (20 * 3 = 60)
      const configMultiWeek: TestAttemptConfig = {
        mode: 'custom',
        selectedWeeks: [1, 2, 3],
        questionType: 'both',
        subjectId: 'hci',
      };
      const eligibleMulti = filterQuestionsForTest(allHciQuestions, configMultiWeek);
      expect(eligibleMulti.length).toBe(60);
    });

    it('Mode 3 (All Week Test): includes all 120 HCI assignment questions', () => {
      const config: TestAttemptConfig = {
        mode: 'all_week',
        selectedWeeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        questionType: 'assignment',
        subjectId: 'hci',
      };

      const eligible = filterQuestionsForTest(allHciQuestions, config);
      expect(eligible.length).toBe(120);
      expect(eligible.every((q) => q.questionType === 'assignment')).toBe(true);
    });

    it('Mode 4 (Other Questions — All Weeks): includes all 120 HCI extra/probable practice questions', () => {
      const config: TestAttemptConfig = {
        mode: 'other_all',
        selectedWeeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        questionType: 'other',
        subjectId: 'hci',
      };

      const eligible = filterQuestionsForTest(allHciQuestions, config);
      expect(eligible.length).toBe(120);
      expect(eligible.every((q) => q.questionType === 'other')).toBe(true);
    });

    it('Mode 5 (All Questions Test): includes all 240 verified HCI questions strictly deduplicated', () => {
      const config: TestAttemptConfig = {
        mode: 'all_questions',
        selectedWeeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        questionType: 'both',
        subjectId: 'hci',
      };

      const eligible = filterQuestionsForTest(allHciQuestions, config);
      expect(eligible.length).toBe(240);

      const attempt = generateTestAttempt(eligible, config);
      expect(attempt.subjectId).toBe('hci');
      expect(attempt.totalEligible).toBe(240);
      expect(new Set(attempt.questionOrder).size).toBe(240);
    });

    it('grades an attempt accurately using HCI correct answer mappings', () => {
      const config: TestAttemptConfig = {
        mode: 'all_questions',
        selectedWeeks: [1],
        questionType: 'both',
        subjectId: 'hci',
      };
      const eligible = filterQuestionsForTest(allHciQuestions, config);
      const attempt = generateTestAttempt(eligible, config);

      // Build answers where user gets all correct for week 1 (20 questions)
      const userAnswers: Record<string, string> = {};
      for (const q of eligible) {
        userAnswers[q.id] = q.correctOptionId;
      }
      attempt.userAnswers = userAnswers;

      const questionMap = new Map(eligible.map((q) => [q.id, q]));
      const graded = gradeAttempt(attempt, questionMap);
      expect(graded.score).toBe(240);
      expect(graded.percentage).toBe(100);
      expect(graded.correctCount).toBe(240);
      expect(graded.incorrectCount).toBe(0);
      expect(graded.unansweredCount).toBe(0);
    });
  });

  describe('5. Subjects Registry Verification', () => {
    it('initializes with both Industrial IoT and Human-Computer Interaction as default subjects', async () => {
      const subjects = await getSubjects();
      const iiot = subjects.find((s) => s.id === DEFAULT_SUBJECT.id);
      const hci = subjects.find((s) => s.id === HCI_SUBJECT.id);

      expect(iiot).toBeDefined();
      expect(iiot?.name).toBe('Industrial Internet of Things');

      expect(hci).toBeDefined();
      expect(hci?.name).toBe('Human-Computer Interaction');
      expect(hci?.code).toBe('HCI');
    });
  });
});
