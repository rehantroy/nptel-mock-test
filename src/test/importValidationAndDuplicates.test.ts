import { describe, it, expect } from 'vitest';
import {
  parseCSV,
  parseCSVQuestions,
  parseJSONQuestions,
} from '../lib/importer/csvJsonParser';
import {
  validateQuestionCandidate,
  calculateSimilarity,
  findPotentialDuplicates,
} from '../lib/validation';
import type { Question } from '../types';

describe('Import Validation & Duplicate Detection', () => {
  it('correctly parses CSV with commas inside quoted fields and quotes escaped', () => {
    const csv = `col1,col2,col3\n"value, with comma","value with ""escaped"" quote",plain`;
    const rows = parseCSV(csv);
    expect(rows.length).toBe(2);
    expect(rows[1][0]).toBe('value, with comma');
    expect(rows[1][1]).toBe('value with "escaped" quote');
    expect(rows[1][2]).toBe('plain');
  });

  it('rejects questions with invalid week numbers (< 0 or > 12)', () => {
    const badWeekCandidate = {
      id: 'q_bad_week',
      courseId: 'IIOT',
      week: 15, // Invalid week! (must be 0 to 12)
      questionType: 'assignment',
      originalQuestionNumber: 1,
      questionText: 'Test text',
      options: [
        { id: 'opt_1', text: 'Option A' },
        { id: 'opt_2', text: 'Option B' },
      ],
      correctOptionId: 'opt_1',
      sourceFilename: 'file.pdf',
    };

    const res = validateQuestionCandidate(badWeekCandidate);
    expect(res.success).toBe(false);
    expect(res.errors?.some((e) => e.includes('week'))).toBe(true);
  });

  it('rejects questions with fewer than 2 options', () => {
    const singleOptionCandidate = {
      id: 'q_single_opt',
      courseId: 'IIOT',
      week: 2,
      questionType: 'assignment',
      originalQuestionNumber: 1,
      questionText: 'Test text',
      options: [{ id: 'opt_1', text: 'Only One Option' }], // < 2 options
      correctOptionId: 'opt_1',
      sourceFilename: 'file.pdf',
    };

    const res = validateQuestionCandidate(singleOptionCandidate);
    expect(res.success).toBe(false);
    expect(res.errors?.some((e) => e.includes('options'))).toBe(true);
  });

  it('handles malformed JSON gracefully without crashing', () => {
    const malformed = '{ this is not valid json : 123 ]';
    const res = parseJSONQuestions(malformed);
    expect(res.validQuestions.length).toBe(0);
    expect(res.invalidRows.length).toBe(1);
    expect(res.invalidRows[0].errors[0]).toContain('JSON Parse error');
  });

  it('detects potential duplicate questions using token similarity', () => {
    const q1Text = 'What does MQTT stand for in Industrial Internet of Things systems?';
    const q2Text = 'In Industrial Internet of Things systems, what does MQTT stand for?'; // Same question rephrased
    const q3Text = 'Explain the difference between BLE and ZigBee protocols in smart factories.'; // Unrelated

    const sim12 = calculateSimilarity(q1Text, q2Text);
    const sim13 = calculateSimilarity(q1Text, q3Text);

    expect(sim12).toBeGreaterThan(0.75);
    expect(sim13).toBeLessThan(0.3);

    const existing: Question[] = [
      {
        id: 'q_exist_1',
        courseId: 'IIOT',
        week: 1,
        questionType: 'assignment',
        originalQuestionNumber: 1,
        questionText: q1Text,
        options: [
          { id: 'o1', text: 'A' },
          { id: 'o2', text: 'B' },
        ],
        correctOptionId: 'o1',
        sourceFilename: 'file.pdf',
        extractionStatus: 'parsed',
        verificationStatus: 'verified',
        duplicateStatus: 'unique',
        importTimestamp: new Date().toISOString(),
      },
    ];

    const dupes = findPotentialDuplicates(q2Text, existing, 0.7);
    expect(dupes.length).toBe(1);
    expect(dupes[0].id).toBe('q_exist_1');

    const noDupes = findPotentialDuplicates(q3Text, existing, 0.7);
    expect(noDupes.length).toBe(0);
  });
});
