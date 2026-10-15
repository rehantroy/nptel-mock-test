import { describe, it, expect, beforeEach } from 'vitest';
import {
  cleanOldOcrImports,
  auditIndustrialIoTQuestions,
  officialQuestions,
  officialIdSet,
  PRELOADED_SUBJECT_ID,
} from '../lib/cleanupOldImports';
import {
  preloadIndustrialIoTBank,
  initializePreloadedData,
} from '../lib/preloadData';
import {
  getAllQuestions,
  saveQuestionsTransactional,
  clearAllQuestions,
  saveSubject,
  saveAttempt,
  getAttempts,
  deleteQuestion,
} from '../lib/storage';
import { filterQuestionsForTest } from '../lib/testEngine';
import type { Question, TestAttempt, TestAttemptConfig } from '../types';

describe('Legacy OCR Import Cleanup & Preload Isolation Suite', () => {
  beforeEach(async () => {
    await clearAllQuestions('all');
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('correctly audits database containing a mix of official and legacy OCR questions', async () => {
    // 1. Seed the 375 official questions
    await preloadIndustrialIoTBank(true);

    // 2. Insert mock legacy OCR questions (simulating previous web PDF imports)
    const legacyMock1: Question = {
      id: 'q_legacy_01',
      subjectId: PRELOADED_SUBJECT_ID,
      courseId: 'IIOT',
      week: 1,
      questionType: 'assignment',
      originalQuestionNumber: '1',
      questionText: 'Legacy OCR Question 1',
      options: [
        { id: 'opt_1', text: 'Option A' },
        { id: 'opt_2', text: 'Option B' },
      ],
      correctOptionId: 'opt_1',
      sourceFilename: 'old_uploaded_assignment_week1.pdf',
      extractionStatus: 'ocr_extracted',
      verificationStatus: 'verified',
      duplicateStatus: 'unique',
      importTimestamp: new Date().toISOString(),
      isOfficial: false,
      sourceType: 'user_upload',
    };

    const legacyMock2: Question = {
      id: 'q_legacy_02',
      subjectId: PRELOADED_SUBJECT_ID,
      courseId: 'IIOT',
      week: 2,
      questionType: 'other',
      originalQuestionNumber: 'E1',
      questionText: 'Legacy OCR Question 2',
      options: [
        { id: 'opt_3', text: 'Option C' },
        { id: 'opt_4', text: 'Option D' },
      ],
      correctOptionId: 'opt_3',
      sourceFilename: 'old_additional_questions.pdf',
      extractionStatus: 'parsed',
      verificationStatus: 'needs_review',
      duplicateStatus: 'unique',
      importTimestamp: new Date().toISOString(),
      isOfficial: false,
      sourceType: 'user_upload',
    };

    await saveQuestionsTransactional([legacyMock1, legacyMock2]);

    const totalBefore = await getAllQuestions(PRELOADED_SUBJECT_ID);
    expect(totalBefore.length).toBe(377);

    // 3. Run audit
    const audit = await auditIndustrialIoTQuestions();
    expect(audit.totalQuestions).toBe(377);
    expect(audit.officialQuestions.length).toBe(375);
    expect(audit.oldOcrQuestions.length).toBe(2);
    expect(audit.uncertainQuestions.length).toBe(0);
  });

  it('performs safe dry run without deleting any records', async () => {
    await preloadIndustrialIoTBank(true);

    const legacyMock: Question = {
      id: 'q_legacy_dryrun',
      subjectId: PRELOADED_SUBJECT_ID,
      courseId: 'IIOT',
      week: 3,
      questionType: 'assignment',
      originalQuestionNumber: 1,
      questionText: 'Dry run question',
      options: [
        { id: 'o1', text: 'A' },
        { id: 'o2', text: 'B' },
      ],
      correctOptionId: 'o1',
      sourceFilename: 'dryrun.pdf',
      extractionStatus: 'ocr_extracted',
      verificationStatus: 'verified',
      duplicateStatus: 'unique',
      importTimestamp: new Date().toISOString(),
      isOfficial: false,
      sourceType: 'user_upload',
    };

    await saveQuestionsTransactional([legacyMock]);

    const dryRunResult = await cleanOldOcrImports(true);
    expect(dryRunResult.success).toBe(true);
    expect(dryRunResult.oldOcrFound).toBe(1);
    expect(dryRunResult.removedCount).toBe(0);

    const checkDb = await getAllQuestions(PRELOADED_SUBJECT_ID);
    expect(checkDb.length).toBe(376);
  });

  it('removes only confirmed old OCR questions, preserves all 375 official questions and other subjects', async () => {
    await preloadIndustrialIoTBank(true);

    // Mock legacy OCR questions in 'iiot'
    const legacyQuestions: Question[] = [
      {
        id: 'q_ocr_w1_01',
        subjectId: PRELOADED_SUBJECT_ID,
        courseId: 'IIOT',
        week: 1,
        questionType: 'assignment',
        originalQuestionNumber: 1,
        questionText: 'OCR Question Week 1',
        options: [{ id: 'o1', text: 'A' }, { id: 'o2', text: 'B' }],
        correctOptionId: 'o1',
        sourceFilename: 'old_week1.pdf',
        extractionStatus: 'ocr_extracted',
        verificationStatus: 'verified',
        duplicateStatus: 'unique',
        importTimestamp: new Date().toISOString(),
      },
      {
        id: 'q_ocr_w2_01',
        subjectId: PRELOADED_SUBJECT_ID,
        courseId: 'IIOT',
        week: 2,
        questionType: 'other',
        originalQuestionNumber: 2,
        questionText: 'OCR Question Week 2',
        options: [{ id: 'o3', text: 'A' }, { id: 'o4', text: 'B' }],
        correctOptionId: 'o3',
        sourceFilename: 'old_week2.pdf',
        extractionStatus: 'parsed',
        verificationStatus: 'needs_review',
        duplicateStatus: 'unique',
        importTimestamp: new Date().toISOString(),
      },
    ];

    // Mock question in another subject (e.g. 'cloud-comp')
    const otherSubjectQuestion: Question = {
      id: 'q_cloud_01',
      subjectId: 'cloud-comp',
      courseId: 'CS601',
      week: 1,
      questionType: 'assignment',
      originalQuestionNumber: 1,
      questionText: 'Cloud Computing Q1',
      options: [{ id: 'oc1', text: 'S3' }, { id: 'oc2', text: 'EC2' }],
      correctOptionId: 'oc1',
      sourceFilename: 'cloud_lecture1.pdf',
      extractionStatus: 'parsed',
      verificationStatus: 'verified',
      duplicateStatus: 'unique',
      importTimestamp: new Date().toISOString(),
    };

    await saveQuestionsTransactional(legacyQuestions);
    await saveQuestionsTransactional([otherSubjectQuestion]);

    // Mock historical test attempt
    const mockAttempt: TestAttempt = {
      id: 'att_hist_01',
      subjectId: PRELOADED_SUBJECT_ID,
      config: {
        subjectId: PRELOADED_SUBJECT_ID,
        mode: 'week_wise',
        selectedWeeks: [1],
        questionType: 'assignment',
      },
      startedAt: '2026-03-01T10:00:00Z',
      completedAt: '2026-03-01T10:15:00Z',
      isCompleted: true,
      questionOrder: ['iiot_w1_q01'],
      shuffledOptions: {},
      userAnswers: { iiot_w1_q01: 'opt_iiot_w1_q01_b' },
      flaggedQuestions: {},
      // Conforms strictly to TestAttempt schema (no obsolete maxScore property)
      totalEligible: 1,
      answeredCount: 1,
      correctCount: 1,
      incorrectCount: 0,
      unansweredCount: 0,
      score: 1,
      percentage: 100,
    };
    await saveAttempt(mockAttempt);

    // Execute cleanup
    const cleanupResult = await cleanOldOcrImports(false);
    expect(cleanupResult.success).toBe(true);
    expect(cleanupResult.removedCount).toBe(2);
    expect(cleanupResult.officialCount).toBe(375);

    // Verify 'iiot' contains exactly 375 official questions
    const finalIiotQuestions = await getAllQuestions(PRELOADED_SUBJECT_ID);
    expect(finalIiotQuestions.length).toBe(375);
    expect(finalIiotQuestions.every((q) => officialIdSet.has(q.id))).toBe(true);

    const assignments = finalIiotQuestions.filter((q) => q.questionType === 'assignment');
    const others = finalIiotQuestions.filter((q) => q.questionType === 'other');
    expect(assignments.length).toBe(195);
    expect(others.length).toBe(180);

    // Verify other subject questions are completely unaffected
    const cloudQuestions = await getAllQuestions('cloud-comp');
    expect(cloudQuestions.length).toBe(1);
    expect(cloudQuestions[0].id).toBe('q_cloud_01');

    // Verify historical test attempt is intact
    const attempts = await getAttempts(PRELOADED_SUBJECT_ID);
    expect(attempts.length).toBe(1);
    expect(attempts[0].id).toBe('att_hist_01');
    expect(attempts[0].score).toBe(1);
  });

  it('guarantees that manual question deletion persists and is never resurrected on reload', async () => {
    await preloadIndustrialIoTBank(true);
    expect((await getAllQuestions(PRELOADED_SUBJECT_ID)).length).toBe(375);

    // Delete one question
    const targetQId = 'iiot_w0_q01';
    const delRes = await deleteQuestion(targetQId);
    expect(delRes.success).toBe(true);

    const afterDelete = await getAllQuestions(PRELOADED_SUBJECT_ID);
    expect(afterDelete.length).toBe(374);
    expect(afterDelete.some((q) => q.id === targetQId)).toBe(false);

    // Simulate page refresh / app initialization
    await initializePreloadedData();

    // Verify the question was NOT resurrected
    const afterReload = await getAllQuestions(PRELOADED_SUBJECT_ID);
    expect(afterReload.length).toBe(374);
    expect(afterReload.some((q) => q.id === targetQId)).toBe(false);
  });

  it('official test modes strictly exclude unofficial user uploads', async () => {
    await preloadIndustrialIoTBank(true);

    // Add a user uploaded assignment question
    const userUpload: Question = {
      id: 'q_custom_upload_01',
      subjectId: PRELOADED_SUBJECT_ID,
      courseId: 'IIOT',
      week: 1,
      questionType: 'assignment',
      originalQuestionNumber: 99,
      questionText: 'Custom Upload Assignment Question',
      options: [{ id: 'opt_u1', text: 'U1' }, { id: 'opt_u2', text: 'U2' }],
      correctOptionId: 'opt_u1',
      sourceFilename: 'my_uploaded_notes.pdf',
      extractionStatus: 'ocr_extracted',
      verificationStatus: 'verified',
      duplicateStatus: 'unique',
      importTimestamp: new Date().toISOString(),
      isOfficial: false,
      sourceType: 'user_upload',
    };
    await saveQuestionsTransactional([userUpload]);

    const allQs = await getAllQuestions(PRELOADED_SUBJECT_ID);
    expect(allQs.length).toBe(376);

    // Week-wise Mode 1 for Week 1 should still return only the 15 official assignment questions
    const configWeekWise: TestAttemptConfig = {
      subjectId: PRELOADED_SUBJECT_ID,
      mode: 'week_wise',
      selectedWeeks: [1],
      selectedWeek: 1,
      questionType: 'assignment',
    };
    const weekWisePool = filterQuestionsForTest(allQs, configWeekWise);
    expect(weekWisePool.length).toBe(15);
    expect(weekWisePool.some((q) => q.id === 'q_custom_upload_01')).toBe(false);

    // All Weeks Mode 3 should still return only the 195 official assignment questions
    const configAllWeek: TestAttemptConfig = {
      subjectId: PRELOADED_SUBJECT_ID,
      mode: 'all_week',
      selectedWeeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      questionType: 'assignment',
    };
    const allWeekPool = filterQuestionsForTest(allQs, configAllWeek);
    expect(allWeekPool.length).toBe(195);
    expect(allWeekPool.some((q) => q.id === 'q_custom_upload_01')).toBe(false);

    // Full Comprehensive Mode 5 should return only the 375 official questions
    const configAllQuestions: TestAttemptConfig = {
      subjectId: PRELOADED_SUBJECT_ID,
      mode: 'all_questions',
      selectedWeeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      questionType: 'both',
    };
    const allQuestionsPool = filterQuestionsForTest(allQs, configAllQuestions);
    expect(allQuestionsPool.length).toBe(375);
    expect(allQuestionsPool.some((q) => q.id === 'q_custom_upload_01')).toBe(false);
  });
});
