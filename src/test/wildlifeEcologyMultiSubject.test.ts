import { describe, it, expect, beforeEach } from 'vitest';
import {
  preloadIndustrialIoTBank,
  preloadHCIBank,
  preloadWEBank,
  getPreloadedQuestions,
  getPreloadedWEQuestions,
  getPreloadedWEQuestionsCount,
  PRELOADED_SUBJECT_ID,
  PRELOADED_HCI_SUBJECT_ID,
  PRELOADED_WE_SUBJECT_ID,
} from '../lib/preloadData';
import {
  getAllQuestions,
  clearAllQuestions,
  deleteQuestion,
  getSubjects,
  clearAttempts,
} from '../lib/storage';
import {
  filterQuestionsForTest,
  generateTestAttempt,
  gradeAttempt,
} from '../lib/testEngine';
import {
  DEFAULT_SUBJECT,
  HCI_SUBJECT,
  WILDLIFE_ECOLOGY_SUBJECT,
  type TestAttemptConfig,
  type WeekNumber,
} from '../types';

describe('Wildlife Ecology Multi-Subject Platform & 3-Way Isolation Suite', () => {
  beforeEach(async () => {
    await clearAllQuestions('all');
    await clearAttempts('all');
  });

  describe('1. Wildlife Ecology Question Bank Extraction & Data Integrity (310 Questions)', () => {
    it('contains exactly 310 preloaded Wildlife Ecology questions in total', () => {
      expect(getPreloadedWEQuestionsCount()).toBe(310);
      const qs = getPreloadedWEQuestions();
      expect(qs.length).toBe(310);
    });

    it('contains exactly 130 Assignment and 180 Other questions across Weeks 0-12', () => {
      const qs = getPreloadedWEQuestions();
      const assignments = qs.filter((q) => q.questionType === 'assignment');
      const others = qs.filter((q) => q.questionType === 'other');

      expect(assignments.length).toBe(130);
      expect(others.length).toBe(180);

      // Week 0: 10 Assignment, 0 Other
      const w0Assignments = assignments.filter((q) => q.week === 0);
      const w0Others = others.filter((q) => q.week === 0);
      expect(w0Assignments.length).toBe(10);
      expect(w0Others.length).toBe(0);

      // Weeks 1-12: 10 Assignment and 15 Other each
      for (let w = 1; w <= 12; w++) {
        const wAssignments = assignments.filter((q) => q.week === w);
        const wOthers = others.filter((q) => q.week === w);
        expect(wAssignments.length).toBe(10);
        expect(wOthers.length).toBe(15);
      }
    });

    it('maps all 310 questions accurately to Weeks 0-12 from the source PDF', () => {
      const qs = getPreloadedWEQuestions();
      for (const q of qs) {
        expect(q.week).toBeGreaterThanOrEqual(0);
        expect(q.week).toBeLessThanOrEqual(12);
        expect(q.subjectId).toBe('wildlife-ecology');
        expect(q.courseId).toBe('WE');
        expect(q.verificationStatus).toBe('verified');
      }
    });

    it('verifies that every question has 4 distinct options and a valid correct option', () => {
      const qs = getPreloadedWEQuestions();
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

    it('verifies stable question IDs and unique option IDs across all 13 weeks', () => {
      const qs = getPreloadedWEQuestions();
      const qIds = new Set<string>();
      const optIds = new Set<string>();

      // Check assignment IDs for Week 0
      for (let i = 1; i <= 10; i++) {
        const expectedId = `we_w0_q${String(i).padStart(2, '0')}`;
        const found = qs.find((q) => q.id === expectedId);
        expect(found).toBeDefined();
        expect(found?.questionType).toBe('assignment');
        expect(found?.originalQuestionNumber).toBe(i);
        expect(found?.week).toBe(0);
      }

      // Check assignment IDs for Weeks 1 to 12
      for (let w = 1; w <= 12; w++) {
        for (let i = 1; i <= 10; i++) {
          const expectedId = `we_w${w}_q${String(i).padStart(2, '0')}`;
          const found = qs.find((q) => q.id === expectedId);
          expect(found).toBeDefined();
          expect(found?.questionType).toBe('assignment');
          expect(found?.originalQuestionNumber).toBe(i);
          expect(found?.week).toBe(w);
        }
      }

      // Check extra high-probability IDs for Weeks 1 to 12
      for (let w = 1; w <= 12; w++) {
        for (let i = 1; i <= 15; i++) {
          const expectedId = `we_w${w}_e${String(i).padStart(2, '0')}`;
          const found = qs.find((q) => q.id === expectedId);
          expect(found).toBeDefined();
          expect(found?.questionType).toBe('other');
          expect(found?.originalQuestionNumber).toBe(`E${i}`);
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
      expect(qIds.size).toBe(310);
      expect(optIds.size).toBe(1240); // 310 * 4
    });
  });

  describe('2. Wildlife Ecology Preload Idempotency and Database Integrity', () => {
    it('successfully preloads 310 questions on first run and zero duplicates on subsequent runs', async () => {
      const firstRun = await preloadWEBank(false);
      expect(firstRun.success).toBe(true);
      expect(firstRun.insertedCount).toBe(310);
      expect(firstRun.totalInSubject).toBe(310);

      const inDbFirst = await getAllQuestions('wildlife-ecology');
      expect(inDbFirst.length).toBe(310);

      // Second preload should insert 0 new questions
      const secondRun = await preloadWEBank(false);
      expect(secondRun.success).toBe(true);
      expect(secondRun.insertedCount).toBe(0);
      expect(secondRun.totalInSubject).toBe(310);

      const inDbSecond = await getAllQuestions('wildlife-ecology');
      expect(inDbSecond.length).toBe(310);
    });

    it('force re-sync safely updates existing questions without duplicating', async () => {
      await preloadWEBank(false);
      const forceRes = await preloadWEBank(true);
      expect(forceRes.success).toBe(true);
      expect(forceRes.insertedCount).toBe(310);
      expect(forceRes.totalInSubject).toBe(310);

      const inDb = await getAllQuestions('wildlife-ecology');
      expect(inDb.length).toBe(310);
    });
  });

  describe('3. Strict 3-Way Subject Isolation (IIoT, HCI, and Wildlife Ecology)', () => {
    it('preloads all three subjects independently without cross-subject leakage', async () => {
      // Preload Industrial IoT (375 questions)
      const iiotRes = await preloadIndustrialIoTBank(false);
      expect(iiotRes.insertedCount).toBe(375);

      // Preload HCI (240 questions)
      const hciRes = await preloadHCIBank(false);
      expect(hciRes.insertedCount).toBe(240);

      // Preload Wildlife Ecology (310 questions)
      const weRes = await preloadWEBank(false);
      expect(weRes.insertedCount).toBe(310);

      // Query each subject separately
      const iiotQuestions = await getAllQuestions(PRELOADED_SUBJECT_ID);
      const hciQuestions = await getAllQuestions(PRELOADED_HCI_SUBJECT_ID);
      const weQuestions = await getAllQuestions(PRELOADED_WE_SUBJECT_ID);
      const allQuestions = await getAllQuestions('all');

      expect(iiotQuestions.length).toBe(375);
      expect(hciQuestions.length).toBe(240);
      expect(weQuestions.length).toBe(310);
      expect(allQuestions.length).toBe(375 + 240 + 310); // 925

      // Strict subjectId check
      expect(iiotQuestions.every((q) => q.subjectId === 'iiot')).toBe(true);
      expect(hciQuestions.every((q) => q.subjectId === 'hci')).toBe(true);
      expect(weQuestions.every((q) => q.subjectId === 'wildlife-ecology')).toBe(true);
    });

    it('re-preloading one subject does not alter or remove questions of other subjects', async () => {
      await preloadIndustrialIoTBank(false);
      await preloadHCIBank(false);
      await preloadWEBank(false);

      // Force re-sync Wildlife Ecology
      await preloadWEBank(true);

      const iiotQuestions = await getAllQuestions('iiot');
      const hciQuestions = await getAllQuestions('hci');
      const weQuestions = await getAllQuestions('wildlife-ecology');

      expect(iiotQuestions.length).toBe(375);
      expect(hciQuestions.length).toBe(240);
      expect(weQuestions.length).toBe(310);
    });

    it('deleting a Wildlife Ecology question leaves IIoT and HCI banks completely intact', async () => {
      await preloadIndustrialIoTBank(false);
      await preloadHCIBank(false);
      await preloadWEBank(false);

      expect((await getAllQuestions('wildlife-ecology')).length).toBe(310);
      expect((await getAllQuestions('iiot')).length).toBe(375);
      expect((await getAllQuestions('hci')).length).toBe(240);

      // Delete one WE question
      const deleted = await deleteQuestion('we_w0_q01');
      expect(deleted.success).toBe(true);

      const weRemaining = await getAllQuestions('wildlife-ecology');
      const iiotRemaining = await getAllQuestions('iiot');
      const hciRemaining = await getAllQuestions('hci');

      expect(weRemaining.length).toBe(309);
      expect(iiotRemaining.length).toBe(375);
      expect(hciRemaining.length).toBe(240);
    });
  });

  describe('4. Test Modes Verification for Wildlife Ecology', () => {
    let allWEQuestions: any[] = [];

    beforeEach(async () => {
      await preloadWEBank(false);
      allWEQuestions = await getAllQuestions('wildlife-ecology');
    });

    it('Mode 1 (Week-wise): generates test with specified week assignment questions only', () => {
      const targetWeeks: WeekNumber[] = [0, 1, 6, 12];
      for (const targetWeek of targetWeeks) {
        const config: TestAttemptConfig = {
          mode: 'week_wise',
          selectedWeeks: [targetWeek],
          selectedWeek: targetWeek,
          questionType: 'assignment',
          subjectId: 'wildlife-ecology',
        };

        const eligible = filterQuestionsForTest(allWEQuestions, config);
        expect(eligible.length).toBe(10);
        expect(eligible.every((q) => q.questionType === 'assignment' && q.week === targetWeek)).toBe(true);

        const attempt = generateTestAttempt(eligible, config);
        expect(attempt.subjectId).toBe('wildlife-ecology');
        expect(attempt.questionOrder.length).toBe(10);
        expect(attempt.totalEligible).toBe(10);
      }
    });

    it('Mode 2 (Custom Test): correctly filters by categories in Wildlife Ecology', () => {
      // Assignment only for Week 1 (10)
      const configAssignment: TestAttemptConfig = {
        mode: 'custom',
        selectedWeeks: [1],
        questionType: 'assignment',
        subjectId: 'wildlife-ecology',
      };
      const eligibleAssign = filterQuestionsForTest(allWEQuestions, configAssignment);
      expect(eligibleAssign.length).toBe(10);

      // Other only for Week 1 (15)
      const configOther: TestAttemptConfig = {
        mode: 'custom',
        selectedWeeks: [1],
        questionType: 'other',
        subjectId: 'wildlife-ecology',
      };
      const eligibleOther = filterQuestionsForTest(allWEQuestions, configOther);
      expect(eligibleOther.length).toBe(15);

      // Both for Week 1 (10 + 15 = 25)
      const configBoth: TestAttemptConfig = {
        mode: 'custom',
        selectedWeeks: [1],
        questionType: 'both',
        subjectId: 'wildlife-ecology',
      };
      const eligibleBoth = filterQuestionsForTest(allWEQuestions, configBoth);
      expect(eligibleBoth.length).toBe(25);

      // Both for Weeks [0, 1] (10 + 25 = 35)
      const configMultiWeek: TestAttemptConfig = {
        mode: 'custom',
        selectedWeeks: [0, 1],
        questionType: 'both',
        subjectId: 'wildlife-ecology',
      };
      const eligibleMulti = filterQuestionsForTest(allWEQuestions, configMultiWeek);
      expect(eligibleMulti.length).toBe(35);
    });

    it('Mode 3 (All Week Test): includes all 130 Wildlife Ecology assignment questions', () => {
      const config: TestAttemptConfig = {
        mode: 'all_week',
        selectedWeeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        questionType: 'assignment',
        subjectId: 'wildlife-ecology',
      };

      const eligible = filterQuestionsForTest(allWEQuestions, config);
      expect(eligible.length).toBe(130);
      expect(eligible.every((q) => q.questionType === 'assignment')).toBe(true);
    });

    it('Mode 4 (Other Questions — All Weeks): includes all 180 extra high-probability questions', () => {
      const config: TestAttemptConfig = {
        mode: 'other_all',
        selectedWeeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        questionType: 'other',
        subjectId: 'wildlife-ecology',
      };

      const eligible = filterQuestionsForTest(allWEQuestions, config);
      expect(eligible.length).toBe(180);
      expect(eligible.every((q) => q.questionType === 'other')).toBe(true);
    });

    it('Mode 5 (All Questions Test): includes all 310 verified questions strictly deduplicated', () => {
      const config: TestAttemptConfig = {
        mode: 'all_questions',
        selectedWeeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        questionType: 'both',
        subjectId: 'wildlife-ecology',
      };

      const eligible = filterQuestionsForTest(allWEQuestions, config);
      expect(eligible.length).toBe(310);

      const attempt = generateTestAttempt(eligible, config);
      expect(attempt.subjectId).toBe('wildlife-ecology');
      expect(attempt.totalEligible).toBe(310);
      expect(new Set(attempt.questionOrder).size).toBe(310);
    });

    it('grades an attempt accurately using Wildlife Ecology correct answer mappings', () => {
      const config: TestAttemptConfig = {
        mode: 'week_wise',
        selectedWeeks: [0],
        selectedWeek: 0,
        questionType: 'assignment',
        subjectId: 'wildlife-ecology',
      };
      const eligible = filterQuestionsForTest(allWEQuestions, config);
      const attempt = generateTestAttempt(eligible, config);

      // Build answers where user gets all 10 correct for Week 0
      const userAnswers: Record<string, string> = {};
      for (const q of eligible) {
        userAnswers[q.id] = q.correctOptionId;
      }
      attempt.userAnswers = userAnswers;

      const questionMap = new Map(eligible.map((q) => [q.id, q]));
      const graded = gradeAttempt(attempt, questionMap);
      expect(graded.score).toBe(10);
      expect(graded.percentage).toBe(100);
      expect(graded.correctCount).toBe(10);
      expect(graded.incorrectCount).toBe(0);
      expect(graded.unansweredCount).toBe(0);
    });
  });

  describe('5. Subjects Registry Verification with 3 Subjects', () => {
    it('initializes with Industrial IoT, HCI, and Wildlife Ecology as standard subjects', async () => {
      const subjects = await getSubjects();
      const iiot = subjects.find((s) => s.id === DEFAULT_SUBJECT.id);
      const hci = subjects.find((s) => s.id === HCI_SUBJECT.id);
      const we = subjects.find((s) => s.id === WILDLIFE_ECOLOGY_SUBJECT.id);

      expect(iiot).toBeDefined();
      expect(iiot?.name).toBe('Industrial Internet of Things');

      expect(hci).toBeDefined();
      expect(hci?.name).toBe('Human-Computer Interaction');
      expect(hci?.code).toBe('HCI');

      expect(we).toBeDefined();
      expect(we?.name).toBe('Wildlife Ecology');
      expect(we?.code).toBe('WE');
    });
  });
});
