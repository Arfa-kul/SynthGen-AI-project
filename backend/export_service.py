import os
import json
import pandas as pd
from pathlib import Path
from backend.config import GENERATED_DIR, REPORTS_DIR
from backend import database

def get_generated_df(job_id):
    job = database.get_job(job_id)
    if not job:
        raise FileNotFoundError(f"Job with ID {job_id} not found.")
        
    if job.get("status") != "completed":
        raise ValueError(f"Job {job_id} is not yet completed. Current status: {job.get('status')}")
        
    file_path = job.get("generated_file_path")
    if not file_path or not Path(file_path).exists():
        fallback_path = GENERATED_DIR / f"{job_id}.csv"
        if not fallback_path.exists():
            raise FileNotFoundError(f"Generated synthetic dataset file for job {job_id} not found.")
        file_path = str(fallback_path)
        
    return pd.read_csv(file_path), job, Path(file_path)

def generate_text_report(job):
    """
    Format a clean, readable text evaluation report for the user.
    """
    qr = job.get("quality_report") or {}
    lines = [
        "=" * 70,
        "SYNTHGEN AI — SYNTHETIC DATA QUALITY EVALUATION REPORT",
        "=" * 70,
        f"Job ID:             {job.get('id')}",
        f"Dataset Name:       {job.get('dataset_name')}",
        f"Model Synthesizer:  {job.get('model_type')}",
        f"Generated Rows:     {job.get('generated_rows')}",
        f"Created At:         {job.get('created_at')}",
        f"Completed At:       {job.get('completed_at')}",
        "-" * 70,
        "QUALITY SUMMARY SCORES",
        "-" * 70,
        f"Overall Quality Score:         {qr.get('overall_score_pct', 0)}%  ({qr.get('overall_score', 0)} / 1.0)",
        f"Column Shapes Similarity:      {qr.get('column_shapes_score_pct', 0)}%",
        f"Column Pair Trends Similarity: {qr.get('column_pairs_score_pct', 0)}%",
        "-" * 70,
        "INDIVIDUAL COLUMN FIDELITY",
        "-" * 70
    ]
    
    col_details = qr.get("column_details", [])
    if col_details:
        for c in col_details:
            lines.append(f"  * {c.get('column', 'N/A')}: {round(c.get('score', 0) * 100, 1)}% ({c.get('metric', '')})")
    else:
        lines.append("  (No individual column details available)")
        
    lines.extend([
        "-" * 70,
        "PAIRWISE RELATIONSHIPS",
        "-" * 70
    ])
    pair_details = qr.get("pair_details", [])
    if pair_details:
        for p in pair_details:
            lines.append(f"  * {p.get('column_1')} <-> {p.get('column_2')}: {round(p.get('score', 0) * 100, 1)}%")
    else:
        lines.append("  (Pairwise relationship metrics computed)")

    lines.extend([
        "-" * 70,
        "PRIVACY & ETHICAL DISCLAIMER",
        "-" * 70,
        qr.get("disclaimer", "Statistical similarity does not guarantee privacy or anonymity."),
        "=" * 70
    ])
    
    return "\n".join(lines)

def export_file(job_id, export_type="csv"):
    """
    Prepare file for download based on requested type: csv, json, or report.
    Returns (absolute_file_path, download_filename, mime_type)
    """
    df, job, csv_path = get_generated_df(job_id)
    dataset_base = Path(job.get("dataset_name", "dataset")).stem
    
    if export_type == "csv":
        download_name = f"synthetic_{dataset_base}_{job_id[:8]}.csv"
        return str(csv_path), download_name, "text/csv"
        
    elif export_type == "json":
        json_path = GENERATED_DIR / f"{job_id}.json"
        df.to_json(json_path, orient="records", indent=2)
        download_name = f"synthetic_{dataset_base}_{job_id[:8]}.json"
        return str(json_path), download_name, "application/json"
        
    elif export_type == "report":
        report_text = generate_text_report(job)
        report_path = REPORTS_DIR / f"quality_report_{job_id}.txt"
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(report_text)
        download_name = f"quality_report_{dataset_base}_{job_id[:8]}.txt"
        return str(report_path), download_name, "text/plain"
        
    elif export_type == "report_json":
        report_data = {
            "job_id": job.get("id"),
            "dataset_name": job.get("dataset_name"),
            "model_type": job.get("model_type"),
            "requested_rows": job.get("requested_rows"),
            "generated_rows": job.get("generated_rows"),
            "quality_report": job.get("quality_report"),
            "disclaimer": "This quality evaluation measures statistical similarity between real and synthetic data distributions."
        }
        report_json_path = REPORTS_DIR / f"quality_report_{job_id}.json"
        with open(report_json_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2)
        download_name = f"quality_report_{dataset_base}_{job_id[:8]}.json"
        return str(report_json_path), download_name, "application/json"
        
    else:
        raise ValueError(f"Unsupported export format '{export_type}'. Choose csv, json, report, or report_json.")
