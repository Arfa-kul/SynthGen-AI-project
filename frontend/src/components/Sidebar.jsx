import React from 'react';
import { 
  LayoutDashboard, 
  UploadCloud, 
  FileSpreadsheet, 
  Sparkles, 
  Table, 
  BarChart3, 
  History,
  Shield,
  Layers,
  Info
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, activeDataset, activeJob }) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, badge: null },
    { id: 'upload', label: 'Upload Dataset', icon: UploadCloud, badge: null },
    { 
      id: 'profile', 
      label: 'Data Profiling', 
      icon: FileSpreadsheet, 
      disabled: !activeDataset,
      badge: activeDataset ? `${activeDataset.col_count} cols` : null 
    },
    { 
      id: 'configure', 
      label: 'Model & Synthesize', 
      icon: Sparkles, 
      disabled: !activeDataset,
      badge: null
    },
    { 
      id: 'preview', 
      label: 'Synthetic Preview', 
      icon: Table, 
      disabled: !activeJob || activeJob.status !== 'completed',
      badge: activeJob && activeJob.status === 'completed' ? 'Ready' : null
    },
    { 
      id: 'quality', 
      label: 'Quality Analytics', 
      icon: BarChart3, 
      disabled: !activeJob || activeJob.status !== 'completed',
      badge: activeJob?.quality_score ? `${Math.round(activeJob.quality_score * 100)}%` : null
    },
    { id: 'history', label: 'Generation History', icon: History, badge: null },
  ];

  return (
    <aside className="w-64 flex-shrink-0 min-h-[calc(100vh-65px)] bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between p-4">
      <div className="space-y-6">
        <div>
          <p className="px-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase mb-2">
            Navigation
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isDisabled = item.disabled;

              return (
                <button
                  key={item.id}
                  disabled={isDisabled}
                  onClick={() => !isDisabled && setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/20'
                      : isDisabled
                      ? 'text-slate-600 cursor-not-allowed'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : isDisabled ? 'text-slate-700' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      isActive 
                        ? 'bg-white/20 text-white' 
                        : 'bg-slate-800 text-slate-300'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Current Job Status Widget if active */}
        {activeJob && (
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Active Job</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                activeJob.status === 'completed'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : activeJob.status === 'running'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                  : activeJob.status === 'failed'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {activeJob.status}
              </span>
            </div>
            
            <p className="text-[11px] text-slate-400 truncate">{activeJob.model_type}</p>
            
            {activeJob.status === 'running' && (
              <div className="space-y-1">
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-brand-500 to-indigo-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${activeJob.progress || 10}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 truncate">{activeJob.message || 'Processing...'}</p>
              </div>
            )}

            {activeJob.status === 'completed' && activeJob.quality_score && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                <span className="text-slate-400">Quality Score:</span>
                <span className="font-bold text-emerald-400">{Math.round(activeJob.quality_score * 100)}%</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Safety & Academic Footer */}
      <div className="pt-4 border-t border-slate-800/80 space-y-2">
        <div className="flex items-center space-x-2 text-[11px] text-slate-500">
          <Shield className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span>No cloud transmission. Safe local execution.</span>
        </div>
        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60 text-[11px] text-slate-400">
          <div className="flex items-center space-x-1.5 text-slate-300 font-medium mb-1">
            <Info className="w-3.5 h-3.5 text-brand-400" />
            <span>Academic Note</span>
          </div>
          Statistical fidelity does not equate to mathematical k-anonymity.
        </div>
      </div>
    </aside>
  );
}
