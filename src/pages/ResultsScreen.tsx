import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  BookOpen,
  ArrowRight,
  Clock,
  ChevronRight,
  Share2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { getAttempt, getAllQuestions, saveActiveAttempt } from '../lib/storage';
import { filterQuestionsForTest, generateTestAttempt } from '../lib/testEngine';
import type { TestAttempt, Question } from '../types';

export const ResultsScreen: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadResults() {
      try {
        if (!attemptId) return;
        const [att, qs] = await Promise.all([getAttempt(attemptId), getAllQuestions()]);
        setAttempt(att || null);
        setQuestions(qs);

        // Confetti if score >= 75%
        if (att && (att.percentage || 0) >= 75) {
          try {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 },
            });
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.error('Failed to load attempt result:', err);
      } finally {
        setLoading(false);
      }
    }
    loadResults();
  }, [attemptId]);

  const handleRetake = async () => {
    if (!attempt) return;
    const eligible = filterQuestionsForTest(questions, attempt.config);
    if (eligible.length === 0) {
      alert('Unable to retake: no eligible questions available.');
      return;
    }
    // Re-randomizes question order and options
    const newAttempt = generateTestAttempt(eligible, attempt.config);
    await saveActiveAttempt(newAttempt);
    navigate(`/test/${newAttempt.id}`);
  };

  const formatTimer = (totalSecs?: number) => {
    if (!totalSecs) return '00:00';
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs}s`;
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
        <h2 className="text-xl font-bold text-slate-900">Result Not Found</h2>
        <p className="text-sm text-slate-500">Attempt could not be retrieved from local history.</p>
        <Link
          to="/"
          className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const percentage = attempt.percentage || 0;
  const passed = percentage >= 50;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Score Hero Card */}
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center space-y-6">
        <div className="inline-flex p-4 rounded-3xl bg-blue-50 text-blue-600">
          <Award className="w-12 h-12" />
        </div>

        <div className="space-y-1">
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-widest">
            Mock Test Results
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900">
            {attempt.score} / {attempt.totalEligible}
          </h1>
          <div
            className={`text-lg font-bold ${
              percentage >= 75
                ? 'text-emerald-600'
                : percentage >= 50
                ? 'text-amber-600'
                : 'text-rose-600'
            }`}
          >
            {percentage}% — {percentage >= 75 ? 'Excellent Performance!' : passed ? 'Passed' : 'Needs Practice'}
          </div>
        </div>

        {/* Breakdown Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
            <div className="flex items-center justify-center gap-1 text-emerald-700 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Correct</span>
            </div>
            <div className="text-xl font-bold text-emerald-900 mt-1">{attempt.correctCount}</div>
          </div>

          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100">
            <div className="flex items-center justify-center gap-1 text-rose-700 text-xs font-semibold">
              <XCircle className="w-3.5 h-3.5" />
              <span>Incorrect</span>
            </div>
            <div className="text-xl font-bold text-rose-900 mt-1">{attempt.incorrectCount}</div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-center gap-1 text-slate-600 text-xs font-semibold">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Unanswered</span>
            </div>
            <div className="text-xl font-bold text-slate-900 mt-1">{attempt.unansweredCount}</div>
          </div>

          <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100">
            <div className="flex items-center justify-center gap-1 text-blue-700 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>Time Taken</span>
            </div>
            <div className="text-xl font-bold text-blue-900 mt-1">
              {formatTimer(attempt.timeSpentSeconds)}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => navigate(`/review/${attempt.id}`)}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition shadow-md flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            <span>Review All Questions & Answers</span>
            <ChevronRight className="w-4 h-4 ml-auto" />
          </button>

          <button
            onClick={handleRetake}
            className="py-3 px-5 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold text-sm text-slate-700 transition flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retake Test (New Shuffled Order)</span>
          </button>
        </div>
      </div>

      {/* Test Meta Info Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-semibold text-slate-900">Mode:</span>{' '}
          <span className="uppercase">{attempt.config.mode.replace('_', ' ')}</span>
          {attempt.config.selectedWeeks && (
            <span className="ml-2 text-slate-500">
              (Weeks: {attempt.config.selectedWeeks.join(', ')})
            </span>
          )}
        </div>
        <div>
          <span className="font-semibold text-slate-900">Submitted:</span>{' '}
          <span>{new Date(attempt.completedAt || attempt.startedAt).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};
