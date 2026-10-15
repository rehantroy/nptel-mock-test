import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  History,
  RotateCcw,
  BookOpen,
  Trash2,
  Clock,
  Award,
  AlertCircle,
  ArrowRight,
  Layers,
} from 'lucide-react';
import {
  getAttempts,
  deleteAttempt,
  clearAttempts,
  getAllQuestions,
  saveActiveAttempt,
} from '../lib/storage';
import { filterQuestionsForTest, generateTestAttempt } from '../lib/testEngine';
import type { TestAttempt, Question } from '../types';

export const AttemptHistory: React.FC = () => {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [atts, qs] = await Promise.all([getAttempts(), getAllQuestions()]);
      setAttempts(atts);
      setQuestions(qs);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleSubjectChanged = () => {
      loadData();
    };

    window.addEventListener('subject_changed', handleSubjectChanged);
    return () => window.removeEventListener('subject_changed', handleSubjectChanged);
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this attempt record from history?')) {
      await deleteAttempt(id);
      await loadData();
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear all attempt history?')) {
      await clearAttempts();
      await loadData();
    }
  };

  const handleRetake = async (att: TestAttempt) => {
    const eligible = filterQuestionsForTest(questions, att.config);
    if (eligible.length === 0) {
      alert('Unable to retake: no eligible questions match this configuration.');
      return;
    }

    const newAttempt = generateTestAttempt(eligible, att.config);
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

  const completedAttempts = attempts.filter((a) => a.isCompleted);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Attempt History & Records
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Review your past mock test scores, time spent, and retake previous test setups.
          </p>
        </div>

        {completedAttempts.length > 0 && (
          <button
            onClick={handleClearAll}
            className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {completedAttempts.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4">
          <History className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800">No Attempts Recorded Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Once you complete a mock test, your scores, detailed answers, and timing metrics will be
            preserved here locally.
          </p>
          <div className="pt-2">
            <Link
              to="/modes"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl inline-flex items-center gap-2 shadow-xs transition"
            >
              <span>Choose a Test Mode</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {completedAttempts.map((att) => {
            const percentage = att.percentage || 0;
            return (
              <div
                key={att.id}
                className="bg-white rounded-3xl p-6 border border-slate-200 hover:border-slate-300 shadow-xs transition space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-bold text-xs uppercase">
                      {att.config.mode.replace('_', ' ')}
                    </span>
                    {att.config.selectedWeeks && (
                      <span className="text-xs text-slate-500 font-medium">
                        Weeks: {att.config.selectedWeeks.join(', ')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(att.completedAt || att.startedAt).toLocaleString()}
                    </span>
                    <button
                      onClick={() => handleDelete(att.id)}
                      className="text-slate-400 hover:text-rose-600 transition"
                      title="Delete this record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-black text-slate-900">
                      {att.score} / {att.totalEligible}
                    </span>
                    <span
                      className={`text-lg font-bold ${
                        percentage >= 75
                          ? 'text-emerald-600'
                          : percentage >= 50
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {percentage}%
                    </span>
                    <span className="text-xs text-slate-400">
                      • {formatTimer(att.timeSpentSeconds)}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/review/${att.id}`)}
                      className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition flex items-center gap-1.5"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Review Answers</span>
                    </button>

                    <button
                      onClick={() => handleRetake(att)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Retake Test</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
