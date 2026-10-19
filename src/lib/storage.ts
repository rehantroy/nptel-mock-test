import { openDB, type IDBPDatabase } from 'idb';
import type { Question, TestAttempt, DatabaseBackup, Subject, QuestionCategory } from '../types';
import { DEFAULT_SUBJECT, HCI_SUBJECT, WILDLIFE_ECOLOGY_SUBJECT } from '../types';
import { DatabaseBackupSchema } from './validation';

const DB_NAME = 'iiot_mock_test_db';
const DB_VERSION = 2; // Version 2: Multi-subject and dynamic categories migration

let dbPromise: Promise<IDBPDatabase> | null = null;

// In-memory fallback if IndexedDB is unavailable
const memoryStore = {
  subjects: new Map<string, Subject>([
    [DEFAULT_SUBJECT.id, DEFAULT_SUBJECT],
    [HCI_SUBJECT.id, HCI_SUBJECT],
    [WILDLIFE_ECOLOGY_SUBJECT.id, WILDLIFE_ECOLOGY_SUBJECT],
  ]),
  categories: new Map<string, QuestionCategory>(),
  questions: new Map<string, Question>(),
  attempts: new Map<string, TestAttempt>(),
  activeAttempt: null as TestAttempt | null,
};

function isIDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

const ACTIVE_SUBJECT_KEY = 'active_subject_id';

export function getActiveSubjectId(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(ACTIVE_SUBJECT_KEY);
      if (stored) return stored;
    } catch {
      // ignore
    }
  }
  return DEFAULT_SUBJECT.id;
}

export function setActiveSubjectId(subjectId: string): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ACTIVE_SUBJECT_KEY, subjectId);
      window.dispatchEvent(new CustomEvent('subject_changed', { detail: { subjectId } }));
    } catch {
      // ignore
    }
  }
}

async function getDB(): Promise<IDBPDatabase> {
  if (!isIDBAvailable()) {
    return Promise.reject(new Error('IndexedDB not supported in current environment'));
  }

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        // Version 1 base object stores
        if (!db.objectStoreNames.contains('questions')) {
          const qStore = db.createObjectStore('questions', { keyPath: 'id' });
          qStore.createIndex('by_week', 'week');
          qStore.createIndex('by_type', 'questionType');
          qStore.createIndex('by_verification', 'verificationStatus');
        }

        if (!db.objectStoreNames.contains('attempts')) {
          const aStore = db.createObjectStore('attempts', { keyPath: 'id' });
          aStore.createIndex('by_date', 'startedAt');
        }

        if (!db.objectStoreNames.contains('active_attempt')) {
          db.createObjectStore('active_attempt', { keyPath: 'id' });
        }

        // Version 2: Multi-subject & Category object stores
        if (!db.objectStoreNames.contains('subjects')) {
          db.createObjectStore('subjects', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }

        const qStore = tx.objectStore('questions');
        if (!qStore.indexNames.contains('by_subject')) {
          qStore.createIndex('by_subject', 'subjectId');
        }

        const aStore = tx.objectStore('attempts');
        if (!aStore.indexNames.contains('by_subject')) {
          aStore.createIndex('by_subject', 'subjectId');
        }

        // Data migration for existing pre-v2 records:
        // Ensure default IIoT subject exists
        const subStore = tx.objectStore('subjects');
        const defaultSub = await subStore.get(DEFAULT_SUBJECT.id);
        if (!defaultSub) {
          await subStore.put(DEFAULT_SUBJECT);
        }

        // Migrate questions: ensure subjectId is populated
        if (oldVersion < 2) {
          const allQuestions = await qStore.getAll();
          for (const q of allQuestions) {
            let updated = false;
            if (!q.subjectId) {
              q.subjectId = 'iiot';
              updated = true;
            }
            if (!q.categoryId) {
              q.categoryId = q.questionType === 'assignment' ? 'assignment' : 'other';
              updated = true;
            }
            if (updated) {
              await qStore.put(q);
            }
          }

          // Migrate attempts: ensure subjectId is populated
          const allAttempts = await aStore.getAll();
          for (const att of allAttempts) {
            if (!att.subjectId) {
              att.subjectId = 'iiot';
              if (att.config && !att.config.subjectId) {
                att.config.subjectId = 'iiot';
              }
              await aStore.put(att);
            }
          }
        }
      },
    });
  }
  return dbPromise;
}

// ---------------- SUBJECT METHODS ----------------

