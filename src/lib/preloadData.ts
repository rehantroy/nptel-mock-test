import preloadedQuestionsRaw from '../data/question-bank/industrial-iot/questions.json';
import preloadedCategoriesRaw from '../data/question-bank/industrial-iot/categories.json';
import type { Question, QuestionCategory } from '../types';
import {
  getAllQuestions,
  saveQuestionsTransactional,
  saveCategory,
  getCategories,
} from './storage';

export const PRELOADED_SUBJECT_ID = 'iiot';

export const preloadedQuestions: Question[] = preloadedQuestionsRaw as unknown as Question[];
export const preloadedCategories: QuestionCategory[] = preloadedCategoriesRaw as unknown as QuestionCategory[];

export function getPreloadedQuestionsCount(): number {
  return preloadedQuestions.length;
}

export function getPreloadedQuestions(): Question[] {
  return [...preloadedQuestions];
}

/**
 * Preloads the Industrial IoT question bank into IndexedDB.
 * Safe and idempotent:
 * - By default (force = false), it only inserts questions that do not already exist in the database.
 * - If force = true, it upserts all 375 preloaded questions.
 * - Does not touch attempts, history, or other subjects.
 */
export async function preloadIndustrialIoTBank(force: boolean = false): Promise<{
  success: boolean;
  insertedCount: number;
  totalInSubject: number;
  message: string;
}> {
  try {
    const existingQuestions = await getAllQuestions(PRELOADED_SUBJECT_ID);
    const existingIdSet = new Set(existingQuestions.map((q) => q.id));

    // Ensure categories exist
    const existingCats = await getCategories(PRELOADED_SUBJECT_ID);
    const existingCatIds = new Set(existingCats.map((c) => c.id));
    for (const cat of preloadedCategories) {
      if (!existingCatIds.has(cat.id)) {
        await saveCategory(cat);
      }
    }

    let questionsToSave: Question[];
    if (force) {
      questionsToSave = preloadedQuestions;
    } else {
      questionsToSave = preloadedQuestions.filter((q) => !existingIdSet.has(q.id));
    }

    if (questionsToSave.length > 0) {
      await saveQuestionsTransactional(questionsToSave);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('questions_updated'));
      }
    }

    const updatedTotal = await getAllQuestions(PRELOADED_SUBJECT_ID);

    return {
      success: true,
      insertedCount: questionsToSave.length,
      totalInSubject: updatedTotal.length,
      message:
        questionsToSave.length > 0
          ? `Successfully preloaded ${questionsToSave.length} questions into the question bank.`
          : `All 375 preloaded questions already exist in the question bank. No duplicates created.`,
    };
  } catch (err: any) {
    console.error('Failed to preload Industrial IoT question bank:', err);
    return {
      success: false,
      insertedCount: 0,
      totalInSubject: 0,
      message: err?.message || 'Error occurred during question preloading.',
    };
  }
}

const SEEDED_KEY = 'iiot_official_seeded_v1';

/**
 * Initializes the question bank on application start.
 * If the current database has 0 questions for 'iiot' and has never been seeded, it auto-seeds them.
 * Once seeded, it never re-seeds on refresh, preserving intentional question deletions.
 */
export async function initializePreloadedData(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && localStorage.getItem(SEEDED_KEY)) {
      // Already initialized previously; do not re-insert on refresh
      return;
    }

    const existing = await getAllQuestions(PRELOADED_SUBJECT_ID);
    if (existing.length === 0) {
      console.log('Seeding initial Industrial IoT question bank (375 questions)...');
      await preloadIndustrialIoTBank(false);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(SEEDED_KEY, 'true');
    }
  } catch (err) {
    console.warn('Initial preloaded data check failed:', err);
  }
}
