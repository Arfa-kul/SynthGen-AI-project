import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, X, CheckCircle2, AlertCircle, Loader2, FlaskConical } from 'lucide-react';
import { api } from '../api';

export default function UploadPage({ onDatasetReady, setActiveTab }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | uploading | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [sampleLoading, setSampleLoading] = useState('');
  const inputRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setErrorMsg('Only CSV files are supported. Please select a .csv file.');
      setStatus('error');
      return;
    }
    setFile(f);
    setStatus('idle');
    setErrorMsg('');
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    setErrorMsg('');
    try {
      const res = await api.uploadDataset(file);
      setStatus('success');
      setTimeout(() => onDatasetReady(res.dataset), 900);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Upload failed. Please try again.');
    }
  };

  const handleSample = async (key, label) => {
    setSampleLoading(key);
    setErrorMsg('');
    try {
      const res = await api.loadSampleDataset(key);
      onDatasetReady(res.dataset);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load sample dataset.');
      setStatus('error');
    } finally {
      setSampleLoading('');
    }
  };

  const fmtSize = (bytes) => bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white mb-1">Upload Dataset</h1>
        <p className="text-slate-400 text-sm">Upload a CSV file to start generating synthetic data. Max 50 MB / 100K rows.</p>
      </div>

      {/* Drop zone */}
      <div
        id="upload-dropzone"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-12 flex flex-col items-center justify-center transition-all duration-200 ${
          dragging
            ? 'border-brand-500 bg-brand-500/10'
            : file
            ? 'border-emerald-500/60 bg-emerald-900/10'
            : 'border-slate-700 bg-slate-900/50 hover:border-brand-500/50 hover:bg-brand-500/5'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {file ? (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
            <div className="font-semibold text-white text-lg">{file.name}</div>
            <div className="text-slate-400 text-sm mt-1">{fmtSize(file.size)}</div>
            <button
              id="btn-clear-file"
              onClick={(e) => { e.stopPropagation(); setFile(null); setStatus('idle'); }}
              className="mt-4 flex items-center space-x-1.5 text-xs text-slate-400 hover:text-rose-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> <span>Remove file</span>
            </button>
          </>
        ) : (
          <>
            <UploadCloud className="w-12 h-12 text-slate-500 mb-3" />
            <div className="font-semibold text-slate-300">Drop your CSV here, or click to browse</div>
            <div className="text-slate-500 text-sm mt-1">Supports .csv up to 50 MB</div>
          </>
        )}
      </div>

      {/* Status messages */}
      {status === 'error' && (
        <div className="flex items-start space-x-3 p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {status === 'success' && (
        <div className="flex items-center space-x-3 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-sm">
          <CheckCircle2 className="w-5 h-5" />
          <span>Dataset uploaded successfully! Redirecting to profiling…</span>
        </div>
      )}

      {/* Upload button */}
      {file && status !== 'success' && (
        <button
          id="btn-upload-submit"
          disabled={status === 'uploading'}
          onClick={handleUpload}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white font-bold tracking-wide shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {status === 'uploading' ? (
            <><Loader2 className="w-5 h-5 animate-spin" /><span>Uploading & Profiling…</span></>
          ) : (
            <><UploadCloud className="w-5 h-5" /><span>Upload & Profile Dataset</span></>
          )}
        </button>
      )}

      {/* Sample datasets */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-slate-500 text-xs font-medium px-3">Or try a sample dataset</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { key: 'students', name: "Students' Exam Performance", rows: 50, cols: 8, desc: 'Gender, parental education, test scores, pass/fail' },
            { key: 'churn', name: 'Customer Churn', rows: 30, cols: 9, desc: 'Tenure, contract type, charges, churn flag' },
          ].map((s) => (
            <button
              key={s.key}
              id={`btn-sample-${s.key}`}
              disabled={!!sampleLoading}
              onClick={() => handleSample(s.key, s.name)}
              className="text-left p-4 rounded-xl glass-panel hover:border-brand-500/40 hover:bg-brand-500/5 transition-all group"
            >
              <div className="flex items-center space-x-2 mb-1">
                <FlaskConical className="w-4 h-4 text-brand-400" />
                <span className="font-semibold text-sm text-slate-200 group-hover:text-white">{s.name}</span>
              </div>
              <p className="text-xs text-slate-500 mb-2">{s.desc}</p>
              <div className="flex items-center space-x-2 text-[11px] text-slate-600">
                <span className="px-2 py-0.5 bg-slate-800 rounded">{s.rows} rows</span>
                <span className="px-2 py-0.5 bg-slate-800 rounded">{s.cols} columns</span>
              </div>
              {sampleLoading === s.key && (
                <div className="mt-2 flex items-center space-x-1.5 text-xs text-brand-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading…</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
