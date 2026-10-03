import React from 'react';
import { Database, ShieldCheck, Cpu, HardDrive, RefreshCw } from 'lucide-react';

export default function Navbar({ activeDataset, backendOnline, onRefresh }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 glass-panel border-b border-slate-800/80 bg-slate-950/80">
      <div className="flex items-center space-x-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-synth-cyan text-white shadow-lg shadow-brand-500/20">
          <Cpu className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-teal-300 bg-clip-text text-transparent">
              SynthGen AI
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
              v1.0 SDV
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">Synthetic Data Vault & Statistical Quality Evaluator</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Active Dataset Pill */}
        {activeDataset ? (
          <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Database className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-slate-400">Active:</span>
            <span className="font-medium text-slate-200 truncate max-w-[160px]">{activeDataset.original_name}</span>
            <span className="px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded text-[11px]">
              {activeDataset.row_count} rows
            </span>
          </div>
        ) : (
          <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/60 text-xs text-slate-500">
            <Database className="w-3.5 h-3.5 text-slate-600" />
            <span>No dataset selected</span>
          </div>
        )}

        {/* Local Security Badge */}
        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline font-medium">100% Local-First Engine</span>
        </div>

        {/* Backend Connectivity Status */}
        <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${backendOnline ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-400 shadow-sm shadow-rose-400/50'}`} />
          <span className="text-xs text-slate-400 hidden sm:inline">
            {backendOnline ? 'Backend Ready' : 'Connecting...'}
          </span>
          {onRefresh && (
            <button 
              onClick={onRefresh}
              title="Refresh connection"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
