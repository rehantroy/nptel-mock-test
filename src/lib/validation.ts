import { z } from 'zod';
import type { Question, Option, WeekNumber, Subject, QuestionCategory } from '../types';

export const OptionSchema = z.object({
  id: z.string().min(1, 'Option ID is required'),
  text: z.string().min(1, 'Option text cannot be empty'),
});

export const WeekNumberSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
  z.literal(10),
  z.literal(11),
  z.literal(12),
]);

export const QuestionTypeSchema = z.enum(['assignment', 'other']);

export const ExtractionStatusSchema = z.enum([
  'raw',
  'parsed',
  'ocr_extracted',
  'manual_entry',
]);

export const VerificationStatusSchema = z.enum([
  'extracted',
  'needs_review',
  'needs_answer_key',
  'verified',
  'rejected',
]);

export const DuplicateStatusSchema = z.enum(['unique', 'potential_duplicate']);

export const SubjectSchema = z.object({
  id: z.string().min(1, 'Subject ID is required'),
  name: z.string().min(1, 'Subject name is required'),
  code: z.string().min(1, 'Subject code is required'),
  description: z.string().optional(),
  maxWeeks: z.number().default(12),
  isDefault: z.boolean().optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
});

export const QuestionCategorySchema = z.object({
  id: z.string().min(1, 'Category ID is required'),
  name: z.string().min(1, 'Category name is required'),
  subjectId: z.string().min(1, 'Subject ID is required'),
  isLegacyAssignment: z.boolean().optional(),
});

export const QuestionSchema = z
  .object({
    id: z.string().min(1, 'Question ID is required'),
    subjectId: z.string().default('iiot'),
    courseId: z.string().default('IIOT'),
    week: WeekNumberSchema,
    questionType: QuestionTypeSchema,
    categoryId: z.string().optional(),
    categoryName: z.string().optional(),
    originalHeading: z.string().optional(),
    originalQuestionNumber: z.union([z.number(), z.string()]),
    questionText: z.string().min(1, 'Question text cannot be empty'),
    options: z.array(OptionSchema).min(2, 'At least 2 options are required'),
    correctOptionId: z.string(),
    explanation: z.string().optional(),
    sourceFilename: z.string().default('source_document'),
    sourcePageNumber: z.number().optional(),
    originalSection: z.string().optional(),
    diagramUrl: z.string().optional(),
    extractionStatus: ExtractionStatusSchema.default('parsed'),
    verificationStatus: VerificationStatusSchema.default('extracted'),
    duplicateStatus: DuplicateStatusSchema.default('unique'),
    importTimestamp: z.string().default(() => new Date().toISOString()),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // If question is verified, correctOptionId MUST match an existing option
    if (data.verificationStatus === 'verified') {
      const optionIds = data.options.map((o) => o.id);
      if (!data.correctOptionId || !optionIds.includes(data.correctOptionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'A verified question must have a valid correctOptionId matching one of its options',
          path: ['correctOptionId'],
        });
      }
    }
  });

export const DatabaseBackupSchema = z.object({
  version: z.string().default('2.0'),
  courseId: z.string().optional(),
  exportDate: z.string(),
  subjects: z.array(SubjectSchema).optional(),
  categories: z.array(QuestionCategorySchema).optional(),
  questions: z.array(QuestionSchema),
  attempts: z.array(z.any()).optional(),
});

/**
 * Normalizes text for similarity and duplicate comparison
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Jaccard token similarity (0.0 to 1.0)
 */
export function calculateSimilarity(textA: string, textB: string): number {
  const normA = normalizeText(textA);
  const normB = normalizeText(textB);

  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;

  const setA = new Set(normA.split(' ').filter((w) => w.length > 2));
  const setB = new Set(normB.split(' ').filter((w) => w.length > 2));

  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Finds potential duplicates among an existing question list
 */
export function findPotentialDuplicates(
  candidateText: string,
  existingQuestions: Question[],
  threshold = 0.75
): Question[] {
  return existingQuestions.filter((q) => {
    const score = calculateSimilarity(candidateText, q.questionText);
    return score >= threshold;
  });
}

/**
 * Validates a candidate question and returns issues if any
 */
export function validateQuestionCandidate(candidate: unknown): {
  success: boolean;
  data?: Question;
  errors?: string[];
} {
  const result = QuestionSchema.safeParse(candidate);
  if (result.success) {
    return { success: true, data: result.data as Question };
  }
  return {
    success: false,
    errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
  };
}