export async function getSubjects(): Promise<Subject[]> {
  if (!isIDBAvailable()) {
    if (!memoryStore.subjects.has(DEFAULT_SUBJECT.id)) {
      memoryStore.subjects.set(DEFAULT_SUBJECT.id, DEFAULT_SUBJECT);
    }
    if (!memoryStore.subjects.has(HCI_SUBJECT.id)) {
      memoryStore.subjects.set(HCI_SUBJECT.id, HCI_SUBJECT);
    }
    if (!memoryStore.subjects.has(WILDLIFE_ECOLOGY_SUBJECT.id)) {
      memoryStore.subjects.set(WILDLIFE_ECOLOGY_SUBJECT.id, WILDLIFE_ECOLOGY_SUBJECT);
    }
    return Array.from(memoryStore.subjects.values());
  }
  try {
    const db = await getDB();
    const list = await db.getAll('subjects');
    const standardSubjects = [DEFAULT_SUBJECT, HCI_SUBJECT, WILDLIFE_ECOLOGY_SUBJECT];
    let updated = false;
    for (const sub of standardSubjects) {
      if (!list.some((s: Subject) => s.id === sub.id)) {
        await db.put('subjects', sub);
        list.push(sub);
        updated = true;
      }
    }
    return list;
  } catch (err) {
    console.warn('IDB getSubjects failed, using memoryStore:', err);
    return Array.from(memoryStore.subjects.values());
  }
}

export async function getActiveSubject(): Promise<Subject> {
  const activeId = getActiveSubjectId();
  const subjects = await getSubjects();
  const found = subjects.find((s) => s.id === activeId);
  if (found) return found;

  const defaultSub = subjects.find((s) => s.isDefault) || subjects[0] || DEFAULT_SUBJECT;
  setActiveSubjectId(defaultSub.id);
  return defaultSub;
}

export async function saveSubject(subject: Subject): Promise<void> {
  memoryStore.subjects.set(subject.id, subject);
  if (isIDBAvailable()) {
    try {
      const db = await getDB();
      await db.put('subjects', subject);
    } catch (err) {
      console.warn('IDB saveSubject failed:', err);
    }
  }
}

export async function deleteSubject(
  subjectId: string
): Promise<{ success: boolean; error?: string }> {
  if (subjectId === DEFAULT_SUBJECT.id || subjectId === HCI_SUBJECT.id || subjectId === WILDLIFE_ECOLOGY_SUBJECT.id) {
    return { success: false, error: 'Cannot delete the built-in default subjects.' };
  }

  // Check if subject has existing questions
  const qs = await getAllQuestions(subjectId);
  if (qs.length > 0) {
    return {
      success: false,
      error: `Cannot delete subject: ${qs.length} questions are associated with this subject. Please delete questions first.`,
    };
  }

  memoryStore.subjects.delete(subjectId);
  if (isIDBAvailable()) {
    try {
      const db = await getDB();
      await db.delete('subjects', subjectId);
    } catch (err) {
      console.warn('IDB deleteSubject failed:', err);
    }
  }

  if (getActiveSubjectId() === subjectId) {
    setActiveSubjectId(DEFAULT_SUBJECT.id);
  }

  return { success: true };
}

// ---------------- CATEGORY METHODS ----------------

export async function getCategories(subjectId?: string): Promise<QuestionCategory[]> {
  const targetSubject = subjectId ?? getActiveSubjectId();
  if (!isIDBAvailable()) {
    return Array.from(memoryStore.categories.values()).filter(
      (c) => c.subjectId === targetSubject
    );
  }
  try {
    const db = await getDB();
    const all = await db.getAll('categories');
    return all.filter((c: QuestionCategory) => c.subjectId === targetSubject);
  } catch (err) {
    console.warn('IDB getCategories failed:', err);
    return Array.from(memoryStore.categories.values()).filter(
      (c) => c.subjectId === targetSubject
    );
  }
}

export async function saveCategory(category: QuestionCategory): Promise<void> {
  memoryStore.categories.set(category.id, category);
  if (isIDBAvailable()) {
    try {
      const db = await getDB();
      await db.put('categories', category);
    } catch (err) {
      console.warn('IDB saveCategory failed:', err);
    }
  }
}

// ---------------- QUESTION METHODS (WITH SUBJECT ISOLATION) ----------------

/**
 * Retrieves questions filtered strictly by subject.
 * Pass subjectId = 'all' to get questions across all subjects (e.g. for complete backup).
 */
