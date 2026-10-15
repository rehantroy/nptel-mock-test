import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BookOpen,
  PlayCircle,
  Database,
  UploadCloud,
  History,
  Settings,
  Menu,
  X,
  Cpu,
  CheckCircle2,
  ChevronDown,
  Plus,
  FolderGit2,
} from 'lucide-react';
import {
  getVerifiedQuestions,
  getSubjects,
  getActiveSubject,
  setActiveSubjectId,
  saveSubject,
} from '../lib/storage';
import type { Subject } from '../types';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [verifiedCount, setVerifiedCount] = useState<number>(0);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSubject, setActiveSub] = useState<Subject | null>(null);
  const [subjectDropdownOpen, setSubjectDropdownOpen] = useState(false);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);

  // New Subject Form state
  const [newSubName, setNewSubName] = useState('');
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubDesc, setNewSubDesc] = useState('');

  const refreshData = async () => {
    try {
      const [subs, currentSub, qs] = await Promise.all([
        getSubjects(),
        getActiveSubject(),
        getVerifiedQuestions(),
      ]);
      setSubjects(subs);
      setActiveSub(currentSub);
      setVerifiedCount(qs.length);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshData();

    const handleSubjectChange = () => {
      refreshData();
    };

    window.addEventListener('subject_changed', handleSubjectChange);
    return () => window.removeEventListener('subject_changed', handleSubjectChange);
  }, [location.pathname]);

  const handleSelectSubject = (id: string) => {
    setActiveSubjectId(id);
    setSubjectDropdownOpen(false);
    refreshData();
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim() || !newSubCode.trim()) return;

    const id = newSubCode.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36).substring(2, 6);
    const newSub: Subject = {
      id,
      name: newSubName.trim(),
      code: newSubCode.trim().toUpperCase(),
      description: newSubDesc.trim() || undefined,
      maxWeeks: 12,
      createdAt: new Date().toISOString(),
    };

    await saveSubject(newSub);
    setActiveSubjectId(newSub.id);
    setShowAddSubjectModal(false);
    setNewSubName('');
    setNewSubCode('');
    setNewSubDesc('');
    await refreshData();
  };

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: BookOpen },
    { to: '/modes', label: 'Take Test', icon: PlayCircle },
    { to: '/bank', label: 'Question Bank', icon: Database },
    { to: '/import', label: 'Import & Verify', icon: UploadCloud },
    { to: '/history', label: 'History', icon: History },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Subject Selector */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-1"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm group-hover:shadow-md transition">
                <Cpu className="w-6 h-6" />
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-base leading-tight tracking-tight">
                    {activeSubject?.name || 'Mock Test Platform'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {activeSubject?.code || 'EXAM'} • Week 0 – Week {activeSubject?.maxWeeks ?? 12}
                </p>
              </div>
            </Link>

            {/* Subject Switcher Pill / Dropdown */}
            <div className="relative">
              <button
                type="button"
                id="subject-dropdown-btn"
                onClick={() => setSubjectDropdownOpen(!subjectDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition border border-slate-200 cursor-pointer"
                title="Switch Active Subject or Exam"
              >
                <FolderGit2 className="w-3.5 h-3.5 text-blue-600" />
                <span className="max-w-[100px] truncate">{activeSubject?.code || 'IIOT'}</span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>

              {subjectDropdownOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-fade-in space-y-1">
                  <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Select Subject / Exam
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-0.5">
                    {subjects.map((sub) => {
                      const isCurrent = activeSubject?.id === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleSelectSubject(sub.id)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                            isCurrent
                              ? 'bg-blue-50 text-blue-700 font-bold'
                              : 'text-slate-700 hover:bg-slate-50 font-medium'
                          }`}
                        >
                          <div>
                            <div className="font-semibold text-slate-900">{sub.name}</div>
                            <div className="text-[10px] text-slate-400">Code: {sub.code}</div>
                          </div>
                          {isCurrent && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setSubjectDropdownOpen(false);
                        setShowAddSubjectModal(true);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add New Subject</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    active
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Verified Question Counter pill */}
          <div className="hidden lg:flex items-center gap-2">
            <Link
              to="/bank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
              title="Verified questions ready in active subject"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{verifiedCount} Verified Ready</span>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1 shadow-lg">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                {link.label}
              </Link>
            );
          })}
          <div className="pt-2 border-t border-slate-100 mt-2">
            <div className="flex items-center justify-between text-xs text-slate-500 px-3 py-1">
              <span>Active Subject:</span>
              <span className="font-bold text-slate-900">{activeSubject?.name}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 px-3 py-1">
              <span>Verified Questions:</span>
              <span className="font-bold text-emerald-600">{verifiedCount} ready</span>
            </div>
          </div>
        </div>
      )}

      {/* Add New Subject Modal */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <form
            onSubmit={handleCreateSubject}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Add New Subject / Course</h3>
              <button
                type="button"
                onClick={() => setShowAddSubjectModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Subject / Course Name:
                </label>
                <input
                  type="text"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  placeholder="e.g. Cloud Computing & Distributed Systems"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Course Code / Identifier:
                </label>
                <input
                  type="text"
                  value={newSubCode}
                  onChange={(e) => setNewSubCode(e.target.value)}
                  placeholder="e.g. CS101 or CLOUD"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Description / Details (Optional):
                </label>
                <textarea
                  rows={2}
                  value={newSubDesc}
                  onChange={(e) => setNewSubDesc(e.target.value)}
                  placeholder="e.g. NPTEL Semester Course (Week 0 to Week 12)"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddSubjectModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
              >
                Create Subject
              </button>
            </div>
          </form>
        </div>
      )}
    </header>
  );
};
