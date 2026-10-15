import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  SlidersHorizontal,
  Layers,
  Sparkles,
  GraduationCap,
  ArrowRight,
  AlertCircle,
  PlayCircle,
} from 'lucide-react';
import { getAllQuestions, saveActiveAttempt, getActiveSubjectId } from '../lib/storage';
import { filterQuestionsForTest, generateTestAttempt } from '../lib/testEngine';
import type { Question } from '../types';

export const ModeSelection: React.FC = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    getAllQuestions().then((qs) => {
      setQuestions(qs);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();

    const handleSubjectChanged = () => {
      loadData();
    };

    window.addEventListener('subject_changed', handleSubjectChanged);
    return () => window.removeEventListener('subject_changed', handleSubjectChanged);
  }, []);

  const verified = questions.filter((q) => q.verificationStatus === 'verified');
  const assignmentQuestions = verified.filter((q) => q.questionType === 'assignment');
  const otherQuestions = verified.filter((q) => q.questionType === 'other');

  const startDirectMode = async (
    mode: 'all_week' | 'other_all' | 'all_questions'
  ) => {
    const config = {
      mode,
      selectedWeeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as any,
      questionType: (mode === 'all_week' ? 'assignment' : mode === 'other_all' ? 'other' : 'both') as any,
      subjectId: getActiveSubjectId(),
    };

    const eligible = filterQuestionsForTest(questions, config);
    if (eligible.length === 0) {
      alert(`No eligible verified questions available for ${mode.replace('_', ' ')}. Please import and verify questions first.`);
      return;
    }

    const attempt = generateTestAttempt(eligible, config);
    await saveActiveAttempt(attempt);
    navigate(`/test/${attempt.id}`);
  };

  const modes = [
    {
      id: 'week_wise',
      title: 'Mode 1: Week-wise Test',
      subtitle: 'Single Week • Assignment Questions Only',
      desc: 'Select a specific week from Week 0 to Week 12. Focuses exclusively on the verified original assignment questions for that syllabus module.',
      icon: Calendar,
      countBadge: `${assignmentQuestions.length} Assignments across 13 Weeks`,
      actionText: 'Choose Week (0–12)',
      onClick: () => navigate('/modes/week-wise'),
      color: 'blue',
    },
    {
      id: 'custom',
      title: 'Mode 2: Custom Test',
      subtitle: 'Multi-Week • Filter by Question Type',
      desc: 'Customize your test: pick one or several weeks, and choose Assignment only, Other only, or Both. Tailor your practice session to your weak topics.',
      icon: SlidersHorizontal,
      countBadge: `${verified.length} Total Verified Questions`,
      actionText: 'Configure Custom Test',
      onClick: () => navigate('/modes/custom'),
      color: 'indigo',
    },
    {
      id: 'all_week',
      title: 'Mode 3: All Week Test',
      subtitle: 'All Weeks 0–12 • Assignment Questions Only',
      desc: 'Comprehensive assignment exam covering all eligible assignment questions across every week from Week 0 to Week 12. No extra questions included.',
      icon: Layers,
      countBadge: `${assignmentQuestions.length} Eligible Questions`,
      actionText: 'Start All Weeks Assignment Test',
      onClick: () => startDirectMode('all_week'),
      disabled: assignmentQuestions.length === 0,
      color: 'emerald',
    },
    {
      id: 'other_all',
      title: 'Mode 4: Other Questions — All Weeks',
      subtitle: 'All Weeks • Additional Problem Sets Only',
      desc: 'Practices all additional/practice questions across all weeks. Weeks without additional questions are automatically skipped with zero fake questions.',
      icon: Sparkles,
      countBadge: `${otherQuestions.length} Eligible Additional Questions`,
      actionText: 'Start Other Questions Test',
      onClick: () => startDirectMode('other_all'),
      disabled: otherQuestions.length === 0,
      color: 'purple',
    },
    {
      id: 'all_questions',
      title: 'Mode 5: All Questions Test',
      subtitle: 'Complete Master Revision • All Weeks & Types',
      desc: 'The ultimate final revision test. Combines all verified assignment questions and additional questions across all 13 weeks. Strictly deduplicated.',
      icon: GraduationCap,
      countBadge: `${verified.length} Total Eligible Questions`,
      actionText: 'Start Complete Revision Test',
      onClick: () => startDirectMode('all_questions'),
      disabled: verified.length === 0,
      color: 'amber',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Select Test Mode
        </h1>
        <p className="text-sm text-slate-600">
          Choose from five specialized exam modes designed for targeted practice and comprehensive revision.
        </p>
      </div>

      {verified.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-800 text-sm">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Question Bank is currently empty.</span> You can explore the mode settings, but to start a test, please first import your assignment documents or answer keys via the{' '}
            <button
              onClick={() => navigate('/import')}
              className="underline font-semibold hover:text-amber-950"
            >
              Import Page
            </button>
            .
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modes.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.id}
              className={`bg-white rounded-3xl p-6 border transition flex flex-col justify-between shadow-xs hover:shadow-md ${
                m.disabled ? 'opacity-80 border-slate-200' : 'border-slate-200 hover:border-blue-300'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                    {m.countBadge}
                  </span>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-900">{m.title}</h2>
                  <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mt-0.5">
                    {m.subtitle}
                  </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">{m.desc}</p>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100">
                <button
                  onClick={m.onClick}
                  disabled={m.disabled}
                  className={`w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition shadow-xs ${
                    m.disabled
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                  }`}
                >
                  <PlayCircle className="w-4 h-4" />
                  <span>{m.actionText}</span>
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
