import preloadedQuestionsRaw from '../data/question-bank/industrial-iot/questions.json';
import preloadedCategoriesRaw from '../data/question-bank/industrial-iot/categories.json';
import preloadedHCIQuestionsRaw from '../data/question-bank/hci/questions.json';
import preloadedHCICategoriesRaw from '../data/question-bank/hci/categories.json';
import preloadedWEQuestionsRaw from '../data/question-bank/wildlife-ecology/questions.json';
import preloadedWECategoriesRaw from '../data/question-bank/wildlife-ecology/categories.json';
import type { Question, QuestionCategory } from '../types';
import { DEFAULT_SUBJECT, HCI_SUBJECT, WILDLIFE_ECOLOGY_SUBJECT } from '../types';
import {
  getAllQuestions,
  saveQuestionsTransactional,
  saveCategory,
  getCategories,
  saveSubject,
  getSubjects,
} from './storage';

export const PRELOADED_SUBJECT_ID = 'iiot';
export const PRELOADED_HCI_SUBJECT_ID = 'hci';
export const PRELOADED_WE_SUBJECT_ID = 'wildlife-ecology';

// Industrial IoT Dataset (375 questions)
export const preloadedQuestions: Question[] = preloadedQuestionsRaw as unknown as Question[];
export const preloadedCategories: QuestionCategory[] = preloadedCategoriesRaw as unknown as QuestionCategory[];

// Human-Computer Interaction Dataset (240 questions: 120 Assignment, 120 Other across Weeks 1-12)
export const preloadedHCIQuestions: Question[] = preloadedHCIQuestionsRaw as unknown as Question[];
export const preloadedHCICategories: QuestionCategory[] = preloadedHCICategoriesRaw as unknown as QuestionCategory[];

// Wildlife Ecology Dataset (310 questions: 130 Assignment, 180 Other across Weeks 0-12)
export const preloadedWEQuestions: Question[] = preloadedWEQuestionsRaw as unknown as Question[];
export const preloadedWECategories: QuestionCategory[] = preloadedWECategoriesRaw as unknown as QuestionCategory[];

export function getPreloadedQuestionsCount(subjectId: string = PRELOADED_SUBJECT_ID): number {
  if (subjectId === PRELOADED_HCI_SUBJECT_ID) {
    return preloadedHCIQuestions.length;
  }
  if (subjectId === PRELOADED_WE_SUBJECT_ID) {
    return preloadedWEQuestions.length;
  }
  return preloadedQuestions.length;
}

export function getPreloadedQuestions(subjectId: string = PRELOADED_SUBJECT_ID): Question[] {
  if (subjectId === PRELOADED_HCI_SUBJECT_ID) {
    return [...preloadedHCIQuestions];
  }
  if (subjectId === PRELOADED_WE_SUBJECT_ID) {
    return [...preloadedWEQuestions];
  }
  return [...preloadedQuestions];
}

export function getPreloadedWEQuestionsCount(): number {
  return preloadedWEQuestions.length;
}

export function getPreloadedWEQuestions(): Question[] {
  return [...preloadedWEQuestions];
}

export function getPreloadedHCIQuestionsCount(): number {
  return preloadedHCIQuestions.length;
}

export function getPreloadedHCIQuestions(): Question[] {
  return [...preloadedHCIQuestions];
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
          ? `Successfully preloaded ${questionsToSave.length} questions into the Industrial IoT question bank.`
          : `All 375 preloaded Industrial IoT questions already exist in the question bank. No duplicates created.`,
    };
  } catch (err: any) {
    console.error('Failed to preload Industrial IoT question bank:', err);
    return {
      success: false,
      insertedCount: 0,
      totalInSubject: 0,
      message: err?.message || 'Error occurred during Industrial IoT question preloading.',
    };
  }
}

/**
 * Preloads the Human-Computer Interaction (HCI) question bank into IndexedDB.
 * Safe and idempotent:
 * - Inserts all 240 official questions (120 Assignment + 120 Other across Weeks 1-12).
 * - If force = true, upserts all 240 questions.
 * - Does not touch attempts, history, or Industrial IoT questions.
 */
export async function preloadHCIBank(force: boolean = false): Promise<{
  success: boolean;
  insertedCount: number;
  totalInSubject: number;
  message: string;
}> {
  try {
    // Ensure HCI subject exists
    const subjects = await getSubjects();
    if (!subjects.some((s) => s.id === HCI_SUBJECT.id)) {
      await saveSubject(HCI_SUBJECT);
    }

    const existingQuestions = await getAllQuestions(PRELOADED_HCI_SUBJECT_ID);
    const existingIdSet = new Set(existingQuestions.map((q) => q.id));

    // Ensure HCI categories exist
    const existingCats = await getCategories(PRELOADED_HCI_SUBJECT_ID);
    const existingCatIds = new Set(existingCats.map((c) => c.id));
    for (const cat of preloadedHCICategories) {
      if (!existingCatIds.has(cat.id)) {
        await saveCategory(cat);
      }
    }

    let questionsToSave: Question[];
    if (force) {
      questionsToSave = preloadedHCIQuestions;
    } else {
      questionsToSave = preloadedHCIQuestions.filter((q) => !existingIdSet.has(q.id));
    }

    if (questionsToSave.length > 0) {
      await saveQuestionsTransactional(questionsToSave);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('questions_updated'));
      }
    }

    const updatedTotal = await getAllQuestions(PRELOADED_HCI_SUBJECT_ID);

    return {
      success: true,
      insertedCount: questionsToSave.length,
      totalInSubject: updatedTotal.length,
      message:
        questionsToSave.length > 0
          ? `Successfully preloaded ${questionsToSave.length} official HCI questions into the question bank.`
          : `All ${preloadedHCIQuestions.length} preloaded HCI questions already exist in the question bank. No duplicates created.`,
    };
  } catch (err: any) {
    console.error('Failed to preload HCI question bank:', err);
    return {
      success: false,
      insertedCount: 0,
      totalInSubject: 0,
      message: err?.message || 'Error occurred during HCI question preloading.',
    };
  }
}