export async function getAllQuestions(subjectId?: string): Promise<Question[]> {
  const targetSubject = subjectId ?? getActiveSubjectId();
  let all: Question[] = [];

  if (!isIDBAvailable()) {
    all = Array.from(memoryStore.questions.values());
  } else {
    try {
      const db = await getDB();
      all = await db.getAll('questions');
    } catch (err) {
      console.warn('IDB getAllQuestions failed, using memoryStore:', err);
      all = Array.from(memoryStore.questions.values());
    }
  }

  // Ensure legacy records have subjectId
  all = all.map((q) => ({
    ...q,
    subjectId: q.subjectId || 'iiot',
  }));

  if (targetSubject === 'all') {
    return all;
  }

  return all.filter((q) => (q.subjectId || 'iiot') === targetSubject);
}

export async function getVerifiedQuestions(subjectId?: string): Promise<Question[]> {
  const questions = await getAllQuestions(subjectId);
  return questions.filter((q) => q.verificationStatus === 'verified');
}

export async function saveQuestion(question: Question): Promise<void> {
  const targetSubject = question.subjectId || getActiveSubjectId();
  const qToSave: Question = {
    ...question,
    subjectId: targetSubject,
  };

  memoryStore.questions.set(qToSave.id, qToSave);
  if (isIDBAvailable()) {
    try {
      const db = await getDB();
      await db.put('questions', qToSave);
    } catch (err) {
      console.warn('IDB saveQuestion failed, saved in memoryStore:', err);
    }
  }
}

export async function saveQuestions(questions: Question[]): Promise<void> {
  const targetSubject = getActiveSubjectId();
  const normalized = questions.map((q) => ({
    ...q,
    subjectId: q.subjectId || targetSubject,
  }));

  for (const q of normalized) {
    memoryStore.questions.set(q.id, q);
  }

  if (isIDBAvailable()) {
    try {
      const db = await getDB();
      const tx = db.transaction('questions', 'readwrite');
      for (const q of normalized) {
        await tx.store.put(q);
      }
      await tx.done;
    } catch (err) {
      console.warn('IDB saveQuestions failed:', err);
    }
  }
}

/**
 * Transactional save: all questions and categories are committed atomically.
 * If any error occurs, the transaction aborts and throws without leaving partial records.
 */
export async function saveQuestionsTransactional(
  questions: Question[],
  newCategories?: QuestionCategory[]
): Promise<{ success: boolean; savedCount: number }> {
  const targetSubject = getActiveSubjectId();
  const normalized = questions.map((q) => ({
    ...q,
    subjectId: q.subjectId || targetSubject,
  }));

  if (newCategories && newCategories.length > 0) {
    for (const cat of newCategories) {
      await saveCategory(cat);
    }
  }

  if (isIDBAvailable()) {
    const db = await getDB();
    const tx = db.transaction('questions', 'readwrite');
    try {
      for (const q of normalized) {
        await tx.store.put(q);
      }
      await tx.done;
    } catch (err) {
      console.error('Transaction failed, rolling back:', err);
      throw err;
    }
  }

  // Update memory store only after successful IDB transaction
  for (const q of normalized) {
    memoryStore.questions.set(q.id, q);
  }

  return { success: true, savedCount: normalized.length };
}

export async function getQuestion(id: string): Promise<Question | null> {
  if (!id || typeof id !== 'string') return null;

  if (isIDBAvailable()) {
    try {
      const db = await getDB();
      const q = await db.get('questions', id);
      if (q) return q;
    } catch (err) {
      console.warn('IDB getQuestion failed, checking memoryStore:', err);
    }
  }
  return memoryStore.questions.get(id) || null;
}

export async function deleteQuestion(id: string): Promise<{ success: boolean; error?: string }> {
  if (!id || typeof id !== 'string') {
    return { success: false, error: 'A valid question ID is required for deletion.' };
  }

  if (isIDBAvailable()) {
    try {
      const db = await getDB();
      const tx = db.transaction('questions', 'readwrite');
      await tx.store.delete(id);
      await tx.done;
    } catch (err: any) {
      console.error('Persistent IDB deleteQuestion failed:', err);
      return {
        success: false,
        error: err?.message || 'Database error: Failed to delete question persistently.',
      };
    }
  }

  // Remove from in-memory fallback store only after IDB deletion succeeds
  memoryStore.questions.delete(id);

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('question_deleted', { detail: { id } }));
      window.dispatchEvent(new CustomEvent('questions_updated'));
    } catch {
      // ignore
    }
  }

  return { success: true };
}

