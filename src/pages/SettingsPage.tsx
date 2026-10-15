import React, { useState, useEffect } from 'react';
import {
  Settings,
  HardDrive,
  Download,
  Upload,
  AlertTriangle,
  ShieldAlert,
  Info,
  CheckCircle2,
  Trash2,
  Sparkles,
  BookOpen,
  Plus,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  exportDatabase,
  importDatabaseBackup,
  clearAllQuestions,
  clearAttempts,
  getAllQuestions,
  getAttempts,
  getSubjects,
  saveSubject,
  deleteSubject,
  getActiveSubjectId,
  setActiveSubjectId,
} from '../lib/storage';
import { preloadIndustrialIoTBank } from '../lib/preloadData';
import { cleanOldOcrImports } from '../lib/cleanupOldImports';
import { DEFAULT_SUBJECT, type Subject } from '../types';

export const SettingsPage: React.FC = () => {
  const [questionCount, setQuestionCount] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSubId, setActiveSubId] = useState<string>(DEFAULT_SUBJECT.id);
  const [subjectCounts, setSubjectCounts] = useState<Record<string, number>>({});
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubId, setNewSubId] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubDesc, setNewSubDesc] = useState('');
  const [restoreFeedback, setRestoreFeedback] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadFeedback, setPreloadFeedback] = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupFeedback, setCleanupFeedback] = useState<string | null>(null);

  const handlePreloadOfficialBank = async (force: boolean = false) => {
    setIsPreloading(true);
    setPreloadFeedback(null);
    try {
      const res = await preloadIndustrialIoTBank(force);
      setPreloadFeedback(res.message);
      await loadStats();
    } catch (err: any) {
      setPreloadFeedback(`Error: ${err?.message || 'Failed to preload'}`);
    } finally {
      setIsPreloading(false);
    }
  };

  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);

  const executeCleanup = async () => {
    setIsCleaning(true);
    setShowCleanupConfirm(false);
    setCleanupFeedback(null);
    try {
      const res = await cleanOldOcrImports(false);
      setCleanupFeedback(res.message);
      await loadStats();
    } catch (err: any) {
      setCleanupFeedback(`Cleanup error: ${err?.message || 'Failed to clean old imports'}`);
    } finally {
      setIsCleaning(false);
    }
  };

  const loadStats = async () => {
    try {
      const curId = getActiveSubjectId();
      setActiveSubId(curId);

      const [qs, atts, subs] = await Promise.all([
        getAllQuestions(curId),
        getAttempts(curId),
        getSubjects(),
      ]);
      setQuestionCount(qs.length);
      setAttemptCount(atts.length);
      setSubjects(subs);

      // Compute question counts for each subject
      const counts: Record<string, number> = {};
      for (const s of subs) {
        const subQs = await getAllQuestions(s.id);
        counts[s.id] = subQs.length;
      }
      setSubjectCounts(counts);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadStats();

    const handleSubjectChanged = () => {
      loadStats();
    };

    window.addEventListener('subject_changed', handleSubjectChanged);
    return () => window.removeEventListener('subject_changed', handleSubjectChanged);
  }, []);

  const handleSelectSubject = (id: string) => {
    setActiveSubjectId(id);
    setActiveSubId(id);
    loadStats();
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newSubId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const cleanName = newSubName.trim();
    if (!cleanId || !cleanName) {
      alert('Please provide a valid Subject ID and Name.');
      return;
    }

    if (subjects.some((s) => s.id === cleanId)) {
      alert('A subject with this ID already exists. Please pick a unique ID.');
      return;
    }

    const newSub: Subject = {
      id: cleanId,
      name: cleanName,
      code: newSubCode.trim().toUpperCase() || cleanId.toUpperCase(),
      description: newSubDesc.trim() || undefined,
      maxWeeks: 12,
      createdAt: new Date().toISOString(),
    };

    await saveSubject(newSub);
    setActiveSubjectId(newSub.id);
    setShowAddSubject(false);
    setNewSubId('');
    setNewSubName('');
    setNewSubCode('');
    setNewSubDesc('');
    await loadStats();
  };

  const handleDeleteSubject = async (sub: Subject) => {
    if (sub.isDefault || sub.id === DEFAULT_SUBJECT.id) {
      alert('Cannot delete the default subject.');
      return;
    }

    const count = subjectCounts[sub.id] || 0;
    if (count > 0) {
      alert(
        `Cannot delete "${sub.name}": it has ${count} associated questions. Please delete or migrate the questions first.`
      );
      return;
    }

    if (window.confirm(`Are you sure you want to delete subject "${sub.name}"?`)) {
      await deleteSubject(sub.id);
      await loadStats();
    }
  };

  const handleExportBackup = async () => {
    const backup = await exportDatabase();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iiot_backup_full_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFeedback(null);
    setRestoreError(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await importDatabaseBackup(parsed);

      if (res.success) {
        setRestoreFeedback(
          `Backup restored successfully! Added ${res.added} new questions, updated ${res.updated} existing records.`
        );
        await loadStats();
      } else {
        setRestoreError(res.error || 'Failed to restore backup.');
      }
    } catch (err: any) {
      setRestoreError(`Invalid JSON file: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleResetEntireDatabase = async () => {
    if (
      window.confirm(
        'WARNING: This will permanently erase all questions, imported documents, and attempt history from your browser. Are you sure?'
      )
    ) {
      if (
        window.confirm(
          'Final Confirmation: All local data will be deleted. Click OK to proceed.'
        )
      ) {
        await clearAllQuestions();
        await clearAttempts();
        await loadStats();
        alert('All local database records have been reset.');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Settings & Local Data Management
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Manage local IndexedDB storage, download complete JSON backups, or restore past backups.
        </p>
      </div>

      {/* Subject & Course Management Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Subject & Exam Management</h2>
              <p className="text-xs text-slate-500">
                Manage multiple subjects and exams. Each subject maintains strict isolation.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddSubject(!showAddSubject)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-xl transition flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddSubject ? 'Cancel' : 'New Subject'}</span>
          </button>
        </div>

        {/* Add Subject Inline Form */}
        {showAddSubject && (
          <form
            onSubmit={handleCreateSubject}
            className="p-5 rounded-2xl bg-purple-50/50 border border-purple-200 space-y-4 animate-fade-in"
          >
            <h3 className="font-bold text-sm text-purple-900">Create New Subject / Course</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subject ID * (alphanumeric, lowercase)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. cloud-comp, ds-algo"
                  value={newSubId}
                  onChange={(e) => setNewSubId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subject Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cloud Computing & Distributed Systems"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Course / Exam Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. CS601, NPTEL-2026"
                  value={newSubCode}
                  onChange={(e) => setNewSubCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Semester Exam Prep"
                  value={newSubDesc}
                  onChange={(e) => setNewSubDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddSubject(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition shadow-xs"
              >
                Save & Set Active
              </button>
            </div>
          </form>
        )}

        {/* Subjects Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {subjects.map((sub) => {
            const isActive = sub.id === activeSubId;
            const count = subjectCounts[sub.id] || 0;
            return (
              <div
                key={sub.id}
                className={`p-4 rounded-2xl border transition flex flex-col justify-between gap-3 ${
                  isActive
                    ? 'border-purple-500 bg-purple-50/30 ring-2 ring-purple-500/20'
                    : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900">{sub.name}</h4>
                      {sub.code && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-mono">
                          {sub.code}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">ID: {sub.id}</span>
                    {sub.description && (
                      <p className="text-xs text-slate-600 mt-1">{sub.description}</p>
                    )}
                  </div>

                  {isActive ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold shrink-0">
                      <Check className="w-3.5 h-3.5" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSelectSubject(sub.id)}
                      className="px-2.5 py-1 rounded-full border border-slate-300 text-slate-700 hover:bg-white text-xs font-medium transition shrink-0"
                    >
                      Switch
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                  <span className="text-slate-500 font-medium">
                    Questions: <strong className="text-slate-800">{count}</strong>
                  </span>

                  {!sub.isDefault && sub.id !== DEFAULT_SUBJECT.id && (
                    <button
                      onClick={() => handleDeleteSubject(sub)}
                      className="text-rose-600 hover:text-rose-800 text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Storage Information Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Current Subject Storage Status</h2>
            <p className="text-xs text-slate-500">
              Active Subject: <strong>{subjects.find((s) => s.id === activeSubId)?.name || activeSubId}</strong>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-500 block">Questions in Subject</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {questionCount}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-500 block">Attempts in Subject</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">{attemptCount}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 col-span-2 sm:col-span-1">
            <span className="text-xs text-slate-500 block">Total Subjects</span>
            <span className="text-2xl font-bold text-purple-700 mt-1 block">{subjects.length}</span>
          </div>
        </div>
      </div>

      {/* Backup and Restore */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">Backup & Restore</h2>
          <p className="text-xs text-slate-500">
            Export your entire question bank and history to a JSON file, or restore from a backup.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <Download className="w-4 h-4 text-blue-600" />
                <span>Export Full Backup (JSON)</span>
              </div>
              <p className="text-xs text-slate-500">
                Creates a validated JSON backup containing all verified questions, options, answer
                keys, subjects, and test records.
              </p>
            </div>

            <button
              onClick={handleExportBackup}
              className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Download Master Backup File</span>
            </button>
          </div>

          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>Restore Backup (JSON)</span>
              </div>
              <p className="text-xs text-slate-500">
                Upload a previously exported backup file to restore questions, subjects, and attempts.
              </p>
            </div>

            <label className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs">
              <Upload className="w-4 h-4" />
              <span>Select Backup File</span>
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreFile}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {restoreFeedback && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{restoreFeedback}</span>
          </div>
        )}

        {restoreError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{restoreError}</span>
          </div>
        )}
      </div>

      {/* Preloaded Official Question Bank Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-indigo-200 shadow-xs space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Official Course Question Bank (Industrial IoT)</h2>
            <p className="text-xs text-slate-500">
              Preload or re-sync all 375 verified questions (Weeks 0–12 assignments and extra high-probability questions) extracted from the course PDF.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-indigo-950">Industrial IoT Dataset (375 Total Questions)</span>
            <p className="text-xs text-indigo-800">
              Week 0: 15 assignments | Weeks 1–12: 15 assignments + 15 high-probability questions each.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePreloadOfficialBank(false)}
              disabled={isPreloading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isPreloading ? 'Preloading...' : 'Preload / Sync Questions'}</span>
            </button>
            <button
              onClick={() => {
                if (window.confirm('Force re-sync all 375 questions? Existing custom questions and test history will be safely preserved.')) {
                  handlePreloadOfficialBank(true);
                }
              }}
              disabled={isPreloading}
              className="px-3 py-2 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-semibold text-xs rounded-xl transition cursor-pointer"
              title="Re-write all 375 preloaded questions with fresh copies"
            >
              <span>Force Re-sync</span>
            </button>
          </div>
        </div>

        {/* Legacy OCR Cleanup Row */}
        {activeSubId === 'iiot' && questionCount > 375 && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-xs font-bold">
                  {questionCount - 375} Legacy Web/OCR Questions Detected
                </p>
                <p className="text-[11px] text-amber-700">
                  Clean up old OCR uploads and keep strictly the 375 verified official course questions. An automatic backup will be saved.
                </p>
              </div>
            </div>
            {showCleanupConfirm ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-rose-800">Proceed?</span>
                <button
                  onClick={executeCleanup}
                  disabled={isCleaning}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl transition shadow-xs cursor-pointer"
                >
                  {isCleaning ? 'Cleaning...' : 'Yes, Delete'}
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
                disabled={isCleaning}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isCleaning ? 'Cleaning Up...' : `Clean Up ${questionCount - 375} Legacy Questions`}</span>
              </button>
            )}
          </div>
        )}

        {preloadFeedback && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{preloadFeedback}</span>
          </div>
        )}

        {cleanupFeedback && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{cleanupFeedback}</span>
          </div>
        )}
      </div>

      {/* Danger Zone: Reset Database */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-rose-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-rose-700 font-bold text-base">
          <ShieldAlert className="w-5 h-5 text-rose-600" />
          <span>Danger Zone: Database Reset</span>
        </div>
        <p className="text-xs text-slate-600">
          Permanently clear stored questions and test records from this browser. This action
          cannot be undone unless you have a downloaded backup.
        </p>

        <div className="pt-2 flex flex-wrap gap-3">
          <button
            onClick={async () => {
              if (window.confirm(`Clear all questions for the current subject (${activeSubId})?`)) {
                await clearAllQuestions(activeSubId);
                await loadStats();
                alert(`Questions for subject "${activeSubId}" have been cleared.`);
              }
            }}
            className="px-4 py-2.5 rounded-xl border border-rose-300 hover:bg-rose-50 text-rose-700 font-semibold text-xs transition flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Current Subject Questions</span>
          </button>

          <button
            onClick={handleResetEntireDatabase}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition flex items-center gap-2 shadow-xs"
          >
            <Trash2 className="w-4 h-4" />
            <span>Reset Entire Database (All Subjects)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
