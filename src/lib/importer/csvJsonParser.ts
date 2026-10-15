import type { Question, WeekNumber, QuestionType } from '../../types';
import { validateQuestionCandidate } from '../validation';

export interface StructuredImportResult {
  validQuestions: Question[];
  invalidRows: { row: number; data: any; errors: string[] }[];
  totalParsed: number;
}

/**
 * Parses CSV text taking quotes and newlines into consideration
 */
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      lines.push(currentRow);
    }
  }

  return lines;
}

/**
 * Parses CSV question bank file
 * Expected columns:
 * week,question_type,original_q_num,question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,source_filename,source_page
 */
export function parseCSVQuestions(csvText: string, defaultFilename = 'imported_questions.csv'): StructuredImportResult {
  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    return { validQuestions: [], invalidRows: [], totalParsed: 0 };
  }

  const headers = rows[0].map((h) => h.toLowerCase().replace(/[\s_-]/g, ''));
  const headerMap: Record<string, number> = {};
  headers.forEach((h, idx) => {
    headerMap[h] = idx;
  });

  const validQuestions: Question[] = [];
  const invalidRows: { row: number; data: any; errors: string[] }[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0 || (row.length === 1 && !row[0])) continue;

    try {
      const getVal = (colNames: string[]): string => {
        for (const name of colNames) {
          if (headerMap[name] !== undefined && row[headerMap[name]] !== undefined) {
            return row[headerMap[name]];
          }
        }
        return '';
      };

      const weekRaw = parseInt(getVal(['week', 'weeknum', 'weeknumber']), 10);
      const week: WeekNumber = (isNaN(weekRaw) || weekRaw < 0 || weekRaw > 12 ? 0 : weekRaw) as WeekNumber;

      const qTypeRaw = getVal(['questiontype', 'type', 'category']).toLowerCase();
      const questionType: QuestionType = qTypeRaw.includes('other') ? 'other' : 'assignment';

      const origQNum = getVal(['originalqnum', 'qnum', 'questionnumber', 'qno']) || String(r);
      const qText = getVal(['questiontext', 'question', 'text', 'prompt']);

      const optA = getVal(['optiona', 'opt_a', 'opta', 'a']);
      const optB = getVal(['optionb', 'opt_b', 'optb', 'b']);
      const optC = getVal(['optionc', 'opt_c', 'optc', 'c']);
      const optD = getVal(['optiond', 'opt_d', 'optd', 'd']);

      const rawCorrect = getVal(['correctanswer', 'answer', 'ans', 'correctoption', 'key']).trim().toUpperCase();
      const explanation = getVal(['explanation', 'reason', 'solution']);
      const sourceFile = getVal(['sourcefilename', 'source', 'file']) || defaultFilename;
      const pageNumRaw = parseInt(getVal(['sourcepage', 'page', 'pagenumber']), 10);
      const sourcePageNumber = isNaN(pageNumRaw) ? undefined : pageNumRaw;

      // Construct options with stable IDs
      const options: { id: string; text: string }[] = [];
      const optDefs = [
        { label: 'A', text: optA },
        { label: 'B', text: optB },
        { label: 'C', text: optC },
        { label: 'D', text: optD },
      ];

      const optionIdMap: Record<string, string> = {};

      optDefs.forEach((od, i) => {
        if (od.text) {
          const optId = `opt_${r}_${od.label.toLowerCase()}_${Math.random().toString(36).substring(2, 6)}`;
          options.push({ id: optId, text: od.text });
          optionIdMap[od.label] = optId;
          optionIdMap[String(i + 1)] = optId; // support numeric index '1' -> 'A'
        }
      });

      let correctOptionId = '';
      if (optionIdMap[rawCorrect]) {
        correctOptionId = optionIdMap[rawCorrect];
      } else if (rawCorrect.startsWith('OPT_')) {
        correctOptionId = rawCorrect;
      }

      const candidate: Question = {
        id: `q_${Date.now().toString(36)}_${r}_${Math.random().toString(36).substring(2, 6)}`,
        courseId: 'IIOT',
        week,
        questionType,
        originalQuestionNumber: origQNum,
        questionText: qText,
        options,
        correctOptionId,
        explanation: explanation || undefined,
        sourceFilename: sourceFile,
        sourcePageNumber,
        extractionStatus: 'parsed',
        verificationStatus: correctOptionId && options.length >= 2 ? 'verified' : 'needs_review',
        duplicateStatus: 'unique',
        importTimestamp: new Date().toISOString(),
      };

      const valResult = validateQuestionCandidate(candidate);
      if (valResult.success && valResult.data) {
        validQuestions.push(valResult.data);
      } else {
        invalidRows.push({
          row: r + 1,
          data: row,
          errors: valResult.errors || ['Validation failed'],
        });
      }
    } catch (err: any) {
      invalidRows.push({
        row: r + 1,
        data: row,
        errors: [err?.message || 'Failed to parse row'],
      });
    }
  }

  return {
    validQuestions,
    invalidRows,
    totalParsed: rows.length - 1,
  };
}