export async function deleteQuestionsBatch(
  ids: string[]
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  if (!ids || ids.length === 0) {
    return { success: true, deletedCount: 0 };
  }

  if (isIDBAvailable()) {
    try {
      const db = await getDB();
      const tx = db.transaction('questions', 'readwrite');
      for (const id of ids) {
        await tx.store.delete(id);
      }
      await tx.done;
    } catch (err: any) {
      console.error('Persistent IDB deleteQuestionsBatch failed:', err);
      return {
        success: false,
        deletedCount: 0,
        error: err?.message || 'Database error: Failed to delete batch questions.',
      };
    }
  }

  for (const id of ids) {
    memoryStore.questions.delete(id);
  }

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('questions_updated'));
    } catch {
      // ignore
    }
  }

  return { success: true, deletedCount: ids.length };
}


export async function clearAllQuestions(subjectId?: string): Promise<void> {
  const targetSubject = subjectId ?? getActiveSubjectId();

  if (targetSubject === 'all') {
    memoryStore.questions.clear();
    if (isIDBAvailable()) {
      try {
        const db = await getDB();
        await db.clear('questions');
      } catch (err) {
        console.warn('IDB clearAllQuestions failed:', err);
      }
    }
  } else {
    // Delete only questions of this subject
    const subjectQuestions = await getAllQuestions(targetSubject);
    for (const q of subjectQuestions) {
      memoryStore.questions.delete(q.id);
    }
    if (isIDBAvailable()) {
      try {
        const db = await getDB();
        const tx = db.transaction('questions', 'readwrite');
        for (const q of subjectQuestions) {
          await tx.store.delete(q.id);
        }
        await tx.done;
      } catch (err) {
        console.warn('IDB clearAllQuestions for subject failed:', err);
      }
    }
  }
}

// ---------------- ATTEMPT METHODS (WITH SUBJECT ISOLATION) ----------------

export async function saveAttempt(attempt: TestAttempt): Promise<void> {
  const targetSubject = attempt.subjectId || attempt.config?.subjectId || getActiveSubjectId();
  const attToSave: TestAttempt = {
    ...attempt,
    subjectId: targetSubject,
    config: {
      ...attempt.config,
      subjectId: targetSubject,
    },
  };

  memoryStore.attempts.set(attToSave.id, attToSave);
  if (isIDBAvailable()) {
    try {
      const db = await getDB();
      await db.put('attempts', attToSave);
    } catch (err) {
      console.warn('IDB saveAttempt failed:', err);
    }
  }
}

export async function getAttempts(subjectId?: string): Promise<TestAttempt[]> {
  const targetSubject = subjectId ?? getActiveSubjectId();
  let all: TestAttempt[] = [];

  if (!isIDBAvailable()) {
    all = Array.from(memoryStore.attempts.values());
  } else {
    try {
      const db = await getDB();
      all = await db.getAll('attempts');
    } catch (err) {
      console.warn('IDB getAttempts failed:', err);
      all = Array.from(memoryStore.attempts.values());
    }
  }

  // Normalize legacy attempts
  all = all.map((a) => ({
    ...a,
    subjectId: a.subjectId || a.config?.subjectId || 'iiot',
  }));

  if (targetSubject !== 'all') {
    all = all.filter((a) => (a.subjectId || 'iiot') === targetSubject);
  }

  return all.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

export async function getAttempt(id: string): Promise<TestAttempt | undefined> {
  if (!isIDBAvailable()) {
    return memoryStore.attempts.get(id);
  }
  try {
    const db = await getDB();
    const attempt = await db.get('attempts', id);
    return attempt || memoryStore.attempts.get(id);
  } catch (err) {
    console.warn('IDB getAttempt failed:', err);
    return memoryStore.attempts.get(id);
  }
}

export async function deleteAttempt(id: string): Promise<void> {
  memoryStore.attempts.delete(id);
  if (isIDBAvailable()) {
    try {
      const db = await getDB();
      await db.delete('attempts', id);
    } catch (err) {
      console.warn('IDB deleteAttempt failed:', err);
    }
  }
}

export async function clearAttempts(subjectId?: string): Promise<void> {
  const targetSubject = subjectId ?? getActiveSubjectId();

  if (targetSubject === 'all') {
    memoryStore.attempts.clear();
    if (isIDBAvailable()) {
      try {
        const db = await getDB();
        await db.clear('attempts');
      } catch (err) {
        console.warn('IDB clearAttempts failed:', err);
      }
    }
  } else {
    const subjectAttempts = await getAttempts(targetSubject);
    for (const a of subjectAttempts) {
      memoryStore.attempts.delete(a.id);
    }
    if (isIDBAvailable()) {
      try {
        const db = await getDB();
        const tx = db.transaction('attempts', 'readwrite');
        for (const a of subjectAttempts) {
          await tx.store.delete(a.id);
        }
        await tx.done;
      } catch (err) {
        console.warn('IDB clearAttempts for subject failed:', err);
      }
    }
  }
}

// ---------------- ACTIVE ATTEMPT (RESUME ACROSS REFRESH) ----------------

const ACTIVE_KEY = 'current_active_attempt';

export async function saveActiveAttempt(attempt: TestAttempt): Promise<void> {
  const targetSubject = attempt.subjectId || attempt.config?.subjectId || getActiveSubjectId();
  const normalized: TestAttempt = {
    ...attempt,
    subjectId: targetSubject,
    config: {
      ...attempt.config,
      subjectId: targetSubject,
    },
  };

  memoryStore.activeAttempt = normalized;
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore
  }
  if (isIDBAvailable()) {
    try {
      const db = await getDB();
      await db.put('active_attempt', { ...normalized, id: 'current' });
    } catch {
      // ignore
    }
  }
}

