import React from 'react';
import { Database, Sparkles, BarChart3, ShieldCheck, Zap, HardDrive, ArrowRight, Code } from 'lucide-react';

const STAT_CARDS = [
  { label: 'SDV Version', value: '1.38.5', icon: Code, color: 'from-brand-500 to-indigo-500' },
  { label: 'Synthesizers', value: '3', icon: Sparkles, color: 'from-violet-500 to-purple-600' },
  { label: 'Max Rows', value: '50K', icon: Database, color: 'from-cyan-500 to-teal-500' },
  { label: 'Privacy Mode', value: 'Local', icon: ShieldCheck, color: 'from-emerald-500 to-green-600' },
];

const WORKFLOW = [
  { step: '01', title: 'Upload Dataset', desc: 'Upload any CSV dataset (up to 50 MB / 100K rows). Automatic data profiling runs instantly.', tab: 'upload', icon: HardDrive },
  { step: '02', title: 'Review Profile', desc: 'Examine inferred column types, distributions, missing values, and summary statistics.', tab: 'profile', icon: BarChart3 },
  { step: '03', title: 'Configure & Generate', desc: 'Choose GaussianCopula, CTGAN, or TVAE. Set row count and optional random seed then start synthesis.', tab: 'configure', icon: Sparkles },
  { step: '04', title: 'Evaluate Quality', desc: 'SDV quality scores, column-by-column distribution charts, and pairwise correlation metrics.', tab: 'quality', icon: Zap },
];

export default function OverviewPage({ setActiveTab }) {
  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-brand-950/60 to-indigo-950/60 border border-slate-800 p-8 md:p-10">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle at 70% 50%, #3b82f6 0%, transparent 55%), radial-gradient(circle at 20% 80%, #8b5cf6 0%, transparent 50%)"
        }} />
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-4">
            <div className="px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/20 text-brand-400 border border-brand-500/30 tracking-wide">
              Powered by SDV 1.38.5
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 tracking-wide">
              100% Local • No Cloud
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3">
            <span className="bg-gradient-to-r from-white via-blue-200 to-indigo-300 bg-clip-text text-transparent">
              SynthGen AI
            </span>
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl leading-relaxed mb-6">
            Generate statistically faithful synthetic datasets using the{' '}
            <span className="text-brand-400 font-semibold">Synthetic Data Vault (SDV)</span> library.
            Train GaussianCopula, CTGAN, or TVAE models — then evaluate fidelity with built-in SDV quality metrics.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              id="btn-start-upload"
              onClick={() => setActiveTab('upload')}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white font-semibold shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all duration-200 hover:-translate-y-0.5"
            >
              <HardDrive className="w-4 h-4" />
              <span>Upload CSV to Begin</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              id="btn-view-history"
              onClick={() => setActiveTab('history')}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold border border-slate-700 hover:bg-slate-700 hover:text-white transition-all duration-200"
            >
              <span>View History</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="glass-panel rounded-2xl p-5 flex flex-col space-y-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-black text-white">{card.value}</div>
                <div className="text-xs text-slate-400 font-medium">{card.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Workflow */}
      <div>
        <h2 className="text-xl font-bold text-white mb-5">How It Works</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {WORKFLOW.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.step}
                id={`workflow-${item.tab}`}
                onClick={() => setActiveTab(item.tab)}
                className="text-left glass-panel rounded-2xl p-5 hover:border-brand-500/40 hover:bg-brand-500/5 transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl font-black text-slate-700 group-hover:text-brand-500/50 transition-colors">
                    {item.step}
                  </span>
                  <Icon className="w-5 h-5 text-slate-500 group-hover:text-brand-400 transition-colors" />
                </div>
                <div className="font-bold text-slate-200 group-hover:text-white transition-colors mb-1">
                  {item.title}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Privacy warning */}
      <div className="rounded-2xl border border-amber-500/25 bg-amber-950/20 p-5 flex items-start space-x-4">
        <ShieldCheck className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold text-amber-300 mb-1">Privacy Notice</div>
          <p className="text-xs text-amber-200/70 leading-relaxed">
            All data processing happens locally on your machine — nothing is sent to external servers or AI APIs.
            However, <strong>synthetic data is not guaranteed to be anonymous</strong>.
            Generated records may statistically resemble training records.
            Do not upload personal or sensitive real-world data without proper authorisation and a formal privacy assessment.
          </p>
        </div>
      </div>
    </div>
  );
}
