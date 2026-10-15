import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PlayCircle,
  UploadCloud,
  Database,
  CheckCircle2,
  AlertCircle,
  Award,
  Layers,
  ArrowRight,
  RotateCcw,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  getAllQuestions,
  getAttempts,
  getActiveAttempt,
  getActiveSubject,
} from '../lib/storage';
import { computeWeekStats } from '../lib/testEngine';
import { WEEKS_LIST, DEFAULT_SUBJECT, type Question, type TestAttempt, type WeekNumber, type Subject } from '../types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeSubject, setActiveSubject] = useState<Subject>(DEFAULT_SUBJECT);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [activeAttempt, setActiveAttempt] = useState<TestAttempt | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [curSub, qs, atts, active] = await Promise.all([
        getActiveSubject(),
        getAllQuestions(),
        getAttempts(),
        getActiveAttempt(),
      ]);
      setActiveSubject(curSub);
      setQuestions(qs);
      setAttempts(atts);
      setActiveAttempt(active && !active.isCompleted ? active : null);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
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

  const verifiedQuestions = questions.filter((q) => q.verificationStatus === 'verified');
  const needsReviewQuestions = questions.filter(
    (q) => q.verificationStatus === 'needs_review' || q.verificationStatus === 'extracted' || q.verificationStatus === 'needs_answer_key'
  );

  const weekStats = computeWeekStats(questions);

  const completedAttempts = attempts.filter((a) => a.isCompleted);
  const avgScore =
    completedAttempts.length > 0
      ? Math.round(
          completedAttempts.reduce((acc, a) => acc + (a.percentage || 0), 0) /
            completedAttempts.length
        )
      : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Resume Active Attempt Banner if exists */}
      {activeAttempt && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">In-Progress Test Attempt Detected</h3>
              <p className="text-xs text-slate-600">
                You have an unfinished attempt ({activeAttempt.config.mode.replace('_', ' ').toUpperCase()}) saved locally.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/test/${activeAttempt.id}`)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm rounded-xl transition shadow-xs flex items-center gap-2"
          >
            <span>Resume Test</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 rounded-3xl p-6 sm:p-10 text-white shadow-lg">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-medium tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            <span>{activeSubject.code ? `${activeSubject.name} (${activeSubject.code})` : activeSubject.name}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {activeSubject.name} Mock Test Platform
          </h1>
          <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
            {activeSubject.description ||
              'Practice and master official assignment questions and verified problem sets across all 13 weeks (Week 0 to Week 12). Shuffled tests, instant scoring, and answer verification.'}
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              to="/modes"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-blue-700 font-semibold text-sm hover:bg-blue-50 transition shadow-md"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Start Mock Test</span>
            </Link>
            <Link
              to="/import"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600/40 hover:bg-blue-600/60 border border-white/20 text-white font-medium text-sm transition"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Import PDFs & Keys</span>
            </Link>
            <Link
              to="/bank"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition"
            >
              <Database className="w-4 h-4" />
              <span>Browse Bank</span>
            </Link>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{verifiedQuestions.length}</div>
            <div className="text-xs text-slate-500 font-medium">Verified Questions</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{needsReviewQuestions.length}</div>
            <div className="text-xs text-slate-500 font-medium">Needing Review / Key</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{completedAttempts.length}</div>
            <div className="text-xs text-slate-500 font-medium">Tests Completed</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{avgScore}%</div>
            <div className="text-xs text-slate-500 font-medium">Average Score</div>
          </div>
        </div>
      </div>

      {/* Empty State Banner if 0 verified questions */}
      {verifiedQuestions.length === 0 && (
        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-6 text-center space-y-3">
          <div className="inline-flex p-3 rounded-full bg-blue-100 text-blue-600">
            <UploadCloud className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-slate-900 text-base">Your Question Bank is Empty</h3>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            As per the strict academic integrity policy, no fabricated questions have been pre-loaded.
            Import your official NPTEL assignment PDFs, answer keys, or structured CSV/JSON files to begin testing.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              to="/import"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl transition shadow-xs"
            >
              Import Assignment Documents
            </Link>
          </div>
        </div>
      )}

      {/* Week by Week Matrix Grid (Week 0 to Week 12) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Course Syllabus & Weeks Matrix</h2>
            <p className="text-xs text-slate-500">
              All 13 weeks (Week 0 to Week 12) — Assignment & Additional Question coverage
            </p>
          </div>
          <Link
            to="/modes/custom"
            className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <span>Custom Multi-Week Test</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {WEEKS_LIST.map((w: WeekNumber) => {
            const st = weekStats[w];
            const hasVerified = st.totalVerified > 0;
            return (
              <div
                key={w}
                className={`bg-white rounded-2xl p-4 border transition hover:shadow-md flex flex-col justify-between gap-3 ${
                  hasVerified ? 'border-slate-200' : 'border-slate-200/60 bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-base">Week {w}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        hasVerified
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {st.totalVerified} Ready
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Assignments:</span>
                      <span className="font-medium text-slate-800">{st.assignmentsVerified}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Other Questions:</span>
                      <span className="font-medium text-slate-800">{st.otherVerified}</span>
                    </div>
                    {st.unverified > 0 && (
                      <div className="flex justify-between items-center text-amber-600">
                        <span>Needs Review:</span>
                        <span className="font-medium">{st.unverified}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  {st.assignmentsVerified > 0 ? (
                    <button
                      onClick={() => navigate(`/modes/week-wise?week=${w}`)}
                      className="w-full py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>Take Week {w} Test</span>
                    </button>
                  ) : (
                    <Link
                      to="/import"
                      className="block text-center py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-medium transition"
                    >
                      + Import Week {w}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Attempts Section */}
      {completedAttempts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Recent Test Attempts</h2>
            <Link
              to="/history"
              className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>View Full History ({completedAttempts.length})</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {completedAttempts.slice(0, 3).map((att) => (
              <div
                key={att.id}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 uppercase">
                      {att.config.mode.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(att.completedAt || att.startedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900">
                      {att.score} / {att.totalEligible}
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        (att.percentage || 0) >= 70
                          ? 'text-emerald-600'
                          : (att.percentage || 0) >= 50
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}
                    >
                      ({att.percentage}%)
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => navigate(`/review/${att.id}`)}
                    className="flex-1 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition"
                  >
                    Review Answers
                  </button>
                  <button
                    onClick={() => navigate(`/results/${att.id}`)}
                    className="flex-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-medium text-white transition"
                  >
                    View Score
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