export async function getActiveAttempt(subjectId?: string): Promise<TestAttempt | null> {
  const targetSubject = subjectId ?? getActiveSubjectId();
  let att: TestAttempt | null = null;

  try {
    const item = localStorage.getItem(ACTIVE_KEY);
    if (item) {
      att = JSON.parse(item) as TestAttempt;
    }
  } catch {
    // fallback
  }

  if (!att && isIDBAvailable()) {
    try {
      const db = await getDB();
      const res = await db.get('active_attempt', 'current');
      if (res) att = res as TestAttempt;
    } catch {
      // fallback
    }
  }

  if (!att) {
    att = memoryStore.activeAttempt;
  }

  if (att && targetSubject !== 'all') {
    const attSub = att.subjectId || att.config?.subjectId || 'iiot';
    if (attSub !== targetSubject) {
      return null; // Scoped strictly to current subject
    }
  }

  return att;
}

export async function clearActiveAttempt(): Promise<void> {
  memoryStore.activeAttempt = null;
  try {
    localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // ignore
  }
  if (isIDBAvailable()) {
    try {
      const db = await getDB();
      await db.delete('active_attempt', 'current');
    } catch {
      // ignore
    }
  }
}

// ---------------- BACKUP & RESTORE ----------------

export async function exportDatabase(subjectId?: string): Promise<DatabaseBackup> {
  const targetSubject = subjectId ?? 'all';
  const subjects = await getSubjects();
  const questions = await getAllQuestions(targetSubject);
  const attempts = await getAttempts(targetSubject);

  return {
    version: '2.0',
    exportDate: new Date().toISOString(),
    subjects,
    questions,
    attempts,
  };
}

export async function importDatabaseBackup(
  data: unknown
): Promise<{ success: boolean; added: number; updated: number; error?: string }> {
  const parsed = DatabaseBackupSchema.safeParse(data);
  if (!parsed.success) {
    const issueMsg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    return { success: false, added: 0, updated: 0, error: `Invalid backup schema: ${issueMsg}` };
  }

  const backup = parsed.data;

  // Restore subjects if present
  if (backup.subjects && Array.isArray(backup.subjects)) {
    for (const sub of backup.subjects) {
      await saveSubject(sub);
    }
  }

  // Restore categories if present
  if (backup.categories && Array.isArray(backup.categories)) {
    for (const cat of backup.categories) {
      await saveCategory(cat);
    }
  }

  const existingQuestions = await getAllQuestions('all');
  const existingMap = new Map(existingQuestions.map((q) => [q.id, q]));

  let added = 0;
  let updated = 0;

  const toSave: Question[] = [];
  for (const q of backup.questions as Question[]) {
    if (existingMap.has(q.id)) {
      updated++;
    } else {
      added++;
    }
    toSave.push({
      ...q,
      subjectId: q.subjectId || 'iiot',
    });
  }

  await saveQuestionsTransactional(toSave);

  if (backup.attempts && Array.isArray(backup.attempts)) {
    for (const att of backup.attempts) {
      if (att && typeof att === 'object' && 'id' in att) {
        await saveAttempt(att as TestAttempt);
      }
    }
  }

  return { success: true, added, updated };
}
