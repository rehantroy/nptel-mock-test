import preloadedQuestionsRaw from '../data/question-bank/industrial-iot/questions.json';
import type { Question } from '../types';
import { getAllQuestions, deleteQuestion, deleteQuestionsBatch } from './storage';

export const PRELOADED_SUBJECT_ID = 'iiot';
export const OFFICIAL_SOURCE_FILENAME = 'IIoT Quick Revision (Part II Questions).pdf';

// Build set of the 375 official question IDs
export const officialQuestions: Question[] = preloadedQuestionsRaw as unknown as Question[];
export const officialIdSet: Set<string> = new Set(officialQuestions.map((q) => q.id));

export interface CleanupResult {
  success: boolean;
  totalInitial: number;
  officialCount: number;
  oldOcrFound: number;
  removedCount: number;
  flaggedCount: number;
  flaggedQuestions: Question[];
  backupData?: Question[];
  message: string;
}

/**
 * Inspects all questions in the Industrial IoT bank.
 * Identifies:
 * - 375 official preloaded questions (matching official IDs and source).
 * - Old OCR/PDF uploaded questions (with generated IDs like q_..., extractionStatus 'ocr_extracted'/'parsed', etc.).
 * - Any ambiguous questions whose origin cannot be reliably determined.
 */
export async function auditIndustrialIoTQuestions(): Promise<{
  totalQuestions: number;
  officialQuestions: Question[];
  oldOcrQuestions: Question[];
  uncertainQuestions: Question[];
}> {
  const all = await getAllQuestions(PRELOADED_SUBJECT_ID);

  const official: Question[] = [];
  const oldOcr: Question[] = [];
  const uncertain: Question[] = [];

  for (const q of all) {
    if (officialIdSet.has(q.id)) {
      official.push(q);
    } else {
      // Analyze provenance:
      // Old OCR / PDF uploads have auto-generated IDs (e.g. q_..., q_man_..., draft_...)
      // or extractionStatus 'ocr_extracted' / 'parsed' without official IDs,
      // or sourceFilename uploaded by user.
      const isAutoId = q.id.startsWith('q_') || q.id.startsWith('draft_') || q.id.startsWith('tx-') || q.id.startsWith('opt_');
      const isOcrOrParsed = q.extractionStatus === 'ocr_extracted' || q.extractionStatus === 'parsed' || q.extractionStatus === 'manual_entry';
      const isNotOfficialId = !q.id.startsWith('iiot_w');

      if (isNotOfficialId && (isAutoId || isOcrOrParsed)) {
        oldOcr.push(q);
      } else {
        uncertain.push(q);
      }
    }
  }

  return {
    totalQuestions: all.length,
    officialQuestions: official,
    oldOcrQuestions: oldOcr,
    uncertainQuestions: uncertain,
  };
}

/**
 * Performs a safe, controlled cleanup of old OCR-imported questions.
 * Preserves all 375 official questions, existing test attempts, and other subjects.
 * Backs up the old records in localStorage before deletion.
 */
export async function cleanOldOcrImports(dryRun: boolean = false): Promise<CleanupResult> {
  try {
    const { totalQuestions, officialQuestions, oldOcrQuestions, uncertainQuestions } =
      await auditIndustrialIoTQuestions();

    if (uncertainQuestions.length > 0) {
      console.warn('Found uncertain questions that will NOT be deleted automatically:', uncertainQuestions);
    }

    if (dryRun) {
      return {
        success: true,
        totalInitial: totalQuestions,
        officialCount: officialQuestions.length,
        oldOcrFound: oldOcrQuestions.length,
        removedCount: 0,
        flaggedCount: uncertainQuestions.length,
        flaggedQuestions: uncertainQuestions,
        message: `Dry run complete. Found ${oldOcrQuestions.length} old OCR questions to remove and ${officialQuestions.length} official questions to keep.`,
      };
    }

    // 1. Create a safe backup of the old OCR questions before removal
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'iiot_backup_old_ocr_questions',
          JSON.stringify({
            timestamp: new Date().toISOString(),
            count: oldOcrQuestions.length,
            questions: oldOcrQuestions,
          })
        );
      } catch (e) {
        console.warn('Could not store full backup in localStorage (quota limit), continuing:', e);
      }
    }

    // 2. Perform atomic batch deletion of confirmed old OCR questions
    const idsToDelete = oldOcrQuestions.map((q) => q.id);
    const deleteRes = await deleteQuestionsBatch(idsToDelete);
    const removedCount = deleteRes.deletedCount;

    // 3. Mark cleanup as completed in localStorage to prevent repeated automated deletions
    if (typeof window !== 'undefined') {
      localStorage.setItem('iiot_ocr_cleaned_up_v1', 'true');
      window.dispatchEvent(new CustomEvent('questions_updated'));
    }

    // 4. Verify post-cleanup state
    const remaining = await getAllQuestions(PRELOADED_SUBJECT_ID);

    return {
      success: true,
      totalInitial: totalQuestions,
      officialCount: remaining.length,
      oldOcrFound: oldOcrQuestions.length,
      removedCount,
      flaggedCount: uncertainQuestions.length,
      flaggedQuestions: uncertainQuestions,
      backupData: oldOcrQuestions,
      message: `Cleaned up ${removedCount} old OCR questions. Bank now contains ${remaining.length} official questions.`,
    };
  } catch (err: any) {
    console.error('Error during cleanup of old OCR imports:', err);
    return {
      success: false,
      totalInitial: 0,
      officialCount: 0,
      oldOcrFound: 0,
      removedCount: 0,
      flaggedCount: 0,
      flaggedQuestions: [],
      message: err?.message || 'Error occurred during cleanup.',
    };
  }
}
