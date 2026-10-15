import { describe, it, expect } from 'vitest';
import {
  parseSectionHeading,
  parseInlineQuestionBlock,
  parseCombinedDocumentText,
} from '../lib/importer/inlineAnswerParser';
import { filterQuestionsForTest, generateTestAttempt, gradeAttempt } from '../lib/testEngine';
import type { Question } from '../types';

describe('Combined Upload, Dynamic Headings & Inline Answer/Explanation Extraction', () => {
  describe('Dynamic Heading Detection', () => {
    it('detects standard and varied heading formats, weeks, and dynamic categories', () => {
      const h1 = parseSectionHeading('Week 1: Assignment Question 2026');
      expect(h1).not.toBeNull();
      expect(h1?.week).toBe(1);
      expect(h1?.categoryName).toBe('Assignment Question 2026');
      expect(h1?.questionType).toBe('assignment');
      expect(h1?.needsManualReview).toBe(false);

      const h2 = parseSectionHeading('Week 2 — Assignment Questions');
      expect(h2).not.toBeNull();
      expect(h2?.week).toBe(2);
      expect(h2?.categoryName).toBe('Assignment Questions');
      expect(h2?.questionType).toBe('assignment');

      const h3 = parseSectionHeading('Week 1: Extra High Probability Questions');
      expect(h3).not.toBeNull();
      expect(h3?.week).toBe(1);
      expect(h3?.categoryName).toBe('Extra High Probability Questions');
      expect(h3?.questionType).toBe('other');

      const h4 = parseSectionHeading('Week 2: Important Numerical Questions');
      expect(h4).not.toBeNull();
      expect(h4?.week).toBe(2);
      expect(h4?.categoryName).toBe('Important Numerical Questions');
      expect(h4?.questionType).toBe('other');

      const h5 = parseSectionHeading('Week 3: Previous Year Questions');
      expect(h5).not.toBeNull();
      expect(h5?.week).toBe(3);
      expect(h5?.categoryName).toBe('Previous Year Questions');
      expect(h5?.questionType).toBe('other');

      const h6 = parseSectionHeading('Week 4: Conceptual Questions');
      expect(h6).not.toBeNull();
      expect(h6?.week).toBe(4);
      expect(h6?.categoryName).toBe('Conceptual Questions');
      expect(h6?.questionType).toBe('other');
    });

    it('handles varied capitalization, spacing, and punctuation in headings', () => {
      const hUpper = parseSectionHeading('WEEK 5 - ASSIGNMENT QUESTIONS');
      expect(hUpper?.week).toBe(5);
      expect(hUpper?.categoryName).toBe('ASSIGNMENT QUESTIONS');

      const hPunct = parseSectionHeading('Week 0: Introductory Assignment (Syllabus)');
      expect(hPunct?.week).toBe(0);
      expect(hPunct?.categoryName).toContain('Introductory Assignment');

      const hSpaced = parseSectionHeading('  Week   6   :   Advanced Practice Set   ');
      expect(hSpaced?.week).toBe(6);
      expect(hSpaced?.categoryName).toBe('Advanced Practice Set');
    });

    it('flags headings with missing or unparseable week numbers for manual review', () => {
      const hNoWeek = parseSectionHeading('General Practice Questions - Mixed Modules');
      expect(hNoWeek).not.toBeNull();
      expect(hNoWeek?.needsManualReview).toBe(true);
      expect(hNoWeek?.week).toBe(0); // Default placeholder
      expect(hNoWeek?.categoryName).toBe('General Practice Questions - Mixed Modules');
    });
  });

  describe('Inline Question, Answer, and Optional Explanation Parsing', () => {
    it('parses question with inline correct answer and explanation directly beneath', () => {
      const text = `Q1. In MQTT protocol, which quality of service level guarantees exactly-once delivery?
(A) QoS 0
(B) QoS 1
(C) QoS 2
(D) QoS 3
Correct Answer: (C) QoS 2
Explanation: QoS 2 is the highest level of service in MQTT and guarantees that each message is received only once by the counterpart using a four-step handshake.`;

      const parsed = parseInlineQuestionBlock(text, 1);
      expect(parsed).not.toBeNull();
      expect(parsed?.questionNumber).toBe(1);
      expect(parsed?.questionText).toContain('In MQTT protocol');
      expect(parsed?.options.length).toBe(4);
      expect(parsed?.options[0].text).toBe('QoS 0');
      expect(parsed?.options[1].text).toBe('QoS 1');
      expect(parsed?.options[2].text).toBe('QoS 2');
      expect(parsed?.options[3].text).toBe('QoS 3');

      // Answer matching
      expect(parsed?.matchedAnswerLabel).toBe('C');
      expect(parsed?.correctOptionId).toBe(parsed?.options[2].id);

      // Explanation
      expect(parsed?.explanation).toBeDefined();
      expect(parsed?.explanation).toContain('QoS 2 is the highest level of service in MQTT');
    });

    it('parses question with correct answer but NO explanation, leaving explanation undefined', () => {
      const text = `Q2. Which topology provides a dedicated point-to-point link to every other node?
(A) Star topology
(B) Bus topology
(C) Mesh topology
(D) Ring topology
Correct Answer: (C) Mesh topology`;

      const parsed = parseInlineQuestionBlock(text, 2);
      expect(parsed).not.toBeNull();
      expect(parsed?.questionNumber).toBe(2);
      expect(parsed?.matchedAnswerLabel).toBe('C');
      expect(parsed?.correctOptionId).toBe(parsed?.options[2].id);
      expect(parsed?.explanation).toBeUndefined();
    });

    it('recognizes varied answer and explanation labels (Ans, Answer, Solution, Detailed Solution)', () => {
      const text = `Question 3. What is the value of atmospheric pressure at sea level?
(A) 101.325 kPa
(B) 200 kPa
(C) 50 kPa
(D) 10 kPa
Ans: (A) 101.325 kPa
Detailed Solution: Standard atmospheric pressure is defined as exactly 101.325 kPa.`;

      const parsed = parseInlineQuestionBlock(text, 3);
      expect(parsed).not.toBeNull();
      expect(parsed?.matchedAnswerLabel).toBe('A');
      expect(parsed?.correctOptionId).toBe(parsed?.options[0].id);
      expect(parsed?.explanation).toContain('Standard atmospheric pressure is defined as exactly 101.325 kPa.');
    });

    it('preserves scientific and mathematical notations in question and explanation', () => {
      const text = `Q4. Calculate the concentration of H₂O and CO₂ in the sensor chamber where λ = 1.55 μm and ΔT = 25°C.
(A) 400 ppm
(B) 800 ppm
(C) 1200 ppm
(D) 1600 ppm
Correct Answer: (A) 400 ppm
Explanation: Using Beer-Lambert law, absorption at λ = 1.55 μm yields [CO₂] = 400 ppm.`;

      const parsed = parseInlineQuestionBlock(text, 4);
      expect(parsed).not.toBeNull();
      expect(parsed?.questionText).toContain('H₂O');
      expect(parsed?.questionText).toContain('CO₂');
      expect(parsed?.questionText).toContain('λ = 1.55 μm');
      expect(parsed?.questionText).toContain('ΔT = 25°C');
      expect(parsed?.explanation).toContain('λ = 1.55 μm');
    });

    it('supports alternative question numbering styles: Q.1, Question 1, E1, 1(a)', () => {
      const b1 = parseInlineQuestionBlock(`Q.5. Test text\n(A) One\n(B) Two\nCorrect Answer: (B)`, 5);
      expect(b1?.questionNumber).toBe(5);

      const b2 = parseInlineQuestionBlock(`Question 6. Test text\n(A) One\n(B) Two\nCorrect Answer: (A)`, 6);
      expect(b2?.questionNumber).toBe(6);

      const b3 = parseInlineQuestionBlock(`E7. Test text\n(A) One\n(B) Two\nCorrect Answer: (A)`, 7);
      expect(b3?.questionNumber).toBe(7);

      const b4 = parseInlineQuestionBlock(`1(a) Test subpart\n(A) One\n(B) Two\nCorrect Answer: (B)`, 1);
      expect(b4?.questionNumber).toBe('1(a)');
    });
  });

  describe('Multi-Section Combined Document Text Parsing', () => {
    it('accurately parses a complete document with multiple weeks, categories, inline answers, and optional explanations', () => {
      const doc = `
Week 1: Assignment Questions

Q1. What is the fundamental unit of an IoT system?
(A) Cloud storage
(B) Sensor/Actuator device
(C) High performance cluster
(D) Optical fiber
Correct Answer: (B) Sensor/Actuator device
Explanation: Sensors and actuators form the perception layer of any IoT deployment.

Q2. Does Zigbee operate in the 2.4 GHz ISM band?
(A) Yes
(B) No
(C) Only in sub-GHz
(D) Only in 5 GHz
Correct Answer: (A) Yes

Week 1: Extra High Probability Questions

Q3. What is the standard payload limit of standard Bluetooth LE advertising packet?
(A) 31 bytes
(B) 128 bytes
(C) 256 bytes
(D) 1024 bytes
Correct Answer: (A) 31 bytes
Explanation: Legacy BLE advertising packets carry up to 31 bytes of user payload.

Week 2: Important Numerical Questions

Q4. In a sensor network with 10 nodes transmitting 100 bytes every 10 seconds, what is total throughput?
(A) 50 B/s
(B) 100 B/s
(C) 200 B/s
(D) 500 B/s
Correct Answer: (B) 100 B/s
`;

      const sections = parseCombinedDocumentText(doc, 'iiot');

      // We expect 3 distinct sections
      expect(sections.length).toBe(3);

      // Section 1: Week 1 Assignment
      const sec1 = sections[0];
      expect(sec1.week).toBe(1);
      expect(sec1.categoryName).toBe('Assignment Questions');
      expect(sec1.questionType).toBe('assignment');
      expect(sec1.questions.length).toBe(2);

      // Q1 has explanation
      expect(sec1.questions[0].originalQuestionNumber).toBe(1);
      expect(sec1.questions[0].matchedAnswerLabel).toBe('B');
      expect(sec1.questions[0].explanation).toBeDefined();
      expect(sec1.questions[0].explanation).toContain('Sensors and actuators form the perception layer');

      // Q2 has NO explanation
      expect(sec1.questions[1].originalQuestionNumber).toBe(2);
      expect(sec1.questions[1].matchedAnswerLabel).toBe('A');
      expect(sec1.questions[1].explanation).toBeUndefined();

      // Section 2: Week 1 Extra
      const sec2 = sections[1];
      expect(sec2.week).toBe(1);
      expect(sec2.categoryName).toBe('Extra High Probability Questions');
      expect(sec2.questionType).toBe('other');
      expect(sec2.questions.length).toBe(1);
      expect(sec2.questions[0].explanation).toContain('31 bytes');

      // Section 3: Week 2 Numerical
      const sec3 = sections[2];
      expect(sec3.week).toBe(2);
      expect(sec3.categoryName).toBe('Important Numerical Questions');
      expect(sec3.questions.length).toBe(1);
      expect(sec3.questions[0].matchedAnswerLabel).toBe('B');

      // Total questions
      const totalQs = sections.reduce((acc, s) => acc + s.questions.length, 0);
      expect(totalQs).toBe(4);
    });

    it('ensures explanation text does NOT accidentally leak into the next question', () => {
      const doc = `
Week 1: Assignment Questions

Q1. Question One text?
(A) Option A
(B) Option B
Correct Answer: (A) Option A
Explanation: This is a lengthy explanation for question one describing all details.

Q2. Question Two text?
(A) Option X
(B) Option Y
Correct Answer: (B) Option Y
`;
      const sections = parseCombinedDocumentText(doc, 'iiot');
      const q1 = sections[0].questions[0];
      const q2 = sections[0].questions[1];

      expect(q1.explanation).toContain('This is a lengthy explanation');
      expect(q1.explanation).not.toContain('Question Two');
      expect(q2.questionText).toBe('Question Two text?');
      expect(q2.explanation).toBeUndefined();
    });
  });

  describe('Eligibility and Scoring with Inline Extracted Questions', () => {
    it('verifies that questions with answers and EMPTY explanations are 100% eligible for scored tests', () => {
      const questionWithoutExplanation: Question = {
        id: 'q-no-exp',
        subjectId: 'iiot',
        courseId: 'IIOT',
        week: 1,
        questionType: 'assignment',
        originalQuestionNumber: 1,
        questionText: 'Test question without explanation?',
        options: [
          { id: 'opt-1', text: 'Option 1' },
          { id: 'opt-2', text: 'Option 2' },
        ],
        correctOptionId: 'opt-2',
        explanation: undefined, // Explicitly no explanation
        extractionStatus: 'parsed',
        verificationStatus: 'verified', // Verified because correctOptionId is valid
        duplicateStatus: 'unique',
        sourceFilename: 'test_doc.pdf',
        importTimestamp: new Date().toISOString(),
      };

      const eligible = filterQuestionsForTest([questionWithoutExplanation], {
        mode: 'week_wise',
        selectedWeeks: [1],
        selectedWeek: 1,
        questionType: 'assignment',
        subjectId: 'iiot',
      });

      expect(eligible.length).toBe(1);

      // Generate test attempt
      const attempt = generateTestAttempt(eligible, {
        mode: 'week_wise',
        selectedWeeks: [1],
        selectedWeek: 1,
        questionType: 'assignment',
        subjectId: 'iiot',
      });

      // Submit correct answer
      attempt.userAnswers[questionWithoutExplanation.id] = 'opt-2';
      const questionMap = new Map([[questionWithoutExplanation.id, questionWithoutExplanation]]);
      const scored = gradeAttempt(attempt, questionMap);

      expect(scored.correctCount).toBe(1);
      expect(scored.percentage).toBe(100);
    });
  });
});
