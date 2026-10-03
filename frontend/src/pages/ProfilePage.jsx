import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { FileSpreadsheet, Hash, Tag, ToggleLeft, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../api';

const TYPE_COLORS = {
  numerical: '#60a5fa',
  categorical: '#a78bfa',
  boolean: '#34d399',
  datetime: '#f59e0b',
  id: '#94a3b8',
};

const TYPE_ICONS = {
  numerical: Hash,
  categorical: Tag,
  boolean: ToggleLeft,
  datetime: Calendar,
  id: Hash,
};

function ColCard({ info }) {
  const Icon = TYPE_ICONS[info.inferred_type] || Tag;
  const color = TYPE_COLORS[info.inferred_type] || '#94a3b8';

  return (
    <div className="glass-panel rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="p-1.5 rounded-lg" style={{ background: `${color}22` }}>
            <Icon className="w-3.5 h-3.5" style={{ color }} />
          </div>
          <span className="font-semibold text-sm text-white truncate">{info.name}</span>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border shrink-0 ml-2"
          style={{ color, borderColor: `${color}55`, background: `${color}18` }}>
          {info.inferred_type}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-slate-900/60 rounded-lg p-2 text-center">
          <div className="text-slate-400 text-[10px]">Unique</div>
          <div className="font-bold text-slate-200">{info.unique_count}</div>
        </div>
        <div className="bg-slate-900/60 rounded-lg p-2 text-center">
          <div className="text-slate-400 text-[10px]">Missing</div>
          <div className="font-bold text-slate-200">{info.missing_pct}%</div>
        </div>
        <div className="bg-slate-900/60 rounded-lg p-2 text-center">
          <div className="text-slate-400 text-[10px]">Non-null</div>
          <div className="font-bold text-slate-200">{info.non_null_count}</div>
        </div>
      </div>
      {info.inferred_type === 'numerical' && info.histogram && info.histogram.length > 0 && (
        <ResponsiveContainer width="100%" height={60}>
          <BarChart data={info.histogram} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
              {info.histogram.map((_, i) => (
                <Cell key={i} fill={color} opacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      {info.inferred_type === 'numerical' && (
        <div className="grid grid-cols-4 gap-1 text-[10px] text-slate-400">
          {[['Min', info.min], ['Max', info.max], ['Mean', info.mean?.toFixed(1)], ['Med', info.median?.toFixed(1)]].map(([lbl, val]) => (
            <div key={lbl} className="bg-slate-900/60 rounded p-1 text-center">
              <div className="text-slate-500">{lbl}</div>
              <div className="font-semibold text-slate-300">{val}</div>
            </div>
          ))}
        </div>
      )}
      {info.frequencies && info.frequencies.slice(0, 3).map((f) => (
        <div key={f.value} className="flex items-center space-x-2 text-xs">
          <div className="flex-1 bg-slate-800/60 rounded-full h-1.5 overflow-hidden">
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${f.percentage}%`, background: color }} />
          </div>
          <span className="text-slate-400 w-16 truncate text-right">{f.value}</span>
          <span className="text-slate-500 w-8 text-right">{f.percentage}%</span>
        </div>
      ))}
    </div>
  );
}

export default function ProfilePage({ activeDataset, setActiveTab }) {
  const [profile, setProfile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!activeDataset?.id) return;
    setLoading(true);
    Promise.all([
      api.getDatasetProfile(activeDataset.id),
      api.getDatasetPreview(activeDataset.id, 15),
    ]).then(([p, pv]) => {
      setProfile(p);
      setPreview(pv);
    }).catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [activeDataset?.id]);

  if (!activeDataset) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-64 text-slate-500">
        <FileSpreadsheet className="w-10 h-10 mb-3 text-slate-700" />
        <p>No dataset loaded. Upload a CSV first.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64 space-x-3 text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      <span>Loading profile…</span>
    </div>
  );

  if (err) return (
    <div className="p-8 flex items-start space-x-3 text-rose-400">
      <AlertCircle className="w-5 h-5 mt-0.5" />
      <span>{err}</span>
    </div>
  );

  const p = profile?.profile || {};
  const typePieData = Object.entries(p.type_counts || {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k, value: v, fill: TYPE_COLORS[k] || '#94a3b8' }));

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">{activeDataset.original_name}</h1>
          <p className="text-slate-400 text-sm">Automatic profile generated from your dataset</p>
        </div>
        <button
          id="btn-go-configure"
          onClick={() => setActiveTab('configure')}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white font-semibold text-sm shadow-lg hover:shadow-brand-500/40 transition-all hover:-translate-y-0.5"
        >
          Configure Model →
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Rows', value: p.total_rows?.toLocaleString() || 0 },
          { label: 'Columns', value: p.total_columns || 0 },
          { label: 'Missing Cells', value: `${p.missing_pct_overall || 0}%` },
          { label: 'Duplicate Rows', value: p.duplicate_rows || 0 },
        ].map((c) => (
          <div key={c.label} className="glass-panel rounded-xl p-4">
            <div className="text-2xl font-black text-white">{c.value}</div>
            <div className="text-xs text-slate-400 font-medium">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Type distribution pie + preview table */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass-panel rounded-2xl p-5">
          <h3 className="font-bold text-slate-200 mb-4 text-sm">Column Types</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={typePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                {typePieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Legend formatter={(val) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{val}</span>} />
              <Tooltip formatter={(v) => [v, 'Columns']} contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-2 glass-panel rounded-2xl p-5">
          <h3 className="font-bold text-slate-200 mb-4 text-sm">Data Preview (first 15 rows)</h3>
          {preview && (
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr>
                    {(preview.columns || []).map((c) => (
                      <th key={c} className="text-left px-2 py-1.5 text-slate-400 font-semibold border-b border-slate-800 whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(preview.records || []).map((row, ri) => (
                    <tr key={ri} className="border-b border-slate-900/60 hover:bg-slate-900/40">
                      {(preview.columns || []).map((c) => (
                        <td key={c} className="px-2 py-1.5 text-slate-300 whitespace-nowrap max-w-[120px] truncate">
                          {row[c] === null || row[c] === undefined ? (
                            <span className="text-slate-600 italic">null</span>
                          ) : String(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Column cards */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Column Details</h2>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Object.values(p.columns || {}).map((colInfo) => (
            <ColCard key={colInfo.name} info={colInfo} />
          ))}
        </div>
      </div>
    </div>
  );
}
