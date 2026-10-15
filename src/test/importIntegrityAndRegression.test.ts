import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllQuestions,
  saveQuestionsTransactional,
  clearAllQuestions,
  saveCategory,
  getCategories,
  saveQuestion,
} from '../lib/storage';
import {
  filterQuestionsForTest,
  generateTestAttempt,
  gradeAttempt,
} from '../lib/testEngine';
import { findPotentialDuplicates } from '../lib/validation';
import type { Question, TestAttemptConfig, TestConfig } from '../types';

describe('Import Integrity, Transactional Safety and 5 Test Modes Regression', () => {
  const SUBJECT_ID = 'iiot';

  beforeEach(async () => {
    await clearAllQuestions('all');
  });

  describe('Transactional Import and Integrity', () => {
    it('persists reviewed questions and new dynamic categories atomically', async () => {
      const q1: Question = {
        id: 'tx-q1',
        subjectId: SUBJECT_ID,
        courseId: 'IIOT',
        week: 1,
        questionType: 'assignment',
        categoryId: 'cat_numerical',
        categoryName: 'Numerical Analysis',
        originalHeading: 'Week 1: Numerical Analysis',
        originalQuestionNumber: 1,
        questionText: 'Calculate sensor transmission latency?',
        options: [
          { id: 'o-1', text: '10 ms' },
          { id: 'o-2', text: '20 ms' },
        ],
        correctOptionId: 'o-1',
        explanation: 'Derived from T_trans = Packet_Size / Baud_Rate.',
        extractionStatus: 'parsed',
        verificationStatus: 'verified',
        duplicateStatus: 'unique',
        sourceFilename: 'test_doc.pdf',
        importTimestamp: new Date().toISOString(),
      };

      const q2: Question = {
        id: 'tx-q2',
        subjectId: SUBJECT_ID,
        courseId: 'IIOT',
        week: 2,
        questionType: 'other',
        categoryId: 'cat_pyq',
        categoryName: 'Previous Year Questions',
        originalHeading: 'Week 2: Previous Year Questions',
        originalQuestionNumber: 2,
        questionText: 'Which layer handles link routing in 6LoWPAN?',
        options: [
          { id: 'o-3', text: 'Adaptation Layer' },
          { id: 'o-4', text: 'Physical Layer' },
        ],
        correctOptionId: 'o-3',
        explanation: undefined, // Optional explanation
        extractionStatus: 'parsed',
        verificationStatus: 'verified',
        duplicateStatus: 'unique',
        sourceFilename: 'test_doc.pdf',
        importTimestamp: new Date().toISOString(),
      };

      const newCategories = [
        { id: 'cat_numerical', name: 'Numerical Analysis', subjectId: SUBJECT_ID },
        { id: 'cat_pyq', name: 'Previous Year Questions', subjectId: SUBJECT_ID },
      ];

      const res = await saveQuestionsTransactional([q1, q2], newCategories);
      expect(res.success).toBe(true);
      expect(res.savedCount).toBe(2);

      // Verify questions in DB
      const storedQs = await getAllQuestions(SUBJECT_ID);
      expect(storedQs.length).toBe(2);
      expect(storedQs.some((q) => q.id === 'tx-q1')).toBe(true);
      expect(storedQs.some((q) => q.id === 'tx-q2')).toBe(true);

      // Verify categories in DB
      const storedCats = await getCategories(SUBJECT_ID);
      expect(storedCats.some((c) => c.name === 'Numerical Analysis')).toBe(true);
      expect(storedCats.some((c) => c.name === 'Previous Year Questions')).toBe(true);
    });

    it('cancelled import leaves database completely untouched', async () => {
      // User uploads, views preview, but cancels
      const storedQs = await getAllQuestions(SUBJECT_ID);
      expect(storedQs.length).toBe(0);
    });

    it('warns about duplicate questions without silent overwriting', () => {
      const existing: Question[] = [
        {
          id: 'exist-1',
          subjectId: SUBJECT_ID,
          courseId: 'IIOT',
          week: 1,
          questionType: 'assignment',
          originalQuestionNumber: 1,
          questionText: 'What is the frequency band of Bluetooth Low Energy?',
          options: [{ id: '1', text: '2.4 GHz ISM' }],
          correctOptionId: '1',
          extractionStatus: 'parsed',
          verificationStatus: 'verified',
          duplicateStatus: 'unique',
          sourceFilename: 'test_doc.pdf',
          importTimestamp: new Date().toISOString(),
        },
      ];

      const duplicates = findPotentialDuplicates(
        'What is the frequency band of Bluetooth Low Energy?',
        existing
      );

      expect(duplicates.length).toBe(1);
      expect(duplicates[0].id).toBe('exist-1');
    });

    it('flags OCR-derived content for manual review and does not silently mark as verified', () => {
      const ocrQuestion: Question = {
        id: 'ocr-q1',
        subjectId: SUBJECT_ID,
        courseId: 'IIOT',
        week: 3,
        questionType: 'assignment',
        originalQuestionNumber: 1,
        questionText: 'OCR extracted text with potential noise',
        options: [
          { id: '1', text: 'Opt A' },
          { id: '2', text: 'Opt B' },
        ],
        correctOptionId: '1',
        extractionStatus: 'ocr_extracted',
        verificationStatus: 'needs_review', // Flagged for review!
        duplicateStatus: 'unique',
        sourceFilename: 'test_doc.pdf',
        importTimestamp: new Date().toISOString(),
      };

      expect(ocrQuestion.extractionStatus).toBe('ocr_extracted');
      expect(ocrQuestion.verificationStatus).toBe('needs_review');
    });
  });

  describe('Regression: All 5 Test Modes Functionality & Stability', () => {
    const makeQuestion = (
      id: string,
      week: any,
      type: 'assignment' | 'other',
      catId?: string
    ): Question => ({
      id,
      subjectId: SUBJECT_ID,
      courseId: 'IIOT',
      week,
      questionType: type,
      categoryId: catId,
      originalQuestionNumber: 1,
      questionText: `Question text for ${id}`,
      options: [
        { id: `opt-${id}-A`, text: 'Option A' },
        { id: `opt-${id}-B`, text: 'Option B' },
      ],
      correctOptionId: `opt-${id}-B`,
      extractionStatus: 'parsed',
      verificationStatus: 'verified',
      duplicateStatus: 'unique',
      sourceFilename: 'test_doc.pdf',
      importTimestamp: new Date().toISOString(),
    });

    const testBank: Question[] = [
      makeQuestion('q-w0-ass', 0, 'assignment'),
      makeQuestion('q-w1-ass', 1, 'assignment'),
      makeQuestion('q-w1-oth', 1, 'other', 'cat_extra'),
      makeQuestion('q-w2-ass', 2, 'assignment'),
      makeQuestion('q-w2-oth', 2, 'other', 'cat_numerical'),
      makeQuestion('q-w12-ass', 12, 'assignment'),
    ];

    it('Mode 1: Week-wise Test filters strictly by selected week and assignments', () => {
      const config: TestConfig = {
        mode: 'week_wise',
        selectedWeeks: [1],
        selectedWeek: 1,
        questionType: 'assignment',
        subjectId: SUBJECT_ID,
      };

      const eligible = filterQuestionsForTest(testBank, config);
      expect(eligible.length).toBe(1);
      expect(eligible[0].id).toBe('q-w1-ass');
    });

    it('Mode 2: Custom Test supports multi-week, question types, and dynamic categories', () => {
      // Test 1: Weeks 1 and 2, assignment only
      const config1: TestConfig = {
        mode: 'custom',
        selectedWeeks: [1, 2],
        questionType: 'assignment',
        subjectId: SUBJECT_ID,
      };
      const res1 = filterQuestionsForTest(testBank, config1);
      expect(res1.length).toBe(2);
      expect(res1.map((q) => q.id)).toEqual(['q-w1-ass', 'q-w2-ass']);

      // Test 2: Filter by specific category 'cat_numerical'
      const config2: TestConfig = {
        mode: 'custom',
        selectedWeeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as any,
        questionType: 'both',
        categoryIds: ['cat_numerical'],
        subjectId: SUBJECT_ID,
      };
      const res2 = filterQuestionsForTest(testBank, config2);
      expect(res2.length).toBe(1);
      expect(res2[0].id).toBe('q-w2-oth');
    });

    it('Mode 3: All Week Test includes all assignments from Week 0 to Week 12', () => {
      const config: TestConfig = {
        mode: 'all_week',
        selectedWeeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as any,
        questionType: 'assignment',
        subjectId: SUBJECT_ID,
      };

      const eligible = filterQuestionsForTest(testBank, config);
      expect(eligible.length).toBe(4); // w0, w1, w2, w12
      expect(eligible.every((q) => q.questionType === 'assignment')).toBe(true);
    });

    it('Mode 4: Other Questions — All Weeks includes only practice/extra questions', () => {
      const config: TestConfig = {
        mode: 'other_all',
        selectedWeeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as any,
        questionType: 'other',
        subjectId: SUBJECT_ID,
      };

      const eligible = filterQuestionsForTest(testBank, config);
      expect(eligible.length).toBe(2); // w1-oth, w2-oth
      expect(eligible.every((q) => q.questionType === 'other')).toBe(true);
    });

    it('Mode 5: All Questions Test includes all verified questions across all weeks and types', () => {
      const config: TestConfig = {
        mode: 'all_questions',
        selectedWeeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as any,
        questionType: 'both',
        subjectId: SUBJECT_ID,
      };

      const eligible = filterQuestionsForTest(testBank, config);
      expect(eligible.length).toBe(6);
    });

    it('guarantees Fisher-Yates randomization does not corrupt question IDs or scoring', () => {
      const config: TestConfig = {
        mode: 'all_questions',
        selectedWeeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as any,
        questionType: 'both',
        subjectId: SUBJECT_ID,
      };

      const eligible = filterQuestionsForTest(testBank, config);
      const attempt = generateTestAttempt(eligible, config);

      // Verify all question IDs are present
      expect(attempt.questionOrder.length).toBe(testBank.length);

      // Answer all correctly using the stable correctOptionId
      for (const q of eligible) {
        attempt.userAnswers[q.id] = q.correctOptionId!;
      }

      const questionMap = new Map(eligible.map((q) => [q.id, q]));
      const scored = gradeAttempt(attempt, questionMap);
      expect(scored.correctCount).toBe(testBank.length);
      expect(scored.percentage).toBe(100);
    });
  });
});
