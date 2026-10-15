import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  CheckCircle,
  HelpCircle,
  Clock,
  Send,
  AlertTriangle,
  RotateCcw,
  Layers,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import {
  getAllQuestions,
  getActiveAttempt,
  saveActiveAttempt,
  saveAttempt,
  clearActiveAttempt,
} from '../lib/storage';
import { gradeAttempt } from '../lib/testEngine';
import { FormattedContent } from '../components/FormattedContent';
import type { Question, TestAttempt } from '../types';

export const ActiveTest: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [questionMap, setQuestionMap] = useState<Map<string, Question>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load attempt and questions from storage
  useEffect(() => {
    async function loadTest() {
      try {
        const [allQs, active] = await Promise.all([
          getAllQuestions(),
          getActiveAttempt(),
        ]);

        const map = new Map<string, Question>(allQs.map((q) => [q.id, q]));
        setQuestionMap(map);

        if (active && active.id === attemptId) {
          setAttempt(active);
          setElapsedSeconds(active.timeSpentSeconds || 0);
        } else {
          // If active attempt ID mismatch or not in active storage
          console.warn('Attempt not found or finished');
        }
      } catch (err) {
        console.error('Failed to load active test:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTest();
  }, [attemptId]);

  // Timer interval
  useEffect(() => {
    if (!attempt || attempt.isCompleted) return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => {
        const updated = prev + 1;
        // Autosave elapsed time periodically
        if (updated % 5 === 0 && attempt) {
          saveActiveAttempt({ ...attempt, timeSpentSeconds: updated }).catch(() => {});
        }
        return updated;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [attempt]);

  // Handle selecting an option (attaches stable option ID to question ID)
  const handleSelectOption = useCallback(
    async (optionId: string) => {
      if (!attempt) return;
      const currentQId = attempt.questionOrder[currentIndex];
      const updatedUserAnswers = {
        ...attempt.userAnswers,
        [currentQId]: optionId,
      };

      const updatedAttempt: TestAttempt = {
        ...attempt,
        userAnswers: updatedUserAnswers,
        answeredCount: Object.keys(updatedUserAnswers).length,
        timeSpentSeconds: elapsedSeconds,
      };

      setAttempt(updatedAttempt);
      await saveActiveAttempt(updatedAttempt);
    },
    [attempt, currentIndex, elapsedSeconds]
  );

  // Handle clearing answer
  const handleClearAnswer = async () => {
    if (!attempt) return;
    const currentQId = attempt.questionOrder[currentIndex];
    const updatedAnswers = { ...attempt.userAnswers };
    delete updatedAnswers[currentQId];

    const updatedAttempt: TestAttempt = {
      ...attempt,
      userAnswers: updatedAnswers,
      answeredCount: Object.keys(updatedAnswers).length,
      timeSpentSeconds: elapsedSeconds,
    };

    setAttempt(updatedAttempt);
    await saveActiveAttempt(updatedAttempt);
  };

  // Toggle flag for review
  const handleToggleFlag = async () => {
    if (!attempt) return;
    const currentQId = attempt.questionOrder[currentIndex];
    const isFlagged = !attempt.flaggedQuestions[currentQId];

    const updatedAttempt: TestAttempt = {
      ...attempt,
      flaggedQuestions: {
        ...attempt.flaggedQuestions,
        [currentQId]: isFlagged,
      },
      timeSpentSeconds: elapsedSeconds,
    };

    setAttempt(updatedAttempt);
    await saveActiveAttempt(updatedAttempt);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showConfirmModal) return;

      // Number keys 1-4 or letters A-D to select options
      if (['1', '2', '3', '4'].includes(e.key)) {
        const optIdx = parseInt(e.key, 10) - 1;
        if (attempt) {
          const currentQId = attempt.questionOrder[currentIndex];
          const optionIds = attempt.shuffledOptions[currentQId] || [];
          if (optionIds[optIdx]) {
            handleSelectOption(optionIds[optIdx]);
          }
        }
      } else if (['a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key)) {
        const charIdx = ['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase());
        if (attempt && charIdx >= 0) {
          const currentQId = attempt.questionOrder[currentIndex];
          const optionIds = attempt.shuffledOptions[currentQId] || [];
          if (optionIds[charIdx]) {
            handleSelectOption(optionIds[charIdx]);
          }
        }
      } else if (e.key === 'ArrowRight' && attempt && currentIndex < attempt.questionOrder.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [attempt, currentIndex, handleSelectOption, showConfirmModal]);

  // Submit test and grade
  const handleSubmitFinal = async () => {
    if (!attempt) return;

    const report = gradeAttempt(attempt, questionMap);
    const completedAttempt: TestAttempt = {
      ...attempt,
      ...report,
      isCompleted: true,
      completedAt: new Date().toISOString(),
      timeSpentSeconds: elapsedSeconds,
    };

    await saveAttempt(completedAttempt);
    await clearActiveAttempt();
    navigate(`/results/${completedAttempt.id}`);
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!attempt || attempt.questionOrder.length === 0) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Test Not Found or Expired</h2>
        <p className="text-sm text-slate-600">
          This test session either completed or is no longer available in local storage.
        </p>
        <button
          onClick={() => navigate('/modes')}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition"
        >
          Return to Test Modes
        </button>
      </div>
    );
  }

  const currentQId = attempt.questionOrder[currentIndex];
  const currentQuestion = questionMap.get(currentQId);
  const shuffledOptionIds = attempt.shuffledOptions[currentQId] || [];
  const selectedOptionId = attempt.userAnswers[currentQId];
  const isCurrentFlagged = !!attempt.flaggedQuestions[currentQId];
  const totalQuestions = attempt.questionOrder.length;

  // Options mapped in shuffled order
  const optionsList = shuffledOptionIds
    .map((optId) => currentQuestion?.options.find((o) => o.id === optId))
    .filter(Boolean) as { id: string; text: string }[];

  const answeredCount = Object.keys(attempt.userAnswers).length;
  const flaggedCount = Object.values(attempt.flaggedQuestions).filter(Boolean).length;
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Top Test Header Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-bold flex items-center justify-center">
            {currentIndex + 1}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm sm:text-base">
                Question {currentIndex + 1} of {totalQuestions}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 uppercase">
                {attempt.config.mode.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {currentQuestion
                ? `Week ${currentQuestion.week} • ${
                    currentQuestion.questionType === 'assignment' ? 'Assignment' : 'Other'
                  } • Orig Q#${currentQuestion.originalQuestionNumber}`
                : 'Question reference'}
            </p>
          </div>
        </div>

        {/* Timer & Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-mono text-sm font-semibold">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>{formatTimer(elapsedSeconds)}</span>
          </div>

          <button
            id="flag-question-btn"
            onClick={handleToggleFlag}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              isCurrentFlagged
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {isCurrentFlagged ? (
              <BookmarkCheck className="w-4 h-4 text-amber-600" />
            ) : (
              <Bookmark className="w-4 h-4 text-slate-400" />
            )}
            <span>{isCurrentFlagged ? 'Flagged' : 'Flag'}</span>
          </button>

          <button
            id="top-submit-btn"
            onClick={() => setShowConfirmModal(true)}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit Test</span>
          </button>
        </div>
      </div>

      {/* Main Test Layout: Question Area + Navigation Palette */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left 3 cols: Question Card */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            {/* Source Traceability Header */}
            {currentQuestion && (
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pb-4 border-b border-slate-100 gap-2">
                <span className="font-medium text-slate-700">
                  Source: {currentQuestion.sourceFilename || 'Official NPTEL Assignment'}
                  {currentQuestion.sourcePageNumber && ` (Page ${currentQuestion.sourcePageNumber})`}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                  ID: {currentQuestion.id.slice(0, 10)}
                </span>
              </div>
            )}

            {/* Question Text */}
            <div className="text-base sm:text-lg font-medium leading-relaxed text-slate-900">
              {currentQuestion ? (
                <FormattedContent content={currentQuestion.questionText} />
              ) : (
                <p>Loading question text...</p>
              )}
            </div>

            {/* Answer Options */}
            <div className="space-y-3 pt-2">
              {optionsList.map((option, idx) => {
                const label = ['A', 'B', 'C', 'D', 'E', 'F'][idx] || String(idx + 1);
                const isSelected = selectedOptionId === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelectOption(option.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition flex items-start gap-3.5 group ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-2 ring-blue-500/30'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </div>

                    <div className="flex-1 pt-1 text-sm sm:text-base text-slate-900 font-normal">
                      <FormattedContent content={option.text} />
                    </div>

                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center mt-1 shrink-0 ${
                        isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bottom Actions Row */}
            <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleClearAnswer}
                disabled={!selectedOptionId}
                className="text-xs font-semibold text-slate-500 hover:text-rose-600 disabled:opacity-40 disabled:hover:text-slate-500 transition"
              >
                Clear Answer
              </button>

              <div className="flex items-center gap-2">
                <button
                  id="prev-question-btn"
                  type="button"
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 disabled:opacity-40 font-semibold text-xs text-slate-700 flex items-center gap-1 transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <button
                  id="next-question-btn"
                  type="button"
                  onClick={() =>
                    setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))
                  }
                  disabled={currentIndex === totalQuestions - 1}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1 transition shadow-xs cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 col: Question Palette Drawer */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Question Palette</h3>

            {/* Palette Status Legend */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-blue-600 shrink-0" />
                <span>Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-slate-200 shrink-0" />
                <span>Unanswered ({unansweredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-amber-500 shrink-0" />
                <span>Flagged ({flaggedCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md border-2 border-blue-600 shrink-0" />
                <span>Current</span>
              </div>
            </div>

            {/* Numbers Grid */}
            <div className="grid grid-cols-5 gap-2 max-h-[360px] overflow-y-auto p-1">
              {attempt.questionOrder.map((qId, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = !!attempt.userAnswers[qId];
                const isFlagged = !!attempt.flaggedQuestions[qId];

                let btnClass = 'bg-slate-100 text-slate-700 hover:bg-slate-200';
                if (isAnswered) {
                  btnClass = 'bg-blue-600 text-white font-semibold';
                }
                if (isFlagged) {
                  btnClass = 'bg-amber-500 text-white font-semibold';
                }
                if (isCurrent) {
                  btnClass += ' ring-2 ring-offset-2 ring-blue-600 font-bold';
                }

                return (
                  <button
                    key={qId}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-xl text-xs flex items-center justify-center transition ${btnClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Complete & Submit</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-slate-100">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Send className="w-6 h-6" />
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">Submit Your Test?</h3>
              <p className="text-xs text-slate-500">
                Are you ready to submit your test for scoring? You will not be able to change your answers once submitted.
              </p>
            </div>

            {/* Summary counters */}
            <div className="bg-slate-50 rounded-2xl p-4 grid grid-cols-3 gap-2 text-center border border-slate-100">
              <div>
                <div className="text-xl font-bold text-emerald-600">{answeredCount}</div>
                <div className="text-[11px] text-slate-500">Answered</div>
              </div>
              <div>
                <div className="text-xl font-bold text-rose-500">{unansweredCount}</div>
                <div className="text-[11px] text-slate-500">Unanswered</div>
              </div>
              <div>
                <div className="text-xl font-bold text-amber-500">{flaggedCount}</div>
                <div className="text-[11px] text-slate-500">Flagged</div>
              </div>
            </div>

            {unansweredCount > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
                Notice: You have <strong>{unansweredCount} unanswered</strong> questions remaining.
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
              >
                Return to Test
              </button>
              <button
                id="confirm-submit-btn"
                type="button"
                onClick={handleSubmitFinal}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-md cursor-pointer"
              >
                Yes, Submit Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
