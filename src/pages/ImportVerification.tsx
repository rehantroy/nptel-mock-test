import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  XCircle,
  ArrowRight,
  Download,
  Plus,
  RefreshCw,
  Key,
  ShieldCheck,
  Edit,
  Trash2,
  Layers,
  Sparkles,
  Search,
  FolderGit2,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { parsePdfFile } from '../lib/importer/pdfParser';
import { parseDocxFile } from '../lib/importer/docxParser';
import {
  parseCSVQuestions,
  parseJSONQuestions,
  generateCSVTemplate,
  generateJSONTemplate,
} from '../lib/importer/csvJsonParser';
import { parseAnswerKeyText, applyAnswerKeyToDrafts } from '../lib/importer/answerKeyMatcher';
import {
  parseRawTextToQuestions,
  draftToVerifiedQuestion,
  type ExtractedQuestionDraft,
} from '../lib/importer/questionExtractor';
import {
  parseCombinedDocumentText,
  type ParsedSection,
  type ParsedInlineQuestionDraft,
} from '../lib/importer/inlineAnswerParser';
import {
  getAllQuestions,
  saveQuestions,
  saveQuestionsTransactional,
  getSubjects,
  getActiveSubject,
  saveCategory,
  getCategories,
} from '../lib/storage';
import { findPotentialDuplicates } from '../lib/validation';
import { FormattedContent } from '../components/FormattedContent';
import {
  WEEKS_LIST,
  type Question,
  type WeekNumber,
  type QuestionType,
  type Subject,
  type QuestionCategory,
} from '../types';

