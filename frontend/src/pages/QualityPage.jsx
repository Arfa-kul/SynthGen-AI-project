import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, RadialBarChart, RadialBar,
} from 'recharts';
import { BarChart3, Loader2, AlertCircle, Info, ChevronDown } from 'lucide-react';
import { api } from '../api';

const REAL_COLOR = '#60a5fa';
const SYNTH_COLOR = '#a78bfa';

function ScoreGauge({ score, label, sublabel }) {
  const pct = Math.round((score || 0) * 100);
  const color = pct >= 80 ? '#10b981' : pct >= 65 ? '#f59e0b' : '#f43f5e';
  return (
    <div className="glass-panel rounded-2xl p-5 flex flex-col items-center justify-center text-center space-y-2">
      <div className="relative">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="40" fill="none" stroke="#1e293b" strokeWidth="10" />
          <circle
            cx="48" cy="48" r="40" fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${2 * Math.PI * 40 * pct / 100} ${2 * Math.PI * 40 * (100 - pct) / 100}`}
            strokeLinecap="round"
            transform="rotate(-90 48 48)"
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black" style={{ color }}>{pct}%</span>
        </div>
      </div>
      <div className="font-bold text-slate-200 text-sm">{label}</div>
      {sublabel && <div className="text-slate-500 text-xs">{sublabel}</div>}
    </div>
  );
}

function DistributionChart({ colData }) {
  const chartData = colData?.chart_data || [];
  const dataKey = colData?.type === 'numerical' ? 'bin' : 'category';
  if (!chartData.length) return null;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
        <XAxis dataKey={dataKey} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }}
          formatter={(v, name) => [`${v}%`, name === 'real_pct' ? 'Real' : 'Synthetic']}
        />
        <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v === 'real_pct' ? 'Real' : 'Synthetic'}</span>} />
        <Bar dataKey="real_pct" name="real_pct" fill={REAL_COLOR} radius={[3, 3, 0, 0]} opacity={0.85} />
        <Bar dataKey="synth_pct" name="synth_pct" fill={SYNTH_COLOR} radius={[3, 3, 0, 0]} opacity={0.85} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function QualityPage({ activeJob }) {
  const [quality, setQuality] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCol, setSelectedCol] = useState('');

  useEffect(() => {
    if (!activeJob || activeJob.status !== 'completed') return;
    setLoading(true);
    api.getJobQuality(activeJob.id)
      .then((d) => {
        setQuality(d.quality_report);
        const cols = Object.keys(d.quality_report?.column_distributions || {});
        if (cols.length) setSelectedCol(cols[0]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeJob?.id]);

  if (!activeJob || activeJob.status !== 'completed') {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-64 text-slate-500 space-y-2">
        <BarChart3 className="w-10 h-10 text-slate-700" />
        <p>Complete a generation job to view quality analytics.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64 space-x-3 text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      <span>Loading quality report…</span>
    </div>
  );

  if (error) return (
    <div className="p-8 flex items-start space-x-3 text-rose-400">
      <AlertCircle className="w-5 h-5 mt-0.5" /><span>{error}</span>
    </div>
  );

  if (!quality) return null;

  const colDistribs = quality.column_distributions || {};
  const selectedData = colDistribs[selectedCol];

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-white">Quality Analytics</h1>
        <p className="text-slate-400 text-sm">SDV fidelity evaluation — real vs. synthetic statistical comparison</p>
      </div>

      {/* Score gauges */}
      <div className="grid grid-cols-3 gap-4">
        <ScoreGauge score={quality.overall_score} label="Overall Quality" sublabel="SDV Composite" />
        <ScoreGauge score={quality.column_shapes_score} label="Column Shapes" sublabel="KS / TV Complement" />
        <ScoreGauge score={quality.column_pairs_score} label="Pairwise Trends" sublabel="Correlation Similarity" />
      </div>

      {/* Disclaimer */}
      <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-900/40 flex items-start space-x-3 text-xs text-slate-400">
        <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <span>{quality.disclaimer}</span>
      </div>

      {/* Distribution comparison */}
      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-200">Column Distribution Comparison</h2>
          <div className="relative">
            <select
              id="select-column"
              value={selectedCol}
              onChange={(e) => setSelectedCol(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/40 cursor-pointer"
            >
              {Object.keys(colDistribs).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          </div>
        </div>
        {selectedData && (
          <>
            <DistributionChart colData={selectedData} />
            {selectedData.stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
                {selectedData.type === 'numerical' && [
                  ['Mean', selectedData.stats.real_mean, selectedData.stats.synth_mean],
                  ['Median', selectedData.stats.real_median, selectedData.stats.synth_median],
                  ['Std Dev', selectedData.stats.real_std, selectedData.stats.synth_std],
                  ['Min/Max', `${selectedData.stats.real_min} / ${selectedData.stats.real_max}`, `${selectedData.stats.synth_min} / ${selectedData.stats.synth_max}`],
                ].map(([lbl, rv, sv]) => (
                  <div key={lbl} className="bg-slate-900/60 rounded-xl p-3 text-xs">
                    <div className="text-slate-500 mb-1.5">{lbl}</div>
                    <div className="flex justify-between">
                      <span className="text-blue-400 font-semibold">{rv}</span>
                      <span className="text-violet-400 font-semibold">{sv}</span>
                    </div>
                    <div className="flex justify-between text-[10px] mt-0.5">
                      <span className="text-slate-600">Real</span>
                      <span className="text-slate-600">Synth</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Per-column score table */}
      {quality.column_details?.length > 0 && (
        <div className="glass-panel rounded-2xl p-6">
          <h2 className="text-base font-bold text-slate-200 mb-4">Per-Column Fidelity Scores</h2>
          <div className="space-y-2">
            {quality.column_details.map((col) => {
              const pct = Math.round(col.score * 100);
              const color = pct >= 80 ? '#10b981' : pct >= 65 ? '#f59e0b' : '#f43f5e';
              return (
                <div key={col.column} className="flex items-center space-x-3">
                  <div className="text-xs text-slate-400 w-32 truncate flex-shrink-0">{col.column}</div>
                  <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <div className="text-xs font-bold w-10 text-right" style={{ color }}>{pct}%</div>
                  <div className="text-[10px] text-slate-600 hidden sm:block w-28 truncate">{col.metric}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pairwise table */}
      {quality.pair_details?.length > 0 && (
        <div className="glass-panel rounded-2xl p-6">
          <h2 className="text-base font-bold text-slate-200 mb-4">Pairwise Correlation Fidelity</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 px-3 text-slate-400">Column 1</th>
                  <th className="text-left py-2 px-3 text-slate-400">Column 2</th>
                  <th className="text-left py-2 px-3 text-slate-400">Metric</th>
                  <th className="text-right py-2 px-3 text-slate-400">Score</th>
                </tr>
              </thead>
              <tbody>
                {quality.pair_details.map((p, i) => {
                  const pct = Math.round(p.score * 100);
                  const color = pct >= 80 ? '#10b981' : pct >= 65 ? '#f59e0b' : '#f43f5e';
                  return (
                    <tr key={i} className="border-b border-slate-900/50">
                      <td className="py-2 px-3 text-slate-300">{p.column_1}</td>
                      <td className="py-2 px-3 text-slate-300">{p.column_2}</td>
                      <td className="py-2 px-3 text-slate-500">{p.metric}</td>
                      <td className="py-2 px-3 text-right font-bold" style={{ color }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