/**
 * Preloads the Wildlife Ecology question bank into IndexedDB.
 * Safe and idempotent:
 * - Inserts all 310 official questions (130 Assignment + 180 Other across Weeks 0-12).
 * - If force = true, upserts all 310 questions.
 * - Does not touch attempts, history, or other subjects.
 */
export async function preloadWEBank(force: boolean = false): Promise<{
  success: boolean;
  insertedCount: number;
  totalInSubject: number;
  message: string;
}> {
  try {
    // Ensure Wildlife Ecology subject exists
    const subjects = await getSubjects();
    if (!subjects.some((s) => s.id === WILDLIFE_ECOLOGY_SUBJECT.id)) {
      await saveSubject(WILDLIFE_ECOLOGY_SUBJECT);
    }

    const existingQuestions = await getAllQuestions(PRELOADED_WE_SUBJECT_ID);
    const existingIdSet = new Set(existingQuestions.map((q) => q.id));

    // Ensure categories exist
    const existingCats = await getCategories(PRELOADED_WE_SUBJECT_ID);
    const existingCatIds = new Set(existingCats.map((c) => c.id));
    for (const cat of preloadedWECategories) {
      if (!existingCatIds.has(cat.id)) {
        await saveCategory(cat);
      }
    }

    let questionsToSave: Question[];
    if (force) {
      questionsToSave = preloadedWEQuestions;
    } else {
      questionsToSave = preloadedWEQuestions.filter((q) => !existingIdSet.has(q.id));
    }

    if (questionsToSave.length > 0) {
      await saveQuestionsTransactional(questionsToSave);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('questions_updated'));
      }
    }

    const updatedTotal = await getAllQuestions(PRELOADED_WE_SUBJECT_ID);

    return {
      success: true,
      insertedCount: questionsToSave.length,
      totalInSubject: updatedTotal.length,
      message:
        questionsToSave.length > 0
          ? `Successfully preloaded ${questionsToSave.length} official Wildlife Ecology questions into the question bank.`
          : `All ${preloadedWEQuestions.length} preloaded Wildlife Ecology questions already exist in the question bank. No duplicates created.`,
    };
  } catch (err: any) {
    console.error('Failed to preload Wildlife Ecology question bank:', err);
    return {
      success: false,
      insertedCount: 0,
      totalInSubject: 0,
      message: err?.message || 'Error occurred during Wildlife Ecology question preloading.',
    };
  }
}

const SEEDED_KEY = 'iiot_official_seeded_v1';
const HCI_SEEDED_KEY = 'hci_official_seeded_v2';

/**
 * Initializes the question bank on application start.
 * Safely seeds subjects and official banks if empty without overriding user changes.
 */
export async function initializePreloadedData(): Promise<void> {
  try {
    // Ensure built-in subjects exist
    const subs = await getSubjects();
    if (!subs.some((s) => s.id === DEFAULT_SUBJECT.id)) {
      await saveSubject(DEFAULT_SUBJECT);
    }
    if (!subs.some((s) => s.id === HCI_SUBJECT.id)) {
      await saveSubject(HCI_SUBJECT);
    }
    if (!subs.some((s) => s.id === WILDLIFE_ECOLOGY_SUBJECT.id)) {
      await saveSubject(WILDLIFE_ECOLOGY_SUBJECT);
    }

    // 1. Seed Industrial IoT if empty and not yet seeded
    const iiotSeeded = typeof window !== 'undefined' && localStorage.getItem(SEEDED_KEY);
    if (!iiotSeeded) {
      const existingIIOT = await getAllQuestions(PRELOADED_SUBJECT_ID);
      if (existingIIOT.length === 0) {
        console.log('Seeding initial Industrial IoT question bank (375 questions)...');
        await preloadIndustrialIoTBank(false);
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem(SEEDED_KEY, 'true');
      }
    }

    // 2. Seed Human-Computer Interaction (HCI) if empty and not yet seeded
    const hciSeeded = typeof window !== 'undefined' && localStorage.getItem(HCI_SEEDED_KEY);
    if (!hciSeeded) {
      const existingHCI = await getAllQuestions(PRELOADED_HCI_SUBJECT_ID);
      if (existingHCI.length < preloadedHCIQuestions.length) {
        console.log(`Seeding/updating Human-Computer Interaction question bank (${preloadedHCIQuestions.length} questions)...`);
        await preloadHCIBank(false);
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem(HCI_SEEDED_KEY, 'true');
      }
    }

    // 3. Seed Wildlife Ecology (WE) if empty and not yet seeded
    const WE_SEEDED_KEY = 'we_official_seeded_v1';
    const weSeeded = typeof window !== 'undefined' && localStorage.getItem(WE_SEEDED_KEY);
    if (!weSeeded) {
      const existingWE = await getAllQuestions(PRELOADED_WE_SUBJECT_ID);
      if (existingWE.length < preloadedWEQuestions.length) {
        console.log(`Seeding initial Wildlife Ecology question bank (${preloadedWEQuestions.length} questions)...`);
        await preloadWEBank(false);
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem(WE_SEEDED_KEY, 'true');
      }
    }
  } catch (err) {
    console.warn('Initial preloaded data check failed:', err);
  }
}