export const ImportVerification: React.FC = () => {
  const navigate = useNavigate();

  // Active Tab: 'upload' | 'manual' | 'templates'
  const [activeTab, setActiveTab] = useState<'upload' | 'manual' | 'templates'>('upload');

  // Upload Sub-Mode: 'combined' (Mode B) vs 'week_wise' (Mode A)
  const [uploadMode, setUploadMode] = useState<'combined' | 'week_wise'>('combined');

  // Subject state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('iiot');

  // Existing questions for duplicate checking
  const [existingQuestions, setExistingQuestions] = useState<Question[]>([]);

  // Combined Upload State (Mode B)
  const [detectedSections, setDetectedSections] = useState<ParsedSection[]>([]);
  const [combinedFilename, setCombinedFilename] = useState<string>('');

  // Week-wise Upload State (Mode A)
  const [weekWiseDrafts, setWeekWiseDrafts] = useState<ExtractedQuestionDraft[]>([]);
  const [defaultWeek, setDefaultWeek] = useState<WeekNumber>(1);
  const [defaultType, setDefaultType] = useState<QuestionType>('assignment');
  const [defaultCategoryName, setDefaultCategoryName] = useState('Assignment Questions');

  // File processing state
  const [processing, setProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [enableOcr, setEnableOcr] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Answer Key Matcher state (for Week-wise mode)
  const [answerKeyText, setAnswerKeyText] = useState('');
  const [answerKeyFeedback, setAnswerKeyFeedback] = useState<string | null>(null);

  // Manual Question Entry State
  const [manualWeek, setManualWeek] = useState<WeekNumber>(1);
  const [manualType, setManualType] = useState<QuestionType>('assignment');
  const [manualCategoryName, setManualCategoryName] = useState('Assignment Questions');
  const [manualQNum, setManualQNum] = useState('1');
  const [manualText, setManualText] = useState('');
  const [manualOptA, setManualOptA] = useState('');
  const [manualOptB, setManualOptB] = useState('');
  const [manualOptC, setManualOptC] = useState('');
  const [manualOptD, setManualOptD] = useState('');
  const [manualCorrect, setManualCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [manualExplanation, setManualExplanation] = useState('');
  const [manualSource, setManualSource] = useState('Manual Entry');

  useEffect(() => {
    async function loadMeta() {
      const [subs, currentSub, qs] = await Promise.all([
        getSubjects(),
        getActiveSubject(),
        getAllQuestions(),
      ]);
      setSubjects(subs);
      setSelectedSubjectId(currentSub.id);
      setExistingQuestions(qs);
    }
    loadMeta();
  }, []);

  // Handle Document Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    setParseError(null);
    setProgressMsg(`Reading ${file.name}...`);
    setCombinedFilename(file.name);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'pdf') {
        const res = await parsePdfFile(file, enableOcr, (p) => {
          setProgressMsg(p.status);
        });

        if (res.error) {
          setParseError(res.error);
        } else {
          if (uploadMode === 'combined') {
            setDetectedSections(res.sections);
          } else {
            setWeekWiseDrafts(res.drafts);
          }

          if (res.isScannedDetected && !enableOcr) {
            setParseError(
              'Scanned / image-based PDF detected with sparse text layer. If this is a scanned document, toggle "Enable Client OCR (Tesseract)" and re-upload.'
            );
          }
        }
      } else if (ext === 'docx') {
        const res = await parseDocxFile(file);
        if (res.error) {
          setParseError(res.error);
        } else {
          if (uploadMode === 'combined') {
            setDetectedSections(res.sections);
          } else {
            setWeekWiseDrafts(res.drafts);
          }
        }
      } else if (ext === 'csv') {
        const text = await file.text();
        const res = parseCSVQuestions(text, file.name);
        if (res.validQuestions.length > 0) {
          // Tag with selected subject
          const tagged = res.validQuestions.map((q) => ({
            ...q,
            subjectId: selectedSubjectId,
          }));
          await saveQuestionsTransactional(tagged);
          alert(`Successfully imported ${tagged.length} questions from CSV into ${selectedSubjectId.toUpperCase()}!`);
          navigate('/bank');
          return;
        } else if (res.invalidRows.length > 0) {
          setParseError(`Failed to parse CSV: ${res.invalidRows[0].errors.join(', ')}`);
        }
      } else if (ext === 'json') {
        const text = await file.text();
        const res = parseJSONQuestions(text);
        if (res.validQuestions.length > 0) {
          const tagged = res.validQuestions.map((q) => ({
            ...q,
            subjectId: selectedSubjectId,
          }));
          await saveQuestionsTransactional(tagged);
          alert(`Successfully imported ${tagged.length} questions from JSON into ${selectedSubjectId.toUpperCase()}!`);
          navigate('/bank');
          return;
        } else if (res.invalidRows.length > 0) {
          setParseError(`JSON validation error: ${res.invalidRows[0].errors.join(', ')}`);
        }
      } else if (ext === 'txt') {
        const text = await file.text();
        if (uploadMode === 'combined') {
          const secs = parseCombinedDocumentText(text, file.name);
          setDetectedSections(secs);
        } else {
          const extracted = parseRawTextToQuestions(text, file.name);
          setWeekWiseDrafts(extracted);
        }
      } else {
        setParseError(`Unsupported file extension .${ext}. Please upload PDF, DOCX, TXT, CSV, or JSON.`);
      }
    } catch (err: any) {
      setParseError(`Extraction failure: ${err?.message || 'Unknown error'}`);
    } finally {
      setProcessing(false);
      setProgressMsg('');
    }
  };

  // Mode B: Save All Sections from Combined Upload Preview
  const handleCommitCombinedSections = async () => {
    if (detectedSections.length === 0) return;

    const toSave: Question[] = [];

    for (const sec of detectedSections) {
      const finalWeek: WeekNumber = (sec.detectedWeek !== null ? sec.detectedWeek : 0) as WeekNumber;
      const catSlug = sec.detectedCategory
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

      // Persist category
      await saveCategory({
        id: catSlug,
        name: sec.detectedCategory,
        subjectId: selectedSubjectId,
        isLegacyAssignment: sec.questionType === 'assignment',
      });

      for (const q of sec.questions) {
        if (q.verificationStatus === 'rejected') continue;

        // Create options with stable IDs
        const options = q.options.map((opt) => ({
          id: opt.tempId.startsWith('opt_')
            ? opt.tempId
            : 'opt_' + Math.random().toString(36).substring(2, 8),
          text: opt.text,
        }));

        let correctOptionId = q.matchedOptionId || '';
        const validOptionIds = options.map((o) => o.id);

        if (!validOptionIds.includes(correctOptionId)) {
          // Fallback to match letter
          if (q.detectedAnswerLabel) {
            const letterIdx = ['A', 'B', 'C', 'D', 'E'].indexOf(q.detectedAnswerLabel.toUpperCase());
            if (letterIdx >= 0 && options[letterIdx]) {
              correctOptionId = options[letterIdx].id;
            }
          }
        }

        if (!correctOptionId && options.length > 0) {
          correctOptionId = options[0].id;
        }

        const candidate: Question = {
          id: 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
          subjectId: selectedSubjectId,
          courseId: selectedSubjectId.toUpperCase(),
          week: finalWeek,
          questionType: sec.questionType,
          categoryId: catSlug,
          categoryName: sec.detectedCategory,
          originalHeading: sec.originalHeading,
          originalQuestionNumber: q.originalQuestionNumber,
          questionText: q.questionText,
          options,
          correctOptionId,
          explanation: q.explanation || undefined, // Optional!
          sourceFilename: q.sourceFilename || combinedFilename,
          sourcePageNumber: q.sourcePageNumber,
          extractionStatus: q.extractionStatus,
          verificationStatus: q.verificationStatus,
          duplicateStatus: 'unique',
          isOfficial: false,
          sourceType: 'user_upload',
          importTimestamp: new Date().toISOString(),
          notes: q.notes,
        };

        // Duplicate check
        const dupes = findPotentialDuplicates(candidate.questionText, existingQuestions);
        if (dupes.length > 0) {
          candidate.duplicateStatus = 'potential_duplicate';
        }

        toSave.push(candidate);
      }
    }

    if (toSave.length === 0) {
      alert('No questions to import.');
      return;
    }

    try {
      await saveQuestionsTransactional(toSave);
      alert(
        `Success! Transactionally committed ${toSave.length} questions across ${detectedSections.length} sections into ${selectedSubjectId.toUpperCase()}!`
      );
      setDetectedSections([]);
      navigate('/bank');
    } catch (err: any) {
      alert(`Import failed: ${err?.message || 'Database error'}`);
    }
  };

  // Mode A: Apply Answer Key
  const handleApplyAnswerKey = () => {
    if (!answerKeyText.trim()) return;
    const keyMap = parseAnswerKeyText(answerKeyText);
    if (keyMap.size === 0) {
      setAnswerKeyFeedback('Could not detect question numbers and answer letters in provided key.');
      return;
    }

    const { updatedDrafts, matchResult } = applyAnswerKeyToDrafts(weekWiseDrafts, keyMap);
    setWeekWiseDrafts(updatedDrafts);
    setAnswerKeyFeedback(
      `Answer key applied! Matched: ${matchResult.matchedCount}, Unmatched: ${matchResult.unmatchedCount}, Conflicts: ${matchResult.conflictsCount}.`
    );
  };

  // Mode A: Save Verified Drafts into Question Bank
  const handleSaveWeekWiseDraftsToBank = async () => {
    if (weekWiseDrafts.length === 0) return;

    const toSave: Question[] = [];

    for (const draft of weekWiseDrafts) {
      if (draft.verificationStatus === 'rejected') continue;

      let correctOptId = '';
      if (draft.detectedAnswerLabel) {
        const found = draft.options.find(
          (o, idx) =>
            o.label.toUpperCase() === draft.detectedAnswerLabel?.toUpperCase() ||
            ['A', 'B', 'C', 'D'][idx] === draft.detectedAnswerLabel?.toUpperCase()
        );
        if (found) correctOptId = found.tempId;
      }
      if (!correctOptId && draft.options.length > 0) {
        correctOptId = draft.options[0].tempId;
      }

      const q = draftToVerifiedQuestion(
        draft,
        defaultWeek,
        defaultType,
        correctOptId,
        draft.verificationStatus,
        {
          subjectId: selectedSubjectId,
          categoryName: defaultCategoryName,
        }
      );

      const dupes = findPotentialDuplicates(q.questionText, existingQuestions);
      if (dupes.length > 0) {
        q.duplicateStatus = 'potential_duplicate';
      }

      toSave.push(q);
    }

    await saveQuestionsTransactional(toSave);
    alert(`Successfully saved ${toSave.length} questions to Question Bank!`);
    setWeekWiseDrafts([]);
    navigate('/bank');
  };

  // Manual Question Submit
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim() || !manualOptA.trim() || !manualOptB.trim()) {
      alert('Question text and at least Options A & B are required.');
      return;
    }

    const optAId = 'opt_man_' + Math.random().toString(36).substring(2, 7);
    const optBId = 'opt_man_' + Math.random().toString(36).substring(2, 7);
    const optCId = 'opt_man_' + Math.random().toString(36).substring(2, 7);
    const optDId = 'opt_man_' + Math.random().toString(36).substring(2, 7);

    const options = [
      { id: optAId, text: manualOptA },
      { id: optBId, text: manualOptB },
    ];
    if (manualOptC.trim()) options.push({ id: optCId, text: manualOptC });
    if (manualOptD.trim()) options.push({ id: optDId, text: manualOptD });

    const keyMap: Record<string, string> = {
      A: optAId,
      B: optBId,
      C: optCId,
      D: optDId,
    };

    const newQuestion: Question = {
      id: 'q_man_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      subjectId: selectedSubjectId,
      courseId: selectedSubjectId.toUpperCase(),
      week: manualWeek,
      questionType: manualType,
      categoryName: manualCategoryName,
      originalQuestionNumber: manualQNum,
      questionText: manualText,
      options,
      correctOptionId: keyMap[manualCorrect] || optAId,
      explanation: manualExplanation.trim() || undefined,
      sourceFilename: manualSource.trim() || 'Manual Entry',
      extractionStatus: 'manual_entry',
      verificationStatus: 'verified',
      duplicateStatus: 'unique',
      isOfficial: false,
      sourceType: 'manual_entry',
      importTimestamp: new Date().toISOString(),
    };

    await saveQuestionsTransactional([newQuestion]);
    alert(`Question #${manualQNum} (Week ${manualWeek}) successfully saved to Question Bank!`);

    setManualQNum((prev) => String(parseInt(prev, 10) + 1 || 1));
    setManualText('');
    setManualOptA('');
    setManualOptB('');
    setManualOptC('');
    setManualOptD('');
    setManualExplanation('');
  };

  const downloadTemplate = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalCombinedQuestions = detectedSections.reduce(
    (acc, sec) => acc + sec.questions.length,
    0
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Document Import & Verification
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Intelligent extraction supporting multi-week combined PDFs, dynamic headings, inline
            answers, and optional explanations.
          </p>
        </div>

        {/* Target Subject Selector */}
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border border-slate-200 shadow-xs">
          <FolderGit2 className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-semibold text-slate-600">Import To:</span>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold">
        <button
          type="button"
          id="tab-upload"
          onClick={() => setActiveTab('upload')}
          className={`pb-3 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'upload'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Document (PDF / DOCX / CSV / JSON)</span>
        </button>

        <button
          type="button"
          id="tab-manual"
          onClick={() => setActiveTab('manual')}
          className={`pb-3 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'manual'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Manual Question Entry</span>
        </button>

        <button
          type="button"
          id="tab-templates"
          onClick={() => setActiveTab('templates')}
          className={`pb-3 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'templates'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Download Import Templates</span>
        </button>
      </div>

      {/* Tab 1: Upload Documents (Mode A & Mode B) */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          {/* Two Upload Modes Toggle */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Choose Extraction Mode
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setUploadMode('combined');
                  setWeekWiseDrafts([]);
                }}
                className={`p-4 rounded-2xl border text-left transition flex items-start gap-3 cursor-pointer ${
                  uploadMode === 'combined'
                    ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    uploadMode === 'combined'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900">
                    Mode B: Combined Upload (Intelligent)
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Upload full document containing multiple weeks, categories, inline answers, and
                    optional explanations. Auto-detects sections and headings!
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUploadMode('week_wise');
                  setDetectedSections([]);
                }}
                className={`p-4 rounded-2xl border text-left transition flex items-start gap-3 cursor-pointer ${
                  uploadMode === 'week_wise'
                    ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    uploadMode === 'week_wise'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900">
                    Mode A: Week-wise Upload (Targeted)
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Select a specific week and category before uploading. Ideal for individual
                    weekly assignment sheets or single practice sets.
                  </p>
                </div>
              </button>
            </div>

            {/* Mode A Target Inputs */}
            {uploadMode === 'week_wise' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 animate-fade-in">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Target Academic Week:
                  </label>
                  <select
                    value={defaultWeek}
                    onChange={(e) => setDefaultWeek(parseInt(e.target.value, 10) as WeekNumber)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    {WEEKS_LIST.map((w) => (
                      <option key={w} value={w}>
                        Week {w}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Question Type:
                  </label>
                  <select
                    value={defaultType}
                    onChange={(e) => setDefaultType(e.target.value as QuestionType)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="assignment">Assignment Question (Official Course)</option>
                    <option value="other">Other Question (Additional Problem Set)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Category Name:
                  </label>
                  <input
                    type="text"
                    value={defaultCategoryName}
                    onChange={(e) => setDefaultCategoryName(e.target.value)}
                    placeholder="e.g. Assignment Questions"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
              </div>
            )}

            {/* File Drop Area */}
            <div className="border-2 border-dashed border-slate-300 rounded-3xl p-8 text-center hover:border-blue-500 hover:bg-blue-50/20 transition space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <UploadCloud className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Select {uploadMode === 'combined' ? 'Combined Course Document' : 'Weekly Assignment Document'}
                </h3>
                <p className="text-xs text-slate-500">
                  Supports PDF (with inline answers & explanations), Word (.docx), CSV, or JSON.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
                <label className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer shadow-sm transition">
                  Browse Document
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.csv,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={processing}
                  />
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableOcr}
                    onChange={(e) => setEnableOcr(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Enable Client OCR (Tesseract for scanned documents)</span>
                </label>
              </div>

              {processing && (
                <div className="pt-3 text-xs font-semibold text-blue-600 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{progressMsg || 'Processing document...'}</span>
                </div>
              )}
            </div>

            {parseError && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>{parseError}</div>
              </div>
            )}
          </div>

          {/* MODE B: Complete Extraction Preview for Combined Upload */}
          {uploadMode === 'combined' && detectedSections.length > 0 && (
            <div className="space-y-6 pt-2 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Combined Upload Extraction Preview ({totalCombinedQuestions} Questions across{' '}
                    {detectedSections.length} Sections)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Review detected sections, weeks, dynamic categories, inline answers, and optional
                    explanations before saving.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Discard this combined upload preview?')) {
                        setDetectedSections([]);
                      }
                    }}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCommitCombinedSections}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Confirm & Save All Sections to Bank</span>
                  </button>
                </div>
              </div>

              {/* Sections Accordion / Cards */}
              <div className="space-y-6">
                {detectedSections.map((section, sIdx) => (
                  <div
                    key={section.id}
                    className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4"
                  >
                    {/* Section Header Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-slate-900">
                            {section.originalHeading}
                          </span>
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                            {section.questions.length} Qs
                          </span>
                        </div>
                        {section.notes && (
                          <div className="text-xs text-amber-600 font-medium flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{section.notes}</span>
                          </div>
                        )}
                      </div>

                      {/* Section Week & Dynamic Category Editor */}
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium text-slate-500">Week:</span>
                          <select
                            value={section.detectedWeek !== null ? section.detectedWeek : 0}
                            onChange={(e) => {
                              const updated = [...detectedSections];
                              updated[sIdx].detectedWeek = parseInt(e.target.value, 10) as WeekNumber;
                              updated[sIdx].isAmbiguous = false;
                              setDetectedSections(updated);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                          >
                            {WEEKS_LIST.map((w) => (
                              <option key={w} value={w}>
                                Week {w}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium text-slate-500">Category:</span>
                          <input
                            type="text"
                            value={section.detectedCategory}
                            onChange={(e) => {
                              const updated = [...detectedSections];
                              updated[sIdx].detectedCategory = e.target.value;
                              updated[sIdx].questionType = /assignment/i.test(e.target.value)
                                ? 'assignment'
                                : 'other';
                              setDetectedSections(updated);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 w-48"
                          />
                        </div>

                        <select
                          value={section.questionType}
                          onChange={(e) => {
                            const updated = [...detectedSections];
                            updated[sIdx].questionType = e.target.value as QuestionType;
                            setDetectedSections(updated);
                          }}
                          className="p-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 bg-white"
                        >
                          <option value="assignment">Assignment</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    {/* Questions in Section */}
                    <div className="space-y-4">
                      {section.questions.map((q, qIdx) => (
                        <div
                          key={q.tempId}
                          className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/80 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/60">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">
                                Q#{q.originalQuestionNumber}
                              </span>
                              {q.sourcePageNumber && (
                                <span className="text-xs text-slate-400">
                                  (Page {q.sourcePageNumber})
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <select
                                value={q.verificationStatus}
                                onChange={(e) => {
                                  const updated = [...detectedSections];
                                  updated[sIdx].questions[qIdx].verificationStatus = e.target
                                    .value as any;
                                  setDetectedSections(updated);
                                }}
                                className="px-2 py-0.5 rounded-md border border-slate-200 text-xs font-semibold bg-white text-slate-700"
                              >
                                <option value="verified">Verified Ready</option>
                                <option value="needs_review">Needs Review</option>
                                <option value="rejected">Reject</option>
                              </select>

                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...detectedSections];
                                  updated[sIdx].questions.splice(qIdx, 1);
                                  setDetectedSections(updated);
                                }}
                                className="text-slate-400 hover:text-rose-600 p-1"
                                title="Remove question"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Editable Question Text */}
                          <div>
                            <textarea
                              rows={2}
                              value={q.questionText}
                              onChange={(e) => {
                                const updated = [...detectedSections];
                                updated[sIdx].questions[qIdx].questionText = e.target.value;
                                setDetectedSections(updated);
                              }}
                              className="w-full p-2 rounded-xl border border-slate-200 text-sm font-sans bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          {/* Options Grid with Inline Answer Selection */}
                          <div className="space-y-1.5">
                            <span className="text-xs font-semibold text-slate-600 block">
                              Options & Inline Correct Answer:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {q.options.map((opt, optI) => {
                                const label = ['A', 'B', 'C', 'D', 'E'][optI] || String(optI + 1);
                                const isCorrect =
                                  q.matchedOptionId === opt.tempId ||
                                  q.detectedAnswerLabel?.toUpperCase() === label;

                                return (
                                  <div
                                    key={opt.tempId}
                                    className={`p-2 rounded-xl border text-xs flex items-center gap-2 ${
                                      isCorrect
                                        ? 'bg-emerald-50 border-emerald-300 font-semibold text-emerald-900'
                                        : 'bg-white border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...detectedSections];
                                        updated[sIdx].questions[qIdx].matchedOptionId = opt.tempId;
                                        updated[sIdx].questions[qIdx].detectedAnswerLabel = label;
                                        updated[sIdx].questions[qIdx].verificationStatus = 'verified';
                                        setDetectedSections(updated);
                                      }}
                                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                                        isCorrect
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                      }`}
                                    >
                                      {label} {isCorrect ? '✓' : ''}
                                    </button>
                                    <input
                                      type="text"
                                      value={opt.text}
                                      onChange={(e) => {
                                        const updated = [...detectedSections];
                                        updated[sIdx].questions[qIdx].options[optI].text =
                                          e.target.value;
                                        setDetectedSections(updated);
                                      }}
                                      className="flex-1 p-1 rounded border border-transparent hover:border-slate-200 focus:border-blue-400 bg-transparent text-xs focus:bg-white focus:outline-none"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Inline Explanation (Optional) */}
                          <div className="pt-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-semibold text-slate-500">
                                Source Explanation (Optional — empty if absent in PDF):
                              </span>
                              {!q.explanation && (
                                <span className="text-[10px] text-slate-400 italic">
                                  No explanation in source (Eligible for scored tests)
                                </span>
                              )}
                            </div>
                            <textarea
                              rows={2}
                              value={q.explanation || ''}
                              onChange={(e) => {
                                const updated = [...detectedSections];
                                updated[sIdx].questions[qIdx].explanation = e.target.value || undefined;
                                setDetectedSections(updated);
                              }}
                              placeholder="Official explanation directly from document..."
                              className="w-full p-2 rounded-xl border border-slate-200 text-xs font-sans bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODE A: Week-Wise Review Queue */}
          {uploadMode === 'week_wise' && weekWiseDrafts.length > 0 && (
            <div className="space-y-6 pt-2 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Week-wise Extraction Queue ({weekWiseDrafts.length} Questions)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Assigning to Week {defaultWeek} • {defaultCategoryName}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveWeekWiseDraftsToBank}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Save All to Question Bank</span>
                </button>
              </div>

              {/* Separate Official Answer Key Matcher */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-blue-600" />
                  <h3 className="font-bold text-sm text-slate-900">Official Answer Key Matcher</h3>
                </div>
                <p className="text-xs text-slate-500">
                  If the answer key is separate, paste it here to match: (e.g. &ldquo;1. A, 2. B, 3. C&rdquo;)
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <textarea
                    rows={2}
                    value={answerKeyText}
                    onChange={(e) => setAnswerKeyText(e.target.value)}
                    placeholder="e.g.: 1. A, 2. C, 3. B, 4. D..."
                    className="flex-1 p-2.5 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleApplyAnswerKey}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition shrink-0 cursor-pointer"
                  >
                    Apply Key
                  </button>
                </div>

                {answerKeyFeedback && (
                  <p className="text-xs font-semibold text-blue-700 bg-blue-50 p-2.5 rounded-xl border border-blue-200">
                    {answerKeyFeedback}
                  </p>
                )}
              </div>

              {/* Draft Cards */}
              <div className="space-y-4">
                {weekWiseDrafts.map((draft, idx) => (
                  <div
                    key={draft.tempId}
                    className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          Q#{draft.originalQuestionNumber}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold">
                          Week {defaultWeek}
                        </span>
                      </div>

                      <select
                        value={draft.verificationStatus}
                        onChange={(e) => {
                          const updated = [...weekWiseDrafts];
                          updated[idx].verificationStatus = e.target.value as any;
                          setWeekWiseDrafts(updated);
                        }}
                        className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
                      >
                        <option value="verified">Mark Verified</option>
                        <option value="needs_review">Needs Review</option>
                        <option value="rejected">Reject</option>
                      </select>
                    </div>

                    <div className="text-sm font-medium text-slate-900">
                      <FormattedContent content={draft.questionText} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {draft.options.map((opt, optI) => {
                        const label = ['A', 'B', 'C', 'D', 'E'][optI] || String(optI + 1);
                        const isCorrect =
                          draft.detectedAnswerLabel?.toUpperCase() === label.toUpperCase();

                        return (
                          <div
                            key={opt.tempId}
                            className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                              isCorrect
                                ? 'bg-emerald-50 border-emerald-300 font-medium text-emerald-900'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...weekWiseDrafts];
                                updated[idx].detectedAnswerLabel = label;
                                updated[idx].verificationStatus = 'verified';
                                setWeekWiseDrafts(updated);
                              }}
                              className={`px-2 py-1 rounded-md font-bold text-[10px] transition cursor-pointer ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                              }`}
                            >
                              Option {label} {isCorrect ? '✓' : ''}
                            </button>
                            <span className="flex-1 truncate">{opt.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Manual Question Entry */}
      {activeTab === 'manual' && (
        <form
          onSubmit={handleManualSubmit}
          className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6"
        >
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">Add Question Manually</h2>
            <p className="text-xs text-slate-500">
              Input verified questions with scientific formatting, KaTeX math, and optional
              explanations.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label htmlFor="manual-week" className="text-xs font-semibold text-slate-700 block mb-1">
                Week (0–12):
              </label>
              <select
                id="manual-week"
                value={manualWeek}
                onChange={(e) => setManualWeek(parseInt(e.target.value, 10) as WeekNumber)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm bg-white"
              >
                {WEEKS_LIST.map((w) => (
                  <option key={w} value={w}>
                    Week {w}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="manual-type" className="text-xs font-semibold text-slate-700 block mb-1">
                Type:
              </label>
              <select
                id="manual-type"
                value={manualType}
                onChange={(e) => setManualType(e.target.value as QuestionType)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="assignment">Assignment Question</option>
                <option value="other">Other Question</option>
              </select>
            </div>

            <div>
              <label htmlFor="manual-category" className="text-xs font-semibold text-slate-700 block mb-1">
                Category Name:
              </label>
              <input
                id="manual-category"
                type="text"
                value={manualCategoryName}
                onChange={(e) => setManualCategoryName(e.target.value)}
                placeholder="e.g. Assignment Questions"
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div>
              <label htmlFor="manual-qnum" className="text-xs font-semibold text-slate-700 block mb-1">
                Original Q#:
              </label>
              <input
                id="manual-qnum"
                type="text"
                value={manualQNum}
                onChange={(e) => setManualQNum(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="manual-text" className="text-xs font-semibold text-slate-700 block mb-1">
              Question Text (Supports KaTeX $...$, subscripts CO2, formulas):
            </label>
            <textarea
              id="manual-text"
              rows={4}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="e.g. In an Industrial IoT system, what is the primary role of an Edge Gateway?"
              className="w-full p-3 rounded-xl border border-slate-200 text-sm font-sans"
              required
            />
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="manual-opt-a" className="text-xs font-semibold text-slate-700 block mb-1">
                Option A:
              </label>
              <input
                id="manual-opt-a"
                type="text"
                value={manualOptA}
                onChange={(e) => setManualOptA(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="manual-opt-b" className="text-xs font-semibold text-slate-700 block mb-1">
                Option B:
              </label>
              <input
                id="manual-opt-b"
                type="text"
                value={manualOptB}
                onChange={(e) => setManualOptB(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="manual-opt-c" className="text-xs font-semibold text-slate-700 block mb-1">
                Option C (Optional):
              </label>
              <input
                id="manual-opt-c"
                type="text"
                value={manualOptC}
                onChange={(e) => setManualOptC(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div>
              <label htmlFor="manual-opt-d" className="text-xs font-semibold text-slate-700 block mb-1">
                Option D (Optional):
              </label>
              <input
                id="manual-opt-d"
                type="text"
                value={manualOptD}
                onChange={(e) => setManualOptD(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="manual-correct" className="text-xs font-semibold text-slate-700 block mb-1">
                Official Correct Answer:
              </label>
              <select
                id="manual-correct"
                value={manualCorrect}
                onChange={(e) => setManualCorrect(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-bold text-emerald-700 bg-white"
              >
                <option value="A">Option A</option>
                <option value="B">Option B</option>
                <option value="C">Option C</option>
                <option value="D">Option D</option>
              </select>
            </div>

            <div>
              <label htmlFor="manual-source" className="text-xs font-semibold text-slate-700 block mb-1">
                Source Document Name:
              </label>
              <input
                id="manual-source"
                type="text"
                value={manualSource}
                onChange={(e) => setManualSource(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm"
                placeholder="e.g. Week1_Official_Assignment.pdf"
              />
            </div>
          </div>

          <div>
            <label htmlFor="manual-explanation" className="text-xs font-semibold text-slate-700 block mb-1">
              Official Explanation (Optional — leave empty if absent in source):
            </label>
            <textarea
              id="manual-explanation"
              rows={2}
              value={manualExplanation}
              onChange={(e) => setManualExplanation(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-sm"
              placeholder="Official explanation directly from document..."
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              id="manual-submit-btn"
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Save Question to Bank</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 3: Downloadable Templates */}
      {activeTab === 'templates' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">
              Download Question Bank Templates
            </h2>
            <p className="text-xs text-slate-500">
              Standard spreadsheet CSV or JSON templates for multi-subject imports.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>CSV Question Template</span>
                </div>
                <p className="text-xs text-slate-500">
                  Spreadsheet columns: week, question_type, original_q_num, question_text,
                  option_a, option_b, option_c, option_d, correct_answer, explanation.
                </p>
              </div>
              <button
                onClick={() =>
                  downloadTemplate(
                    generateCSVTemplate(),
                    'question_template.csv',
                    'text/csv'
                  )
                }
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download CSV Template</span>
              </button>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>JSON Question Bank Template</span>
                </div>
                <p className="text-xs text-slate-500">
                  Full structured JSON schema with typed options, stable UUIDs, and subject
                  association.
                </p>
              </div>
              <button
                onClick={() =>
                  downloadTemplate(
                    generateJSONTemplate(),
                    'question_bank_template.json',
                    'application/json'
                  )
                }
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download JSON Template</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
