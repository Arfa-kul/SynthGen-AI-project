const API_BASE = '/api';

async function handleResponse(response) {
  if (!response.ok) {
    let errorDetail = 'An unexpected error occurred';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.error || errorJson.message || errorDetail;
    } catch {
      errorDetail = response.statusText || errorDetail;
    }
    throw new Error(errorDetail);
  }
  return response.json();
}

export const api = {
  // Datasets
  async uploadDataset(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/datasets/upload`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(res);
  },

  async loadSampleDataset(sampleKey = 'students') {
    const res = await fetch(`${API_BASE}/datasets/sample`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sample_key: sampleKey }),
    });
    return handleResponse(res);
  },

  async getDatasetProfile(datasetId) {
    const res = await fetch(`${API_BASE}/datasets/${datasetId}/profile`);
    return handleResponse(res);
  },

  async getDatasetPreview(datasetId, limit = 20) {
    const res = await fetch(`${API_BASE}/datasets/${datasetId}/preview?limit=${limit}`);
    return handleResponse(res);
  },

  async updateDatasetMetadata(datasetId, metadata) {
    const res = await fetch(`${API_BASE}/datasets/${datasetId}/metadata`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata }),
    });
    return handleResponse(res);
  },

  async listDatasets() {
    const res = await fetch(`${API_BASE}/datasets`);
    return handleResponse(res);
  },

  // Models & Generation
  async getModels() {
    const res = await fetch(`${API_BASE}/models`);
    return handleResponse(res);
  },

  async startGeneration(datasetId, { model_type, requested_rows, model_params }) {
    const res = await fetch(`${API_BASE}/datasets/${datasetId}/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_type,
        requested_rows,
        model_params,
      }),
    });
    return handleResponse(res);
  },

  async getJobStatus(jobId) {
    const res = await fetch(`${API_BASE}/jobs/${jobId}/status`);
    return handleResponse(res);
  },

  async getJobQuality(jobId) {
    const res = await fetch(`${API_BASE}/jobs/${jobId}/quality`);
    return handleResponse(res);
  },

  async getJobPreview(jobId, limit = 20) {
    const res = await fetch(`${API_BASE}/jobs/${jobId}/preview?limit=${limit}`);
    return handleResponse(res);
  },

  getDownloadUrl(jobId, format = 'csv') {
    return `${API_BASE}/jobs/${jobId}/download?format=${format}`;
  },

  // History
  async getHistory() {
    const res = await fetch(`${API_BASE}/history`);
    return handleResponse(res);
  },

  async deleteHistory(jobId) {
    const res = await fetch(`${API_BASE}/history/${jobId}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  // Health
  async checkHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse(res);
  },
};
