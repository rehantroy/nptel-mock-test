import { describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  getAllQuestions,
  getQuestion,
  saveQuestion,
  saveQuestionsTransactional,
  deleteQuestion,
  clearAllQuestions,
  saveAttempt,
  getAttempt,
  clearAttempts,
  saveSubject,
  setActiveSubjectId,
} from '../lib/storage';
import { gradeAttempt, generateTestAttempt } from '../lib/testEngine';
import { QuestionBank } from '../pages/QuestionBank';
import type { Question, TestAttempt, TestAttemptConfig, Subject } from '../types';

describe('Question Deletion - Persistence and Data Protection', () => {
  const SUBJECT_1: Subject = {
    id: 'iiot',
    name: 'Industrial Internet of Things',
    code: 'CS101',
    maxWeeks: 12,
    createdAt: new Date().toISOString(),
  };

  const SUBJECT_2: Subject = {
    id: 'robotics',
    name: 'Robotics Engineering',
    code: 'ROB201',
    maxWeeks: 12,
    createdAt: new Date().toISOString(),
  };

  const createSampleQuestion = (
    id: string,
    week: number,
    cat: string,
    subjectId: string = 'iiot',
    qNum: string = '1'
  ): Question => ({
    id,
    subjectId,
    courseId: subjectId.toUpperCase(),
    week: week as any,
    questionType: 'assignment',
    categoryId: cat,
    categoryName: cat.toUpperCase(),
    originalQuestionNumber: qNum,
    questionText: `Sample question text for ${id}`,
    options: [
      { id: `${id}_opt_a`, text: 'Option A' },
      { id: `${id}_opt_b`, text: 'Option B' },
      { id: `${id}_opt_c`, text: 'Option C' },
    ],
    correctOptionId: `${id}_opt_a`,
    explanation: `Explanation for ${id}`,
    sourceFilename: 'Assignment_Doc.pdf',
    extractionStatus: 'manual_entry',
    verificationStatus: 'verified',
    duplicateStatus: 'unique',
    importTimestamp: new Date().toISOString(),
  });

  beforeEach(async () => {
    setActiveSubjectId('iiot');
    await clearAllQuestions('all');
    await clearAttempts('all');
    await saveSubject(SUBJECT_1);
    await saveSubject(SUBJECT_2);
  });

  it('deletes the exact question by its stable ID from persistent storage', async () => {
    const q1 = createSampleQuestion('q-delete-target', 1, 'cat1');
    const q2 = createSampleQuestion('q-preserve-1', 1, 'cat1');
    await saveQuestionsTransactional([q1, q2]);

    // Verify initial storage state
    const before = await getAllQuestions('iiot');
    expect(before.length).toBe(2);

    // Perform deletion
    const res = await deleteQuestion('q-delete-target');
    expect(res.success).toBe(true);

    // Verify target question is gone
    const targetQ = await getQuestion('q-delete-target');
    expect(targetQ).toBeNull();

    // Verify persistent storage via getAllQuestions
    const after = await getAllQuestions('iiot');
    expect(after.length).toBe(1);
    expect(after[0].id).toBe('q-preserve-1');
  });

  it('refreshing or re-querying does NOT restore the deleted question', async () => {
    const q1 = createSampleQuestion('q-reload-test', 2, 'catA');
    await saveQuestion(q1);

    expect(await getQuestion('q-reload-test')).not.toBeNull();

    const res = await deleteQuestion('q-reload-test');
    expect(res.success).toBe(true);

    // Simulate page reloads / fresh database queries
    for (let i = 0; i < 3; i++) {
      const allQs = await getAllQuestions('iiot');
      expect(allQs.some((q) => q.id === 'q-reload-test')).toBe(false);
      const single = await getQuestion('q-reload-test');
      expect(single).toBeNull();
    }
  });

  it('protects other questions in the same week, category, and other subjects', async () => {
    const qTarget = createSampleQuestion('q-target', 3, 'sensors', 'iiot', '1');
    const qSameWeekSameCat = createSampleQuestion('q-same-week-cat', 3, 'sensors', 'iiot', '2');
    const qSameWeekDiffCat = createSampleQuestion('q-same-week-diff-cat', 3, 'actuators', 'iiot', '3');
    const qDiffWeek = createSampleQuestion('q-diff-week', 4, 'sensors', 'iiot', '4');
    const qDiffSubject = createSampleQuestion('q-diff-subject', 3, 'sensors', 'robotics', '1');

    await saveQuestionsTransactional([
      qTarget,
      qSameWeekSameCat,
      qSameWeekDiffCat,
      qDiffWeek,
      qDiffSubject,
    ]);

    // Delete only the target question
    const res = await deleteQuestion('q-target');
    expect(res.success).toBe(true);

    // Check IIoT questions
    const iiotQuestions = await getAllQuestions('iiot');
    expect(iiotQuestions.length).toBe(3);
    const ids = iiotQuestions.map((q) => q.id);
    expect(ids).toContain('q-same-week-cat');
    expect(ids).toContain('q-same-week-diff-cat');
    expect(ids).toContain('q-diff-week');
    expect(ids).not.toContain('q-target');

    // Confirm options and explanation on remaining question remain completely intact
    const preservedQ = iiotQuestions.find((q) => q.id === 'q-same-week-cat')!;
    expect(preservedQ.options.length).toBe(3);
    expect(preservedQ.correctOptionId).toBe('q-same-week-cat_opt_a');
    expect(preservedQ.explanation).toBe('Explanation for q-same-week-cat');

    // Check robotics subject remains completely untouched
    const robQuestions = await getAllQuestions('robotics');
    expect(robQuestions.length).toBe(1);
    expect(robQuestions[0].id).toBe('q-diff-subject');
  });

  it('returns an error and keeps question intact when storage operation fails', async () => {
    // Attempting to delete with empty or invalid ID
    const resEmpty = await deleteQuestion('');
    expect(resEmpty.success).toBe(false);
    expect(resEmpty.error).toMatch(/valid question ID is required/i);

    const q1 = createSampleQuestion('q-fail-test', 1, 'cat1');
    await saveQuestion(q1);

    // Question still exists
    const q = await getQuestion('q-fail-test');
    expect(q).not.toBeNull();
  });

  it('protects historical test attempts and calculated scores when referenced question is deleted', async () => {
    const q1 = createSampleQuestion('q-att-1', 1, 'cat1');
    const q2 = createSampleQuestion('q-att-2', 1, 'cat1');
    await saveQuestionsTransactional([q1, q2]);

    const qMap = new Map<string, Question>([
      [q1.id, q1],
      [q2.id, q2],
    ]);

    const config: TestAttemptConfig = {
      subjectId: 'iiot',
      mode: 'week_wise',
      selectedWeeks: [1],
      selectedWeek: 1,
      questionType: 'assignment',
    };

    const attempt = generateTestAttempt([q1, q2], config);
    attempt.userAnswers[q1.id] = q1.correctOptionId; // Correct
    attempt.userAnswers[q2.id] = 'wrong_opt'; // Incorrect

    // Grade and complete attempt
    const report = gradeAttempt(attempt, qMap);
    const completedAttempt: TestAttempt = {
      ...attempt,
      ...report,
      isCompleted: true,
      completedAt: new Date().toISOString(),
    };

    await saveAttempt(completedAttempt);

    // Verify initial score
    expect(completedAttempt.score).toBe(1);
    expect(completedAttempt.percentage).toBe(50);
    expect(completedAttempt.totalEligible).toBe(2);

    // Now delete q1 from the active question bank
    const delRes = await deleteQuestion(q1.id);
    expect(delRes.success).toBe(true);

    // Verify q1 is gone from bank
    expect(await getQuestion(q1.id)).toBeNull();

    // Verify historical attempt record in storage is 100% preserved
    const retrievedAttempt = await getAttempt(completedAttempt.id);
    expect(retrievedAttempt).not.toBeNull();
    expect(retrievedAttempt?.score).toBe(1);
    expect(retrievedAttempt?.percentage).toBe(50);
    expect(retrievedAttempt?.totalEligible).toBe(2);
    expect(retrievedAttempt?.correctCount).toBe(1);
    expect(retrievedAttempt?.incorrectCount).toBe(1);
    expect(retrievedAttempt?.questionOrder).toContain(q1.id);
    expect(retrievedAttempt?.userAnswers[q1.id]).toBe(q1.correctOptionId);
  });
});

