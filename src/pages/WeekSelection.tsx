import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  ArrowLeft,
  UploadCloud,
} from 'lucide-react';
import { getAllQuestions, saveActiveAttempt, getActiveSubjectId } from '../lib/storage';
import { filterQuestionsForTest, generateTestAttempt, computeWeekStats } from '../lib/testEngine';
import { WEEKS_LIST, type Question, type WeekNumber } from '../types';

export const WeekSelection: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialWeek = searchParams.get('week');

  const [questions, setQuestions] = useState<Question[]>([]);
  const activeSubjectId = getActiveSubjectId();
  const [selectedWeek, setSelectedWeek] = useState<WeekNumber>(
    initialWeek !== null
      ? (parseInt(initialWeek, 10) as WeekNumber)
      : activeSubjectId === 'hci'
      ? 1
      : 0
  );
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    const curSubId = getActiveSubjectId();
    getAllQuestions(curSubId).then((qs) => {
      setQuestions(qs);
      if (initialWeek === null) {
        setSelectedWeek(curSubId === 'hci' ? 1 : 0);
      }
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

  const weekStats = computeWeekStats(questions);
  const selectedWeekAssignments = weekStats[selectedWeek].assignmentsVerified;

  const handleStartTest = async () => {
    const config = {
      mode: 'week_wise' as const,
      selectedWeeks: [selectedWeek],
      selectedWeek,
      questionType: 'assignment' as const,
      subjectId: getActiveSubjectId(),
    };

    const eligible = filterQuestionsForTest(questions, config);
    if (eligible.length === 0) {
      alert(`No verified assignment questions available for Week ${selectedWeek}.`);
      return;
    }

    const attempt = generateTestAttempt(eligible, config);
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
            Mode 1: Week-wise Test Selection
          </h1>
          <p className="text-xs text-slate-500">
            {activeSubjectId === 'hci'
              ? 'Select one week from Week 1 to Week 12 to practice its verified assignment questions.'
              : 'Select one week from Week 0 to Week 12 to practice its verified assignment questions.'}
          </p>
        </div>
      </div>

      {/* Week Grid Selection */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Choose Academic Week:</span>
          <span className="text-xs text-blue-600 font-medium">
            {activeSubjectId === 'hci'
              ? 'Human-Computer Interaction (NPTEL Weeks 1–12)'
              : 'Week 0 is a standard syllabus week'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {(activeSubjectId === 'hci' ? WEEKS_LIST.filter((w) => w >= 1) : WEEKS_LIST).map((w) => {
            const isSelected = selectedWeek === w;
            const count = weekStats[w].assignmentsVerified;
            return (
              <button
                key={w}
                id={`week-btn-${w}`}
                type="button"
                onClick={() => setSelectedWeek(w)}
                className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-600/30'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className={`text-base font-bold ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                  Week {w}
                </span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    count > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count} {count === 1 ? 'q' : 'qs'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Week Status Box */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-base">Selected: Week {selectedWeek}</h3>
            </div>
            <p className="text-xs text-slate-600">
              {selectedWeekAssignments > 0
                ? `${selectedWeekAssignments} verified assignment questions ready for randomized testing.`
                : `No verified assignment questions found for Week ${selectedWeek}.`}
            </p>
          </div>

          <div>
            {selectedWeekAssignments > 0 ? (
              <button
                id="start-week-test-btn"
                onClick={handleStartTest}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Start Week {selectedWeek} Test</span>
              </button>
            ) : (
              <Link
                to="/import"
                className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs transition flex items-center gap-1.5"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Import Week {selectedWeek} Questions</span>
              </Link>
            )}
          </div>
        </div>

        {/* Rules note */}
        <div className="text-xs text-slate-500 space-y-1 border-t border-slate-100 pt-4">
          <p className="font-semibold text-slate-700">Mode 1 Test Rules:</p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>Strictly contains original assignment questions from Week {selectedWeek}.</li>
            <li>Additional and practice questions are excluded.</li>
            <li>Questions and option choices are randomized for every attempt.</li>
            <li>Official answer key mappings are preserved accurately.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
