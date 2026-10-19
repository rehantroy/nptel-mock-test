export type WeekNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const WEEKS_LIST: WeekNumber[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export type QuestionType = 'assignment' | 'other';

export type ExtractionStatus = 'raw' | 'parsed' | 'ocr_extracted' | 'manual_entry';

export type VerificationStatus =
  | 'extracted'
  | 'needs_review'
  | 'needs_answer_key'
  | 'verified'
  | 'rejected';

export type DuplicateStatus = 'unique' | 'potential_duplicate';

export interface Subject {
  id: string; // Stable unique ID, e.g., 'iiot'
  name: string; // e.g., 'Industrial Internet of Things'
  code: string; // e.g., 'IIOT'
  description?: string;
  maxWeeks: number; // default 12 (Week 0 to 12)
  isDefault?: boolean;
  createdAt: string;
}

export const DEFAULT_SUBJECT: Subject = {
  id: 'iiot',
  name: 'Industrial Internet of Things',
  code: 'IIOT',
  description: 'NPTEL 12-week course (Week 0 to Week 12)',
  maxWeeks: 12,
  isDefault: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const HCI_SUBJECT: Subject = {
  id: 'hci',
  name: 'Human-Computer Interaction',
  code: 'HCI',
  description: 'NPTEL Human-Computer Interaction course (Dr. Rajiv Ratn Shah, IIIT Delhi)',
  maxWeeks: 12,
  isDefault: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const WILDLIFE_ECOLOGY_SUBJECT: Subject = {
  id: 'wildlife-ecology',
  name: 'Wildlife Ecology',
  code: 'WE',
  description: 'NPTEL Wildlife Ecology course (Prof. Ankur Awadhiya, IIT Kanpur)',
  maxWeeks: 12,
  isDefault: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const AVAILABLE_SUBJECTS: Subject[] = [DEFAULT_SUBJECT, HCI_SUBJECT, WILDLIFE_ECOLOGY_SUBJECT];

export interface QuestionCategory {
  id: string; // Stable slug, e.g., 'assignment', 'important_numerical', etc.
  name: string; // e.g., 'Important Numerical Questions'
  subjectId: string;
  isLegacyAssignment?: boolean;
}

export interface Option {
  id: string; // Stable unique ID (e.g. UUID)
  text: string;
}

export interface Question {
  id: string; // Stable unique ID
  subjectId?: string; // Subject ID (e.g. 'iiot')
  courseId: string; // Preserved for backwards compatibility ("IIOT")
  week: WeekNumber; // 0 to 12
  questionType: QuestionType; // 'assignment' | 'other' (preserved for legacy test modes)
  categoryId?: string; // Dynamic category ID
  categoryName?: string; // Dynamic category display name
  originalHeading?: string; // Detected section heading e.g. "Week 2: Important Numerical Questions"
  originalQuestionNumber: number | string;
  questionText: string;
  options: Option[];
  correctOptionId: string; // Must map to an option.id, never array index!
  explanation?: string; // Optional, ONLY if provided by source
  sourceFilename: string;
  sourcePageNumber?: number;
  originalSection?: string;
  diagramUrl?: string;
  extractionStatus: ExtractionStatus;
  verificationStatus: VerificationStatus;
  duplicateStatus: DuplicateStatus;
  importTimestamp: string;
  notes?: string;
  isOfficial?: boolean;
  sourceType?: 'official_preload' | 'user_upload' | 'manual_entry';
}

export type TestMode =
  | 'week_wise' // Mode 1: Single week, assignments only
  | 'custom' // Mode 2: Multi-week, user choice of Assignment/Other/Both or categories
  | 'all_week' // Mode 3: All weeks 0-12, assignments only
  | 'other_all' // Mode 4: Other questions across all weeks (skips empty)
  | 'all_questions'; // Mode 5: All questions (Assignments + Other) across all weeks

export interface CustomTestConfig {
  subjectId?: string;
  selectedWeeks: WeekNumber[];
  questionType: 'assignment' | 'other' | 'both';
  categoryIds?: string[]; // Optional specific category filter
}

export interface TestAttemptConfig {
  subjectId?: string;
  mode: TestMode;
  selectedWeeks: WeekNumber[];
  questionType: 'assignment' | 'other' | 'both';
  selectedWeek?: WeekNumber; // For week_wise mode
  categoryIds?: string[];
}

export type TestConfig = TestAttemptConfig;

export interface TestAttempt {
  id: string; // Unique attempt ID
  subjectId?: string; // Subject this attempt belongs to
  config: TestAttemptConfig;
  startedAt: string;
  completedAt?: string;
  isCompleted: boolean;
  questionOrder: string[]; // Ordered question IDs for this attempt
  shuffledOptions: Record<string, string[]>; // questionId -> ordered option IDs
  userAnswers: Record<string, string>; // questionId -> selected optionId
  flaggedQuestions: Record<string, boolean>; // questionId -> boolean
  score?: number;
  percentage?: number;
  totalEligible?: number;
  answeredCount?: number;
  correctCount?: number;
  incorrectCount?: number;
  unansweredCount?: number;
  timeSpentSeconds?: number;
}

export interface DatabaseBackup {
  version: string;
  courseId?: string;
  exportDate: string;
  subjects?: Subject[];
  categories?: QuestionCategory[];
  questions: Question[];
  attempts?: TestAttempt[];
}
