import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  BookOpen,
  Filter,
  Check,
  X,
  FileText,
} from 'lucide-react';
import { getAttempt, getAllQuestions, saveActiveAttempt } from '../lib/storage';
import { filterQuestionsForTest, generateTestAttempt } from '../lib/testEngine';
import { FormattedContent } from '../components/FormattedContent';
import type { TestAttempt, Question } from '../types';

export const AnswerReview: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [questionMap, setQuestionMap] = useState<Map<string, Question>>(new Map());
  const [filterType, setFilterType] = useState<'all' | 'correct' | 'incorrect' | 'unanswered'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReview() {
      try {
        if (!attemptId) return;
        const [att, qs] = await Promise.all([getAttempt(attemptId), getAllQuestions()]);
        setAttempt(att || null);
        setQuestionMap(new Map(qs.map((q) => [q.id, q])));
      } catch (err) {
        console.error('Failed to load review data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadReview();
  }, [attemptId]);

  const handleRetake = async () => {
    if (!attempt) return;
    const allQs = Array.from(questionMap.values());
    const eligible = filterQuestionsForTest(allQs, attempt.config);
    if (eligible.length === 0) return;

    const newAttempt = generateTestAttempt(eligible, attempt.config);
    await saveActiveAttempt(newAttempt);
    navigate(`/test/${newAttempt.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Attempt Review Unavailable</h2>
        <Link
          to="/"
          className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const filteredQuestionIds = attempt.questionOrder.filter((qId) => {
    const q = questionMap.get(qId);
    const selectedOptionId = attempt.userAnswers[qId];
    const isCorrect = q && selectedOptionId === q.correctOptionId;
    const isUnanswered = !selectedOptionId;

    if (filterType === 'correct') return isCorrect;
    if (filterType === 'incorrect') return !isCorrect && !isUnanswered;
    if (filterType === 'unanswered') return isUnanswered;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/results/${attempt.id}`)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Answer Review & Explanations</h1>
            <p className="text-xs text-slate-500">
              Exam: {attempt.config.mode.replace('_', ' ').toUpperCase()} • Score: {attempt.score} /{' '}
              {attempt.totalEligible} ({attempt.percentage}%)
            </p>
          </div>
        </div>

        <button
          onClick={handleRetake}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition shadow-xs flex items-center gap-2 self-start sm:self-auto"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Retake Test (New Shuffled Order)</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200">
        {[
          { id: 'all', label: `All Questions (${attempt.totalEligible})` },
          { id: 'correct', label: `Correct (${attempt.correctCount})` },
          { id: 'incorrect', label: `Incorrect (${attempt.incorrectCount})` },
          { id: 'unanswered', label: `Unanswered (${attempt.unansweredCount})` },
        ].map((tab) => {
          const active = filterType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                active
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Questions List */}
      <div className="space-y-6">
        {filteredQuestionIds.map((qId, index) => {
          const question = questionMap.get(qId);
          if (!question) {
            return (
              <div
                key={qId}
                className="bg-slate-50/80 rounded-3xl p-6 border border-slate-200 text-slate-600 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/70">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm">Question #{index + 1}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-600 text-[11px] font-semibold">
                      Deleted Question
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">ID: {qId}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  This question was removed from the active question bank after this test was completed.
                  Your recorded response and this test&rsquo;s score ({attempt.score}/{attempt.totalEligible}) remain permanently preserved in your attempt history.
                </p>
              </div>
            );
          }

          const selectedOptionId = attempt.userAnswers[qId];
          const isCorrect = selectedOptionId === question.correctOptionId;
          const isUnanswered = !selectedOptionId;

          // Shuffled options for this attempt
          const shuffledOptionIds = attempt.shuffledOptions[qId] || question.options.map((o) => o.id);
          const optionsList = shuffledOptionIds
            .map((optId) => question.options.find((o) => o.id === optId))
            .filter(Boolean) as { id: string; text: string }[];

          return (
            <div
              key={qId}
              className={`bg-white rounded-3xl p-6 border transition shadow-xs space-y-5 ${
                isCorrect
                  ? 'border-emerald-200'
                  : isUnanswered
                  ? 'border-slate-200'
                  : 'border-rose-200'
              }`}
            >
              {/* Question Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">Question #{index + 1}</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold">
                    Week {question.week} • {question.questionType === 'assignment' ? 'Assignment' : 'Other'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    (Orig Q#{question.originalQuestionNumber})
                  </span>
                </div>

                {/* Status Badge */}
                <div>
                  {isCorrect ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Correct (+1)</span>
                    </span>
                  ) : isUnanswered ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Unanswered</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Incorrect</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Question Body */}
              <div className="text-base font-medium text-slate-900 leading-relaxed">
                <FormattedContent content={question.questionText} />
              </div>

              {/* Shuffled Options Review */}
              <div className="space-y-2.5 pt-2">
                {optionsList.map((opt, optIdx) => {
                  const label = ['A', 'B', 'C', 'D', 'E', 'F'][optIdx] || String(optIdx + 1);
                  const isUserSelection = selectedOptionId === opt.id;
                  const isOfficialCorrect = question.correctOptionId === opt.id;

                  let borderClass = 'border-slate-200 bg-white';
                  let badge = null;

                  if (isOfficialCorrect) {
                    borderClass = 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500/30';
                    badge = (
                      <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                        <Check className="w-3 h-3 text-emerald-700" />
                        <span>Official Correct Answer</span>
                      </span>
                    );
                  } else if (isUserSelection && !isOfficialCorrect) {
                    borderClass = 'border-rose-400 bg-rose-50/70 ring-1 ring-rose-400/30';
                    badge = (
                      <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md">
                        <X className="w-3 h-3 text-rose-700" />
                        <span>Your Selected Answer</span>
                      </span>
                    );
                  }

                  return (
                    <div
                      key={opt.id}
                      className={`p-3.5 rounded-2xl border flex items-start gap-3 transition ${borderClass}`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isOfficialCorrect
                            ? 'bg-emerald-600 text-white'
                            : isUserSelection
                            ? 'bg-rose-500 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {label}
                      </div>

                      <div className="flex-1 text-sm text-slate-800 pt-0.5">
                        <FormattedContent content={opt.text} />
                      </div>

                      {badge}
                    </div>
                  );
                })}
              </div>

              {/* Official Source Explanation (Only if provided in source, NEVER fabricated) */}
              {question.explanation && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                    <span>Official Source Explanation:</span>
                  </div>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    <FormattedContent content={question.explanation} />
                  </div>
                </div>
              )}

              {/* Source Traceability Footer */}
              <div className="text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>
                    Source: {question.sourceFilename}
                    {question.sourcePageNumber ? ` (Page ${question.sourcePageNumber})` : ''}
                  </span>
                </div>
                <span className="font-mono">ID: {question.id}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
