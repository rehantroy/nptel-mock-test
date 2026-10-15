import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { ShieldCheck, HardDrive } from 'lucide-react';

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              <strong>Industrial IoT Mock Test Platform</strong> • Week 0 through Week 12
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <HardDrive className="w-3.5 h-3.5" />
            <span>Local-first browser persistence (IndexedDB). Zero external tracking.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
