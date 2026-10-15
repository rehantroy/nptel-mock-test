import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllQuestions,
  saveQuestion,
  saveSubject,
  getSubjects,
  getAttempts,
  saveAttempt,
  clearAllQuestions,
  clearAttempts,
  setActiveSubjectId,
  getActiveSubjectId,
} from '../lib/storage';
import { filterQuestionsForTest, generateTestAttempt } from '../lib/testEngine';
import { DEFAULT_SUBJECT, type Question, type Subject, type TestAttempt, type TestAttemptConfig } from '../types';

describe('Multi-Subject Isolation and Data Safety', () => {
  const SUBJECT_A: Subject = {
    id: 'subject_a',
    name: 'Subject Alpha (IoT)',
    code: 'CS101',
    maxWeeks: 12,
    createdAt: new Date().toISOString(),
  };

  const SUBJECT_B: Subject = {
    id: 'subject_b',
    name: 'Subject Beta (Networks)',
    code: 'CS102',
    maxWeeks: 12,
    createdAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    await clearAllQuestions('all');
    await clearAttempts('all');
    await saveSubject(SUBJECT_A);
    await saveSubject(SUBJECT_B);
  });

  it('preserves default Industrial IoT subject on system initialization', async () => {
    const subjects = await getSubjects();
    const defaultSub = subjects.find((s) => s.id === DEFAULT_SUBJECT.id);
    expect(defaultSub).toBeDefined();
    expect(defaultSub?.name).toBe('Industrial Internet of Things');
  });

  it('guarantees questions from one subject NEVER appear in another subject queries', async () => {
    const qA: Question = {
      id: 'qa-1',
      subjectId: SUBJECT_A.id,
      courseId: SUBJECT_A.code,
      week: 1,
      questionType: 'assignment',
      originalQuestionNumber: 1,
      questionText: 'What is MQTT in Subject Alpha?',
      options: [
        { id: 'opt-a-1', text: 'Protocol A' },
        { id: 'opt-a-2', text: 'Protocol B' },
      ],
      correctOptionId: 'opt-a-1',
      extractionStatus: 'parsed',
      verificationStatus: 'verified',
      duplicateStatus: 'unique',
      sourceFilename: 'test_doc.pdf',
      importTimestamp: new Date().toISOString(),
    };

    const qB: Question = {
      id: 'qb-1',
      subjectId: SUBJECT_B.id,
      courseId: SUBJECT_B.code,
      week: 1, // Same week 1!
      questionType: 'assignment', // Same type!
      originalQuestionNumber: 1, // Same question number!
      questionText: 'What is BGP in Subject Beta?',
      options: [
        { id: 'opt-b-1', text: 'Routing Protocol' },
        { id: 'opt-b-2', text: 'Application Protocol' },
      ],
      correctOptionId: 'opt-b-1',
      extractionStatus: 'parsed',
      verificationStatus: 'verified',
      duplicateStatus: 'unique',
      sourceFilename: 'test_doc.pdf',
      importTimestamp: new Date().toISOString(),
    };

    await saveQuestion(qA);
    await saveQuestion(qB);

    // Query Subject A
    const resA = await getAllQuestions(SUBJECT_A.id);
    expect(resA.length).toBe(1);
    expect(resA[0].id).toBe('qa-1');
    expect(resA[0].questionText).toContain('Subject Alpha');

    // Query Subject B
    const resB = await getAllQuestions(SUBJECT_B.id);
    expect(resB.length).toBe(1);
    expect(resB[0].id).toBe('qb-1');
    expect(resB[0].questionText).toContain('Subject Beta');

    // Total cross-subject query
    const all = await getAllQuestions('all');
    expect(all.length).toBe(2);
  });

  it('handles identical week numbers and category names across subjects without mixing records in tests', async () => {
    // Both subjects have Week 2 Assignment questions
    const qA: Question = {
      id: 'qa-w2',
      subjectId: SUBJECT_A.id,
      courseId: SUBJECT_A.code,
      week: 2,
      questionType: 'assignment',
      categoryId: 'cat_assignments',
      categoryName: 'Assignment Questions',
      originalQuestionNumber: 1,
      questionText: 'Subject A - Week 2 Question',
      options: [
        { id: 'opt-1', text: 'A' },
        { id: 'opt-2', text: 'B' },
      ],
      correctOptionId: 'opt-1',
      extractionStatus: 'parsed',
      verificationStatus: 'verified',
      duplicateStatus: 'unique',
      sourceFilename: 'test_doc.pdf',
      importTimestamp: new Date().toISOString(),
    };

    const qB: Question = {
      id: 'qb-w2',
      subjectId: SUBJECT_B.id,
      courseId: SUBJECT_B.code,
      week: 2,
      questionType: 'assignment',
      categoryId: 'cat_assignments',
      categoryName: 'Assignment Questions',
      originalQuestionNumber: 1,
      questionText: 'Subject B - Week 2 Question',
      options: [
        { id: 'opt-1', text: 'X' },
        { id: 'opt-2', text: 'Y' },
      ],
      correctOptionId: 'opt-1',
      extractionStatus: 'parsed',
      verificationStatus: 'verified',
      duplicateStatus: 'unique',
      sourceFilename: 'test_doc.pdf',
      importTimestamp: new Date().toISOString(),
    };

    await saveQuestion(qA);
    await saveQuestion(qB);

    const configA: TestAttemptConfig = {
      mode: 'week_wise',
      selectedWeeks: [2],
      selectedWeek: 2,
      questionType: 'assignment',
      subjectId: SUBJECT_A.id,
    };

    const allQuestions = await getAllQuestions('all');
    const eligibleForA = filterQuestionsForTest(allQuestions, configA);

    expect(eligibleForA.length).toBe(1);
    expect(eligibleForA[0].id).toBe('qa-w2');
    expect(eligibleForA[0].subjectId).toBe(SUBJECT_A.id);
  });

  it('isolates test attempt history by subject', async () => {
    const attemptA: TestAttempt = {
      id: 'att-a-1',
      subjectId: SUBJECT_A.id,
      config: {
        mode: 'week_wise',
        selectedWeeks: [1],
        selectedWeek: 1,
        questionType: 'assignment',
        subjectId: SUBJECT_A.id,
      },
      startedAt: new Date().toISOString(),
      isCompleted: true,
      questionOrder: ['qa-1'],
      shuffledOptions: {},
      userAnswers: {},
      flaggedQuestions: {},
      totalEligible: 1,
      answeredCount: 1,
      correctCount: 1,
      incorrectCount: 0,
      unansweredCount: 0,
      score: 1,
      percentage: 100,
    };

    const attemptB: TestAttempt = {
      id: 'att-b-1',
      subjectId: SUBJECT_B.id,
      config: {
        mode: 'week_wise',
        selectedWeeks: [1],
        selectedWeek: 1,
        questionType: 'assignment',
        subjectId: SUBJECT_B.id,
      },
      startedAt: new Date().toISOString(),
      isCompleted: true,
      questionOrder: ['qb-1'],
      shuffledOptions: {},
      userAnswers: {},
      flaggedQuestions: {},
      totalEligible: 1,
      answeredCount: 1,
      correctCount: 1,
      incorrectCount: 0,
      unansweredCount: 0,
      score: 1,
      percentage: 100,
    };

    await saveAttempt(attemptA);
    await saveAttempt(attemptB);

    const attsForA = await getAttempts(SUBJECT_A.id);
    expect(attsForA.length).toBe(1);
    expect(attsForA[0].id).toBe('att-a-1');

    const attsForB = await getAttempts(SUBJECT_B.id);
    expect(attsForB.length).toBe(1);
    expect(attsForB[0].id).toBe('att-b-1');
  });

  it('safely migrates legacy records without subjectId to default iiot subject', async () => {
    const legacyQuestion: any = {
      id: 'legacy-q1',
      courseId: 'IIOT',
      week: 0,
      questionType: 'assignment',
      originalQuestionNumber: 1,
      questionText: 'Legacy IIoT Question before multi-subject upgrade',
      options: [
        { id: 'l-1', text: 'Option 1' },
        { id: 'l-2', text: 'Option 2' },
      ],
      correctOptionId: 'l-1',
      extractionStatus: 'parsed',
      verificationStatus: 'verified',
      duplicateStatus: 'unique',
      sourceFilename: 'legacy_doc.pdf',
      importTimestamp: new Date().toISOString(),
    };

    await saveQuestion(legacyQuestion);

    const iiotQuestions = await getAllQuestions('iiot');
    const found = iiotQuestions.find((q) => q.id === 'legacy-q1');
    expect(found).toBeDefined();
    expect(found?.subjectId).toBe('iiot');
  });
});
