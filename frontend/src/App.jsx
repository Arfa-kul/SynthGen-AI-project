import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import OverviewPage from './pages/OverviewPage';
import UploadPage from './pages/UploadPage';
import ProfilePage from './pages/ProfilePage';
import ConfigurePage from './pages/ConfigurePage';
import PreviewPage from './pages/PreviewPage';
import QualityPage from './pages/QualityPage';
import HistoryPage from './pages/HistoryPage';
import { api } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [backendOnline, setBackendOnline] = useState(false);
  const [activeDataset, setActiveDataset] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const pollingRef = useRef(null);

  const checkHealth = useCallback(async () => {
    try {
      await api.checkHealth();
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // Poll running jobs
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    if (activeJob && (activeJob.status === 'queued' || activeJob.status === 'running')) {
      pollingRef.current = setInterval(async () => {
        try {
          const data = await api.getJobStatus(activeJob.id);
          setActiveJob(data);
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(pollingRef.current);
          }
        } catch (err) {
          console.error('Poll error:', err);
        }
      }, 2000);
    }
    return () => clearInterval(pollingRef.current);
  }, [activeJob?.id, activeJob?.status]);

  const handleDatasetReady = useCallback((dataset) => {
    setActiveDataset(dataset);
    setActiveJob(null);
    setActiveTab('profile');
  }, []);

  const handleJobStarted = useCallback((job) => {
    setActiveJob(job);
    setActiveTab('configure');
  }, []);

  const handleJobComplete = useCallback((job) => {
    setActiveJob(job);
  }, []);

  const pageProps = {
    activeDataset,
    activeJob,
    setActiveTab,
    onDatasetReady: handleDatasetReady,
    onJobStarted: handleJobStarted,
    onJobComplete: handleJobComplete,
  };

  const pages = {
    overview: <OverviewPage {...pageProps} />,
    upload: <UploadPage {...pageProps} />,
    profile: <ProfilePage {...pageProps} />,
    configure: <ConfigurePage {...pageProps} />,
    preview: <PreviewPage {...pageProps} />,
    quality: <QualityPage {...pageProps} />,
    history: <HistoryPage {...pageProps} />,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar
        activeDataset={activeDataset}
        backendOnline={backendOnline}
        onRefresh={checkHealth}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeDataset={activeDataset}
          activeJob={activeJob}
        />
        <main className="flex-1 overflow-y-auto bg-slate-950">
          {pages[activeTab] || <OverviewPage {...pageProps} />}
        </main>
      </div>
    </div>
  );
}
