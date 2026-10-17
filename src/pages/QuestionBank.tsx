import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  XCircle,
  Edit,
  Trash2,
  Download,
  Plus,
  UploadCloud,
  FileText,
  Copy,
  ChevronDown,
  X,
  Save,
  Sparkles,
} from 'lucide-react';
import {
  getAllQuestions,
  saveQuestion,
  deleteQuestion,
  exportDatabase,
  getCategories,
  getActiveSubjectId,
} from '../lib/storage';
import { preloadIndustrialIoTBank, preloadHCIBank } from '../lib/preloadData';
import { cleanOldOcrImports } from '../lib/cleanupOldImports';
import { FormattedContent } from '../components/FormattedContent';
import {
  WEEKS_LIST,
  type Question,
  type WeekNumber,
  type VerificationStatus,
  type QuestionCategory,
} from '../types';

export const QuestionBank: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [preloading, setPreloading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadQuestions = async () => {
    try {
      const [qs, cats] = await Promise.all([getAllQuestions(), getCategories()]);
      setQuestions(qs);
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load questions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();

    const handleSubjectChanged = () => {
      loadQuestions();
    };

    const handleQuestionsUpdated = () => {
      loadQuestions();
    };

    window.addEventListener('subject_changed', handleSubjectChanged);
    window.addEventListener('questions_updated', handleQuestionsUpdated);
    return () => {
      window.removeEventListener('subject_changed', handleSubjectChanged);
      window.removeEventListener('questions_updated', handleQuestionsUpdated);
    };
  }, []);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => {
        setFeedback(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const confirmDelete = async () => {
    if (!questionToDelete) return;
    setIsDeleting(true);
    const targetId = questionToDelete.id;
    const targetNum = questionToDelete.originalQuestionNumber;

    try {
      const res = await deleteQuestion(targetId);
      if (res.success) {
        // Immediate UI update across current list and active filters
        setQuestions((prev) => prev.filter((q) => q.id !== targetId));

        // Close editor modal if open for this question
        if (editingQuestion?.id === targetId) {
          setEditingQuestion(null);
        }

        setQuestionToDelete(null);
        setFeedback({
          type: 'success',
          message: `Question #${targetNum} was successfully deleted from the Question Bank.`,
        });

        // Background re-sync with storage
        await loadQuestions();
      } else {
        // If deletion fails, keep the question visible and notify user
        setQuestionToDelete(null);
        setFeedback({
          type: 'error',
          message: res.error || 'Failed to delete question. The question was preserved.',
        });
      }
    } catch (err: any) {
      setQuestionToDelete(null);
      setFeedback({
        type: 'error',
        message: err?.message || 'An unexpected error occurred during question deletion.',
      });
    } finally {
      setIsDeleting(false);
    }
  };


  const handleExportJSON = async () => {
    const activeId = getActiveSubjectId();
    const backup = await exportDatabase(activeId);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeId}_question_bank_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreloadBank = async () => {
    setPreloading(true);
    try {
      const activeId = getActiveSubjectId();
      const res = activeId === 'hci' ? await preloadHCIBank() : await preloadIndustrialIoTBank();
      setFeedback({
        type: res.success ? 'success' : 'error',
        message: res.message,
      });
      await loadQuestions();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to preload question bank.',
      });
    } finally {
      setPreloading(false);
    }
  };

  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);

  const executeCleanup = async () => {
    setCleaning(true);
    setShowCleanupConfirm(false);
    try {
      const res = await cleanOldOcrImports(false);
      setFeedback({
        type: res.success ? 'success' : 'error',
        message: res.message,
      });
      await loadQuestions();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Cleanup failed.',
      });
    } finally {
      setCleaning(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingQuestion) return;
    await saveQuestion(editingQuestion);
    setEditingQuestion(null);
    await loadQuestions();
  };

  // Filtering
  const filteredQuestions = questions.filter((q) => {
    if (selectedWeek !== 'all' && q.week !== parseInt(selectedWeek, 10)) {
      return false;
    }
    if (selectedType !== 'all' && q.questionType !== selectedType) {
      return false;
    }
    if (selectedCategory !== 'all') {
      if (q.categoryId !== selectedCategory && q.categoryName !== selectedCategory) {
        return false;
      }
    }
    if (selectedStatus !== 'all' && q.verificationStatus !== selectedStatus) {
      return false;
    }
    if (searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase();
      const matchText = q.questionText.toLowerCase().includes(qLower);
      const matchNum = String(q.originalQuestionNumber).includes(qLower);
      const matchFile = (q.sourceFilename || '').toLowerCase().includes(qLower);
      if (!matchText && !matchNum && !matchFile) return false;
    }
    return true;
  });

  const verifiedCount = questions.filter((q) => q.verificationStatus === 'verified').length;
  const reviewCount = questions.filter((q) => q.verificationStatus === 'needs_review').length;
  const needsKeyCount = questions.filter((q) => q.verificationStatus === 'needs_answer_key').length;
  const rejectedCount = questions.filter((q) => q.verificationStatus === 'rejected').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      {/* Feedback Notification Banner */}
      {feedback && (
        <div
          role="alert"
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 border transition-all animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5 text-sm font-semibold">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 cursor-pointer"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Question Bank Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Search, review, edit, and organize all imported Industrial IoT questions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePreloadBank}
            disabled={preloading}
            className="px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Preload or verify all 375 official course questions from the source PDF"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>{preloading ? 'Preloading...' : 'Preload Official Bank (375 Qs)'}</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Export Bank (JSON)</span>
          </button>
          <Link
            to="/import"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Import Questions</span>
          </Link>
        </div>
      </div>

      {/* Legacy OCR / Upload Cleanup Alert */}
      {questions.length > 375 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs font-bold">
                {questions.length - 375} Legacy Web/OCR Questions Detected
              </p>
              <p className="text-[11px] text-amber-700">
                The Question Bank currently has {questions.length} questions. You can clean up the {questions.length - 375} previously uploaded OCR questions and keep only the 375 verified official course questions.
              </p>
            </div>
          </div>
          {showCleanupConfirm ? (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-rose-800">Proceed with deletion?</span>
              <button
                onClick={executeCleanup}
                disabled={cleaning}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl transition shadow-xs cursor-pointer"
              >
                {cleaning ? 'Cleaning...' : 'Yes, Clean Up'}
              </button>
              <button
                onClick={() => setShowCleanupConfirm(false)}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCleanupConfirm(true)}
              disabled={cleaning}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{cleaning ? 'Cleaning Up...' : `Clean Up ${questions.length - 375} Legacy Questions`}</span>
            </button>
          )}
        </div>
      )}

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">Total in Bank</div>
          <div className="text-2xl font-bold text-slate-900 mt-0.5">{questions.length}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Verified Ready</span>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-0.5">{verifiedCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-amber-600 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Needs Review</span>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-0.5">{reviewCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-purple-600 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Needs Answer Key</span>
          </div>
          <div className="text-2xl font-bold text-purple-700 mt-0.5">{needsKeyCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by question text, question number, or source file..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Week Dropdown */}
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
          >
            <option value="all">
              {getActiveSubjectId() === 'hci' ? 'All Weeks (1–12)' : 'All Weeks (0–12)'}
            </option>
            {(getActiveSubjectId() === 'hci' ? WEEKS_LIST.filter((w) => w >= 1) : WEEKS_LIST).map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>

          {/* Type Dropdown */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
          >
            <option value="all">All Question Types</option>
            <option value="assignment">Assignment Questions</option>
            <option value="other">Other Questions</option>
          </select>

          {/* Category Dropdown */}
          {categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Status Dropdown */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
          >
            <option value="all">All Verification Statuses</option>
            <option value="verified">Verified</option>
            <option value="needs_review">Needs Review</option>
            <option value="needs_answer_key">Needs Answer Key</option>
            <option value="extracted">Extracted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span>Showing {filteredQuestions.length} of {questions.length} questions</span>
          {(selectedWeek !== 'all' || selectedType !== 'all' || selectedCategory !== 'all' || selectedStatus !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedWeek('all');
                setSelectedType('all');
                setSelectedCategory('all');
                setSelectedStatus('all');
                setSearchQuery('');
              }}
              className="text-blue-600 font-semibold hover:underline"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Question List */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 text-lg">No Questions Match Criteria</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {questions.length === 0
              ? 'The question bank is completely empty. Import your original assignment files to begin.'
              : 'Try adjusting your search query or filter selections.'}
          </p>
          {questions.length === 0 && (
            <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={handlePreloadBank}
                disabled={preloading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {preloading
                    ? 'Preloading...'
                    : getActiveSubjectId() === 'hci'
                    ? 'Preload 20 Official HCI Questions'
                    : 'Preload 375 Official Questions'}
                </span>
              </button>
              <Link
                to="/import"
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold inline-block"
              >
                Go to Import Screen
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((q) => {
            const isVerified = q.verificationStatus === 'verified';
            return (
              <div
                key={q.id}
                className="bg-white rounded-3xl p-6 border border-slate-200 hover:border-slate-300 transition shadow-xs space-y-4"
              >
                {/* Meta info & actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">
                      Orig Q#{q.originalQuestionNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                      Week {q.week}
                    </span>
                    {q.categoryName ? (
                      <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-xs font-semibold">
                        {q.categoryName}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold uppercase">
                        {q.questionType}
                      </span>
                    )}
                    {q.duplicateStatus === 'potential_duplicate' && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-xs font-semibold">
                        Potential Duplicate
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Verification Status Badge */}
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                        q.verificationStatus === 'verified'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : q.verificationStatus === 'needs_review'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : q.verificationStatus === 'needs_answer_key'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {q.verificationStatus.replace('_', ' ')}
                    </span>

                    {/* Action buttons */}
                    <button
                      type="button"
                      onClick={() => setEditingQuestion({ ...q })}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition cursor-pointer"
                      title="Edit Question"
                      data-testid={`edit-question-${q.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestionToDelete(q)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 transition cursor-pointer"
                      title="Delete Question"
                      data-testid={`delete-question-${q.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Question Text */}
                <div className="text-base text-slate-900 font-medium">
                  <FormattedContent content={q.questionText} />
                </div>

                {/* Options List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {q.options.map((opt, optIdx) => {
                    const label = ['A', 'B', 'C', 'D', 'E'][optIdx] || String(optIdx + 1);
                    const isCorrect = q.correctOptionId === opt.id;
                    return (
                      <div
                        key={opt.id}
                        className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                          isCorrect
                            ? 'bg-emerald-50/70 border-emerald-300 font-medium text-emerald-900'
                            : 'bg-slate-50/50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 ${
                            isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {label}
                        </span>
                        <div className="flex-1">
                          <FormattedContent content={opt.text} />
                        </div>
                        {isCorrect && (
                          <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                            KEY
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Source & Notes */}
                <div className="text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <span>
                    Source: {q.sourceFilename || 'Document'}{' '}
                    {q.sourcePageNumber ? `(Page ${q.sourcePageNumber})` : ''}
                  </span>
                  {q.notes && <span className="text-amber-600 font-medium">{q.notes}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Question Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 my-8 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-lg">Edit Question</h3>
              <button
                onClick={() => setEditingQuestion(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Week Number (0–12)</label>
                  <select
                    value={editingQuestion.week}
                    onChange={(e) =>
                      setEditingQuestion({
                        ...editingQuestion,
                        week: parseInt(e.target.value, 10) as WeekNumber,
                      })
                    }
                    className="w-full p-2 rounded-xl border border-slate-200 text-sm"
                  >
                    {WEEKS_LIST.map((w) => (
                      <option key={w} value={w}>
                        Week {w}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Question Type</label>
                  <select
                    value={editingQuestion.questionType}
                    onChange={(e) =>
                      setEditingQuestion({
                        ...editingQuestion,
                        questionType: e.target.value as any,
                      })
                    }
                    className="w-full p-2 rounded-xl border border-slate-200 text-sm"
                  >
                    <option value="assignment">Assignment Question</option>
                    <option value="other">Other Question</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Verification Status</label>
                  <select
                    value={editingQuestion.verificationStatus}
                    onChange={(e) =>
                      setEditingQuestion({
                        ...editingQuestion,
                        verificationStatus: e.target.value as VerificationStatus,
                      })
                    }
                    className="w-full p-2 rounded-xl border border-slate-200 text-sm"
                  >
                    <option value="verified">Verified</option>
                    <option value="needs_review">Needs Review</option>
                    <option value="needs_answer_key">Needs Answer Key</option>
                    <option value="extracted">Extracted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Original Question Number</label>
                <input
                  type="text"
                  value={editingQuestion.originalQuestionNumber}
                  onChange={(e) =>
                    setEditingQuestion({
                      ...editingQuestion,
                      originalQuestionNumber: e.target.value,
                    })
                  }
                  className="w-full p-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Question Text</label>
                <textarea
                  rows={4}
                  value={editingQuestion.questionText}
                  onChange={(e) =>
                    setEditingQuestion({
                      ...editingQuestion,
                      questionText: e.target.value,
                    })
                  }
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm font-sans"
                />
              </div>

              {/* Options Editor */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-700 block">Answer Options & Correct Key</label>
                {editingQuestion.options.map((opt, i) => {
                  const label = ['A', 'B', 'C', 'D', 'E'][i] || String(i + 1);
                  const isCorrect = editingQuestion.correctOptionId === opt.id;
                  return (
                    <div key={opt.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingQuestion({
                            ...editingQuestion,
                            correctOptionId: opt.id,
                          })
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          isCorrect
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        title="Click to set as correct answer"
                      >
                        Option {label} {isCorrect && '✓'}
                      </button>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const updated = [...editingQuestion.options];
                          updated[i] = { ...opt, text: e.target.value };
                          setEditingQuestion({ ...editingQuestion, options: updated });
                        }}
                        className="flex-1 p-2 rounded-xl border border-slate-200 text-sm"
                      />
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Source Explanation (Optional — only if provided in official source)
                </label>
                <textarea
                  rows={2}
                  value={editingQuestion.explanation || ''}
                  onChange={(e) =>
                    setEditingQuestion({
                      ...editingQuestion,
                      explanation: e.target.value || undefined,
                    })
                  }
                  className="w-full p-2 rounded-xl border border-slate-200 text-sm"
                  placeholder="Official explanation directly from document..."
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setQuestionToDelete(editingQuestion)}
                className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
                title="Delete this question"
                data-testid="edit-modal-delete-btn"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Question</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Question</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Question Deletion Confirmation Dialog */}
      {questionToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-rose-600 pb-2 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Delete Question?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 text-xs space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">
                  Orig Q#{questionToDelete.originalQuestionNumber}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700 font-semibold text-[10px]">
                  Week {questionToDelete.week}
                </span>
                {questionToDelete.categoryName && (
                  <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold text-[10px]">
                    {questionToDelete.categoryName}
                  </span>
                )}
              </div>
              <p className="text-slate-600 line-clamp-2 italic">
                &ldquo;{questionToDelete.questionText}&rdquo;
              </p>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Permanently removes this question from the persistent question bank. Remaining questions in Week {questionToDelete.week} and previous test attempt scores will stay intact.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setQuestionToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
                data-testid="cancel-delete-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                data-testid="confirm-delete-btn"
              >
                {isDeleting ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Delete Question</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
