import React, { useEffect, useState } from 'react';
import { History, Trash2, Loader2, AlertCircle, CheckCircle2, XCircle, Clock, Download } from 'lucide-react';
import { api } from '../api';

const STATUS_STYLES = {
  completed: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  running: { icon: Loader2, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', spin: true },
  failed: { icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
  queued: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-800 border-slate-700' },
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await api.getHistory();
      setHistory(data.history || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleDelete = async (jobId) => {
    if (!confirm('Delete this history entry and its generated file?')) return;
    setDeleting(jobId);
    try {
      await api.deleteHistory(jobId);
      setHistory((prev) => prev.filter((h) => h.id !== jobId));
    } catch (e) {
      alert('Failed to delete: ' + e.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = (jobId, format) => {
    window.open(api.getDownloadUrl(jobId, format), '_blank');
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64 space-x-3 text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      <span>Loading history…</span>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Generation History</h1>
          <p className="text-slate-400 text-sm">Past synthetic data generation jobs stored locally in SQLite.</p>
        </div>
        <button
          id="btn-refresh-history"
          onClick={fetchHistory}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start space-x-3 p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {history.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500 space-y-3">
          <History className="w-12 h-12 text-slate-800" />
          <p className="text-base">No generation history yet.</p>
          <p className="text-sm text-slate-600">Upload a dataset and generate synthetic data to see records here.</p>
        </div>
      )}

      <div className="space-y-4">
        {history.map((job) => {
          const style = STATUS_STYLES[job.status] || STATUS_STYLES.queued;
          const Icon = style.icon;
          const pct = job.quality_score ? Math.round(job.quality_score * 100) : null;

          return (
            <div key={job.id} className="glass-panel rounded-2xl p-5 hover:border-slate-700 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center space-x-3">
                    <span className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${style.bg} ${style.color}`}>
                      <Icon className={`w-3.5 h-3.5 ${style.spin ? 'animate-spin' : ''}`} />
                      <span>{job.status}</span>
                    </span>
                    <span className="text-sm font-semibold text-slate-200 truncate">{job.dataset_name}</span>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="flex items-center space-x-1">
                      <span className="text-slate-600">Model:</span>
                      <span className="text-slate-400 font-medium">{job.model_type?.replace('Synthesizer', '')}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="text-slate-600">Requested:</span>
                      <span className="text-slate-400 font-medium">{job.requested_rows?.toLocaleString()} rows</span>
                    </span>
                    {job.generated_rows > 0 && (
                      <span className="flex items-center space-x-1">
                        <span className="text-slate-600">Generated:</span>
                        <span className="text-slate-400 font-medium">{job.generated_rows?.toLocaleString()} rows</span>
                      </span>
                    )}
                    {pct !== null && (
                      <span className="flex items-center space-x-1">
                        <span className="text-slate-600">Quality:</span>
                        <span className={`font-bold ${pct >= 80 ? 'text-emerald-400' : pct >= 65 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {pct}%
                        </span>
                      </span>
                    )}
                    <span className="text-slate-600">{formatDate(job.created_at)}</span>
                  </div>

                  {job.status === 'running' && (
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-slate-800 rounded-full h-1.5 max-w-xs overflow-hidden">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
                          style={{ width: `${job.progress || 5}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">{job.progress}%</span>
                    </div>
                  )}
                  {job.status === 'failed' && job.message && (
                    <p className="text-xs text-rose-400/80 truncate max-w-md">{job.message}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  {job.status === 'completed' && (
                    <>
                      <button
                        onClick={() => handleDownload(job.id, 'csv')}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-700/30 hover:bg-emerald-600/40 text-emerald-400 text-xs font-medium border border-emerald-500/30 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /><span>CSV</span>
                      </button>
                      <button
                        onClick={() => handleDownload(job.id, 'report')}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-medium border border-slate-700 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /><span>Report</span>
                      </button>
                    </>
                  )}
                  <button
                    id={`btn-delete-${job.id}`}
                    disabled={deleting === job.id}
                    onClick={() => handleDelete(job.id)}
                    className="p-2 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    {deleting === job.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