describe('QuestionBank UI Component Deletion Workflow', () => {
  const createMockQuestion = (id: string, qNum: string, text: string): Question => ({
    id,
    subjectId: 'iiot',
    courseId: 'CS101',
    week: 1,
    questionType: 'assignment',
    categoryId: 'assignment',
    categoryName: 'Assignments',
    originalQuestionNumber: qNum,
    questionText: text,
    options: [
      { id: `${id}_a`, text: 'Option Alpha' },
      { id: `${id}_b`, text: 'Option Beta' },
    ],
    correctOptionId: `${id}_a`,
    sourceFilename: 'mock.pdf',
    extractionStatus: 'manual_entry',
    verificationStatus: 'verified',
    duplicateStatus: 'unique',
    importTimestamp: new Date().toISOString(),
  });

  beforeEach(async () => {
    setActiveSubjectId('iiot');
    await clearAllQuestions('all');
    await clearAttempts('all');
  });

  it('opens confirmation modal on clicking Delete button and preserves question on Cancel', async () => {
    const user = userEvent.setup();
    const q1 = createMockQuestion('q-ui-1', '101', 'What is industrial gateway architecture?');
    await saveQuestion(q1);

    render(
      <MemoryRouter>
        <QuestionBank />
      </MemoryRouter>
    );

    // Wait for question to render
    expect(await screen.findByText('What is industrial gateway architecture?')).toBeInTheDocument();

    // Click Delete button on question card
    const deleteBtn = screen.getByTestId('delete-question-q-ui-1');
    await user.click(deleteBtn);

    // Confirmation modal should appear with question details
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Delete Question?')).toBeInTheDocument();
    expect(within(dialog).getByText(/Orig Q#101/)).toBeInTheDocument();

    // Click Cancel
    const cancelBtn = screen.getByTestId('cancel-delete-btn');
    await user.click(cancelBtn);

    // Modal should close and question should remain in DOM
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByText('What is industrial gateway architecture?')).toBeInTheDocument();

    // Verify question is still in database
    const inDb = await getQuestion('q-ui-1');
    expect(inDb).not.toBeNull();
  });

  it('deletes question immediately from UI and storage when confirmed, and shows success message', async () => {
    const user = userEvent.setup();
    const q1 = createMockQuestion('q-ui-del', '102', 'Which layer handles MQTT telemetry?');
    const q2 = createMockQuestion('q-ui-keep', '103', 'What is OPC UA unified architecture?');
    await saveQuestionsTransactional([q1, q2]);

    render(
      <MemoryRouter>
        <QuestionBank />
      </MemoryRouter>
    );

    expect(await screen.findByText('Which layer handles MQTT telemetry?')).toBeInTheDocument();
    expect(screen.getByText('What is OPC UA unified architecture?')).toBeInTheDocument();

    // Click delete on q1
    const deleteBtn = screen.getByTestId('delete-question-q-ui-del');
    await user.click(deleteBtn);

    // Confirm deletion
    const confirmBtn = await screen.findByTestId('confirm-delete-btn');
    await user.click(confirmBtn);

    // Success feedback banner appears
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Question #102 was successfully deleted/i);

    // q1 is immediately removed from list
    expect(screen.queryByText('Which layer handles MQTT telemetry?')).not.toBeInTheDocument();

    // q2 remains visible
    expect(screen.getByText('What is OPC UA unified architecture?')).toBeInTheDocument();

    // Verify storage persistence
    expect(await getQuestion('q-ui-del')).toBeNull();
    expect(await getQuestion('q-ui-keep')).not.toBeNull();
  });

  it('allows deleting question from within the Question Editor modal and closes it', async () => {
    const user = userEvent.setup();
    const q1 = createMockQuestion('q-edit-del', '104', 'Explain industrial Ethernet determinism.');
    await saveQuestion(q1);

    render(
      <MemoryRouter>
        <QuestionBank />
      </MemoryRouter>
    );

    expect(await screen.findByText('Explain industrial Ethernet determinism.')).toBeInTheDocument();

    // Open Edit modal
    const editBtn = screen.getByTestId('edit-question-q-edit-del');
    await user.click(editBtn);

    // Edit modal should be open
    expect(await screen.findByText('Edit Question')).toBeInTheDocument();

    // Click Delete Question button inside the edit modal
    const modalDeleteBtn = screen.getByTestId('edit-modal-delete-btn');
    await user.click(modalDeleteBtn);

    // Confirmation dialog should be open
    const confirmBtn = await screen.findByTestId('confirm-delete-btn');
    await user.click(confirmBtn);

    // Both confirmation modal and editor modal should be closed
    await waitFor(() => {
      expect(screen.queryByText('Edit Question')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Success banner displayed
    expect(await screen.findByRole('alert')).toHaveTextContent(/Question #104 was successfully deleted/i);

    // Question no longer in list
    expect(screen.queryByText('Explain industrial Ethernet determinism.')).not.toBeInTheDocument();

    // Database check
    expect(await getQuestion('q-edit-del')).toBeNull();
  });

  it('works seamlessly under active search and category filters', async () => {
    const user = userEvent.setup();
    const q1 = createMockQuestion('q-filter-1', '201', 'CoAP protocol characteristics');
    const q2 = createMockQuestion('q-filter-2', '202', 'Modbus RTU over RS-485');
    await saveQuestionsTransactional([q1, q2]);

    render(
      <MemoryRouter>
        <QuestionBank />
      </MemoryRouter>
    );

    expect(await screen.findByText('CoAP protocol characteristics')).toBeInTheDocument();

    // Type in search filter
    const searchInput = screen.getByPlaceholderText(/Search by question text/i);
    await user.type(searchInput, 'Modbus');

    // Only q2 should be visible
    expect(screen.queryByText('CoAP protocol characteristics')).not.toBeInTheDocument();
    expect(screen.getByText('Modbus RTU over RS-485')).toBeInTheDocument();

    // Delete q2 while filtered
    const deleteBtn = screen.getByTestId('delete-question-q-filter-2');
    await user.click(deleteBtn);

    const confirmBtn = await screen.findByTestId('confirm-delete-btn');
    await user.click(confirmBtn);

    // Success message
    expect(await screen.findByRole('alert')).toHaveTextContent(/Question #202 was successfully deleted/i);
    expect(screen.queryByText('Modbus RTU over RS-485')).not.toBeInTheDocument();

    // Clear search filter
    await user.clear(searchInput);

    // q1 should still be visible and intact
    expect(await screen.findByText('CoAP protocol characteristics')).toBeInTheDocument();
  });
});