/**
 * Parses JSON question array
 */
export function parseJSONQuestions(jsonText: string): StructuredImportResult {
  try {
    const parsed = JSON.parse(jsonText);
    const items = Array.isArray(parsed)
      ? parsed
      : parsed.questions && Array.isArray(parsed.questions)
      ? parsed.questions
      : [parsed];

    const validQuestions: Question[] = [];
    const invalidRows: { row: number; data: any; errors: string[] }[] = [];

    items.forEach((item: any, idx: number) => {
      // Ensure required IDs exist
      if (!item.id) {
        item.id = `q_${Date.now().toString(36)}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
      }
      if (!item.courseId) item.courseId = 'IIOT';
      if (!item.importTimestamp) item.importTimestamp = new Date().toISOString();
      if (!item.extractionStatus) item.extractionStatus = 'parsed';
      if (!item.verificationStatus) item.verificationStatus = 'verified';
      if (!item.duplicateStatus) item.duplicateStatus = 'unique';

      const validation = validateQuestionCandidate(item);
      if (validation.success && validation.data) {
        validQuestions.push(validation.data);
      } else {
        invalidRows.push({
          row: idx + 1,
          data: item,
          errors: validation.errors || ['Invalid question object'],
        });
      }
    });

    return {
      validQuestions,
      invalidRows,
      totalParsed: items.length,
    };
  } catch (err: any) {
    return {
      validQuestions: [],
      invalidRows: [{ row: 0, data: null, errors: [`JSON Parse error: ${err?.message}`] }],
      totalParsed: 0,
    };
  }
}

/**
 * Returns a ready-to-use CSV template string with headers
 */
export function generateCSVTemplate(): string {
  return [
    'week,question_type,original_q_num,question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,source_filename,source_page',
    '1,assignment,1,"What does MQTT stand for in Industrial IoT?","Message Queuing Telemetry Transport","Multi-Queue Text Transmission","Machine Query Transit Target","Managed Quality Token Transfer",A,"Official MQTT specification standard","Assignment_1.pdf",1',
    '2,assignment,1,"Which layer of the IIoT reference architecture handles physical sensor interfacing?","Application Layer","Edge/Sensing Layer","Cloud Transport Layer","Business Layer",B,"Sensors operate at the sensing/edge layer","Assignment_2.pdf",2',
  ].join('\n');
}

/**
 * Returns a sample JSON question bank template
 */
export function generateJSONTemplate(): string {
  const sampleBank = {
    version: '1.0',
    courseId: 'IIOT',
    exportDate: new Date().toISOString(),
    questions: [
      {
        id: 'sample_q_1',
        courseId: 'IIOT',
        week: 1,
        questionType: 'assignment',
        originalQuestionNumber: 1,
        questionText: 'What is the primary transport layer protocol typically used by CoAP?',
        options: [
          { id: 'opt_1_a', text: 'UDP' },
          { id: 'opt_1_b', text: 'TCP' },
          { id: 'opt_1_c', text: 'SCTP' },
          { id: 'opt_1_d', text: 'ICMP' },
        ],
        correctOptionId: 'opt_1_a',
        explanation: 'CoAP is designed for constrained devices and uses UDP by default.',
        sourceFilename: 'Week1_Official_Assignment.pdf',
        sourcePageNumber: 1,
        extractionStatus: 'parsed',
        verificationStatus: 'verified',
        duplicateStatus: 'unique',
        importTimestamp: new Date().toISOString(),
      },
    ],
  };
  return JSON.stringify(sampleBank, null, 2);
}
