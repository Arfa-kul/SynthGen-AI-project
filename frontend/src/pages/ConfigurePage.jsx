import React, { useState, useEffect } from 'react';
import { Sparkles, Info, Loader2, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import { api } from '../api';

const MODEL_DESCRIPTIONS = {
  GaussianCopulaSynthesizer: {
    tag: 'Statistical',
    tagColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    summary: 'Fast multivariate copula model. Learns correlations between columns using statistical distributions. Best for structured numerical & categorical data with moderate complexity.',
    pros: ['Very fast training', 'Great explainability', 'Works with small datasets'],
    cons: ['May miss complex non-linear relationships'],
  },
  CTGANSynthesizer: {
    tag: 'Deep Learning (GAN)',
    tagColor: 'text-violet-400 border-violet-500/30 bg-violet-500/10',
    summary: 'Conditional Tabular GAN — a deep learning architecture conditioned on categories. Captures complex multimodal distributions in tabular data.',
    pros: ['Handles mixed-type data well', 'Learns subtle patterns'],
    cons: ['Slower to train', 'Needs more rows to learn effectively'],
  },
  TVAESynthesizer: {
    tag: 'Deep Learning (VAE)',
    tagColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    summary: 'Tabular Variational AutoEncoder. Encodes data into a compressed latent space then samples from it. Often faster than CTGAN with high fidelity.',
    pros: ['Good quality-speed balance', 'Stable training'],
    cons: ['May under-sample rare categories'],
  },
};

export default function ConfigurePage({ activeDataset, activeJob, onJobStarted, setActiveTab }) {
  const [models, setModels] = useState({});
  const [selectedModel, setSelectedModel] = useState('GaussianCopulaSynthesizer');
  const [rows, setRows] = useState(200);
  const [seed, setSeed] = useState('');
  const [epochs, setEpochs] = useState(100);
  const [batchSize, setBatchSize] = useState(200);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getModels().then((d) => {
      setModels(d.models || {});
      setRows(d.default_rows || 200);
    }).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!activeDataset) return;
    setSubmitting(true);
    setError('');
    try {
      const params = { model_type: selectedModel, requested_rows: rows, model_params: {} };
      if (seed.trim() !== '') params.model_params.random_seed = parseInt(seed, 10);
      if (selectedModel !== 'GaussianCopulaSynthesizer') {
        params.model_params.epochs = epochs;
        params.model_params.batch_size = batchSize;
      }
      const res = await api.startGeneration(activeDataset.id, params);
      onJobStarted(res.job);
      setActiveTab('configure'); // stay on page to show progress via sidebar
    } catch (err) {
      setError(err.message || 'Failed to start generation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!activeDataset) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-64 text-slate-500">
        <Sparkles className="w-10 h-10 mb-3 text-slate-700" />
        <p>Upload a dataset first before configuring the model.</p>
      </div>
    );
  }

  const desc = MODEL_DESCRIPTIONS[selectedModel] || {};

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-white">Configure & Synthesize</h1>
        <p className="text-slate-400 text-sm">Choose a synthesizer, set parameters, and train the model on <strong className="text-slate-300">{activeDataset.original_name}</strong>.</p>
      </div>

      {/* Active job tracker */}
      {activeJob && (activeJob.status === 'running' || activeJob.status === 'queued') && (
        <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-amber-300 font-semibold text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Job {activeJob.status === 'queued' ? 'Queued' : 'Running'}…</span>
            </div>
            <span className="text-xs text-amber-400/70">{activeJob.progress || 0}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
              style={{ width: `${activeJob.progress || 5}%` }}
            />
          </div>
          <p className="text-xs text-amber-200/60">{activeJob.message || 'Processing…'}</p>
        </div>
      )}

      {activeJob?.status === 'completed' && (
        <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-emerald-300 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>Previous job completed — Quality: {Math.round((activeJob.quality_score || 0) * 100)}%</span>
          </div>
          <button
            onClick={() => setActiveTab('quality')}
            className="text-xs text-emerald-400 hover:text-white font-medium transition-colors"
          >
            View Results →
          </button>
        </div>
      )}

      {activeJob?.status === 'failed' && (
        <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 flex items-start space-x-2 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>Previous job failed: {activeJob.message}</span>
        </div>
      )}

      {/* Model selection */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-slate-200">1. Choose Synthesizer</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {Object.entries(MODEL_DESCRIPTIONS).map(([modelKey, meta]) => (
            <button
              key={modelKey}
              id={`btn-model-${modelKey}`}
              onClick={() => setSelectedModel(modelKey)}
              className={`text-left p-4 rounded-xl border transition-all ${
                selectedModel === modelKey
                  ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/10'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full border mb-2 inline-block ${meta.tagColor}`}>
                {meta.tag}
              </div>
              <div className="font-semibold text-sm text-slate-200 mb-1 break-all">
                {modelKey.replace('Synthesizer', '')}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">{meta.summary.substring(0, 80)}…</p>
            </button>
          ))}
        </div>
        {desc.pros && (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1.5">
            <p className="text-slate-300 leading-relaxed">{desc.summary}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {desc.pros.map((p) => <span key={p} className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">✓ {p}</span>)}
              {desc.cons.map((c) => <span key={c} className="px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded border border-rose-500/20">✗ {c}</span>)}
            </div>
          </div>
        )}
      </div>

      {/* Parameters */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-200">2. Generation Settings</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
              <span>Rows to Generate</span>
              <Info className="w-3.5 h-3.5 text-slate-600" />
            </label>
            <input
              id="input-rows"
              type="number"
              min={1} max={50000}
              value={rows}
              onChange={(e) => setRows(Math.min(50000, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-full px-3 py-2.5 rounded-xl glass-input text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
            <p className="text-[11px] text-slate-500">Generates new rows — not copies of originals. Max 50,000.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">Random Seed (optional)</label>
            <input
              id="input-seed"
              type="number"
              placeholder="e.g. 42"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl glass-input text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
            <p className="text-[11px] text-slate-500">Set for reproducibility. Leave blank for random output.</p>
          </div>
          {selectedModel !== 'GaussianCopulaSynthesizer' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Training Epochs</label>
                <input
                  id="input-epochs"
                  type="number" min={10} max={500}
                  value={epochs}
                  onChange={(e) => setEpochs(Math.min(500, Math.max(10, parseInt(e.target.value) || 100)))}
                  className="w-full px-3 py-2.5 rounded-xl glass-input text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
                <p className="text-[11px] text-slate-500">More epochs = better quality but longer training. Recommended: 100–200.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Batch Size</label>
                <input
                  id="input-batch-size"
                  type="number" min={10} max={1000}
                  value={batchSize}
                  onChange={(e) => setBatchSize(Math.min(1000, Math.max(10, parseInt(e.target.value) || 200)))}
                  className="w-full px-3 py-2.5 rounded-xl glass-input text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start space-x-3 p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Submit */}
      <button
        id="btn-start-generation"
        disabled={submitting || (activeJob && (activeJob.status === 'running' || activeJob.status === 'queued'))}
        onClick={handleGenerate}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-violet-600 text-white font-bold text-base tracking-wide shadow-xl shadow-brand-500/25 hover:shadow-brand-500/40 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
      >
        {submitting ? (
          <><Loader2 className="w-5 h-5 animate-spin" /><span>Starting Job…</span></>
        ) : (
          <><Sparkles className="w-5 h-5" /><span>Train & Generate Synthetic Data</span></>
        )}
      </button>
    </div>
  );
}
