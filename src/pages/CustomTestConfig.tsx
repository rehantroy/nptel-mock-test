import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  SlidersHorizontal,
  ArrowLeft,
  Check,
  PlayCircle,
  AlertCircle,
  HelpCircle,
  CheckSquare,
  Square,
  Tag,
} from 'lucide-react';
import { getAllQuestions, saveActiveAttempt, getActiveSubject } from '../lib/storage';
import { filterQuestionsForTest, generateTestAttempt } from '../lib/testEngine';
import { WEEKS_LIST, type Question, type WeekNumber, type Subject } from '../types';

export const CustomTestConfig: React.FC = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [selectedWeeks, setSelectedWeeks] = useState<WeekNumber[]>([1]);
  const [questionType, setQuestionType] = useState<'assignment' | 'other' | 'both'>('both');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const sub = await getActiveSubject();
    const qs = await getAllQuestions(sub.id);
    setQuestions(qs);
    setActiveSubject(sub);
    setSelectedWeeks(sub.id === 'hci' ? [1] : [0, 1, 2]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    const handleSubjectChanged = () => {
      loadData();
    };

    window.addEventListener('subject_changed', handleSubjectChanged);
    return () => window.removeEventListener('subject_changed', handleSubjectChanged);
  }, []);

  const toggleWeek = (w: WeekNumber) => {
    if (selectedWeeks.includes(w)) {
      if (selectedWeeks.length === 1) return; // Keep at least one selected
      setSelectedWeeks(selectedWeeks.filter((week) => week !== w));
    } else {
      setSelectedWeeks([...selectedWeeks, w].sort((a, b) => a - b) as WeekNumber[]);
    }
  };

  const selectAllWeeks = () => {
    const available = activeSubject?.id === 'hci' ? WEEKS_LIST.filter((w) => w >= 1) : WEEKS_LIST;
    setSelectedWeeks([...available]);
  };

  const deselectAllWeeks = () => {
    setSelectedWeeks([activeSubject?.id === 'hci' ? 1 : 0]);
  };

  // Extract distinct dynamic categories present in questions
  const availableCategories = Array.from(
    new Set(
      questions
        .map((q) => q.categoryName)
        .filter((c): c is string => !!c && c.trim().length > 0)
    )
  );

  const eligibleQuestions = filterQuestionsForTest(questions, {
    mode: 'custom',
    subjectId: activeSubject?.id,
    selectedWeeks,
    questionType,
    categoryIds:
      selectedCategory !== 'all'
        ? questions
            .filter((q) => q.categoryName === selectedCategory && q.categoryId)
            .map((q) => q.categoryId!)
        : undefined,
  });

  const handleStartTest = async () => {
    if (eligibleQuestions.length === 0) {
      alert('No verified questions match the selected weeks and question types.');
      return;
    }

    const config = {
      mode: 'custom' as const,
      subjectId: activeSubject?.id,
      selectedWeeks,
      questionType,
      categoryIds:
        selectedCategory !== 'all'
          ? questions
              .filter((q) => q.categoryName === selectedCategory && q.categoryId)
              .map((q) => q.categoryId!)
          : undefined,
    };

    const attempt = generateTestAttempt(eligibleQuestions, config);
    await saveActiveAttempt(attempt);
    navigate(`/test/${attempt.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link
          to="/modes"
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Mode 2: Custom Test Configuration
          </h1>
          <p className="text-xs text-slate-500">
            Combine multiple academic weeks and choose specific question categories for{' '}
            <span className="font-semibold text-slate-800">{activeSubject?.name}</span>.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-8">
        {/* Step 1: Select Academic Weeks */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">1. Select Weeks to Include</h2>
              <p className="text-xs text-slate-500">
                {activeSubject?.id === 'hci'
                  ? 'Pick any combination from Week 1 to Week 12'
                  : 'Pick any combination from Week 0 to Week 12'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllWeeks}
                className="text-xs font-semibold px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={deselectAllWeeks}
                className="text-xs font-semibold px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
            {(activeSubject?.id === 'hci' ? WEEKS_LIST.filter((w) => w >= 1) : WEEKS_LIST).map((w) => {
              const checked = selectedWeeks.includes(w);
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => toggleWeek(w)}
                  className={`p-3 rounded-2xl border text-center transition flex items-center justify-center gap-2 cursor-pointer ${
                    checked
                      ? 'border-blue-600 bg-blue-50/80 text-blue-700 font-bold ring-1 ring-blue-500/30'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {checked ? (
                    <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span className="text-sm">Week {w}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Question Type Selection */}
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">2. Select Question Types</h2>
            <p className="text-xs text-slate-500">
              Choose which question sources are included in this attempt
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'assignment',
                label: 'Assignment Questions Only',
                desc: 'Official weekly assignment problems only.',
              },
              {
                id: 'other',
                label: 'Other Questions Only',
                desc: 'Additional problem sets and extra questions only.',
              },
              {
                id: 'both',
                label: 'Both (Assignment + Other)',
                desc: 'Combined pool of assignments and additional questions.',
              },
            ].map((t) => {
              const active = questionType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setQuestionType(t.id as any)}
                  className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                    active
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-bold ${active ? 'text-blue-700' : 'text-slate-900'}`}
                    >
                      {t.label}
                    </span>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        active ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                      }`}
                    >
                      {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{t.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3: Optional Dynamic Category Filter */}
        {availableCategories.length > 0 && (
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">
                3. Optional: Filter by Detected Category
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Filter by specific dynamic sections detected in your uploaded documents.
            </p>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="p-2.5 rounded-xl border border-slate-200 text-sm bg-white font-medium text-slate-800"
            >
              <option value="all">All Categories (Include All Matching Types)</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Configuration Summary & Launch Banner */}
        <div className="p-6 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
              Test Configuration Summary
            </div>
            <div className="text-lg font-bold">
              {selectedWeeks.length} {selectedWeeks.length === 1 ? 'Week' : 'Weeks'} Selected •{' '}
              {questionType === 'both'
                ? 'Both Categories'
                : questionType === 'assignment'
                ? 'Assignments Only'
                : 'Other Questions Only'}
              {selectedCategory !== 'all' && ` • ${selectedCategory}`}
            </div>
            <div className="text-xs text-slate-400">
              {eligibleQuestions.length > 0
                ? `${eligibleQuestions.length} eligible verified questions matched.`
                : 'No eligible verified questions match this combination.'}
            </div>
          </div>

          <button
            onClick={handleStartTest}
            disabled={eligibleQuestions.length === 0}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition flex items-center gap-2 shrink-0 ${
              eligibleQuestions.length === 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 cursor-pointer'
            }`}
          >
            <PlayCircle className="w-5 h-5" />
            <span>Start Custom Test ({eligibleQuestions.length} Qs)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
