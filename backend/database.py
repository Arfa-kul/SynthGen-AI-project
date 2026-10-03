import sqlite3
import json
from datetime import datetime
from backend.config import Config

def get_db_connection():
    conn = sqlite3.connect(Config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Datasets table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS datasets (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            row_count INTEGER NOT NULL,
            col_count INTEGER NOT NULL,
            file_size INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata_json TEXT,
            profile_json TEXT
        )
    """)
    
    # Generation jobs & history table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS generation_jobs (
            id TEXT PRIMARY KEY,
            dataset_id TEXT NOT NULL,
            dataset_name TEXT NOT NULL,
            model_type TEXT NOT NULL,
            model_params_json TEXT,
            requested_rows INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'queued',
            progress INTEGER DEFAULT 0,
            message TEXT,
            generated_file_path TEXT,
            generated_rows INTEGER DEFAULT 0,
            quality_score REAL,
            quality_report_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
        )
    """)
    
    # Create indexes for fast lookup
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_created ON generation_jobs(created_at DESC)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_datasets_created ON datasets(created_at DESC)")
    
    conn.commit()
    conn.close()

# Dataset operations
def save_dataset(dataset_id, filename, original_name, row_count, col_count, file_size, metadata_dict, profile_dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO datasets (id, filename, original_name, row_count, col_count, file_size, metadata_json, profile_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        dataset_id,
        filename,
        original_name,
        row_count,
        col_count,
        file_size,
        json.dumps(metadata_dict) if metadata_dict else None,
        json.dumps(profile_dict) if profile_dict else None
    ))
    conn.commit()
    conn.close()

def get_dataset(dataset_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM datasets WHERE id = ?", (dataset_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    if d.get("metadata_json"):
        d["metadata"] = json.loads(d["metadata_json"])
    if d.get("profile_json"):
        d["profile"] = json.loads(d["profile_json"])
    return d

def update_dataset_metadata(dataset_id, metadata_dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE datasets 
        SET metadata_json = ? 
        WHERE id = ?
    """, (json.dumps(metadata_dict), dataset_id))
    conn.commit()
    conn.close()

def list_datasets(limit=20):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, filename, original_name, row_count, col_count, file_size, created_at FROM datasets ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_dataset(dataset_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM datasets WHERE id = ?", (dataset_id,))
    conn.commit()
    conn.close()

# Job and History operations
def create_job(job_id, dataset_id, dataset_name, model_type, model_params_dict, requested_rows):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO generation_jobs (id, dataset_id, dataset_name, model_type, model_params_json, requested_rows, status, progress, message)
        VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, 'Job queued for training and generation')
    """, (
        job_id,
        dataset_id,
        dataset_name,
        model_type,
        json.dumps(model_params_dict) if model_params_dict else None,
        requested_rows
    ))
    conn.commit()
    conn.close()

def update_job_status(job_id, status, progress=None, message=None, generated_file_path=None, generated_rows=None, quality_score=None, quality_report_dict=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    updates = ["status = ?"]
    params = [status]
    
    if progress is not None:
        updates.append("progress = ?")
        params.append(progress)
    if message is not None:
        updates.append("message = ?")
        params.append(message)
    if generated_file_path is not None:
        updates.append("generated_file_path = ?")
        params.append(generated_file_path)
    if generated_rows is not None:
        updates.append("generated_rows = ?")
        params.append(generated_rows)
    if quality_score is not None:
        updates.append("quality_score = ?")
        params.append(quality_score)
    if quality_report_dict is not None:
        updates.append("quality_report_json = ?")
        params.append(json.dumps(quality_report_dict))
    if status in ("completed", "failed"):
        updates.append("completed_at = CURRENT_TIMESTAMP")
        
    params.append(job_id)
    query = f"UPDATE generation_jobs SET {', '.join(updates)} WHERE id = ?"
    cursor.execute(query, params)
    conn.commit()
    conn.close()

def get_job(job_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM generation_jobs WHERE id = ?", (job_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    if d.get("model_params_json"):
        d["model_params"] = json.loads(d["model_params_json"])
    if d.get("quality_report_json"):
        d["quality_report"] = json.loads(d["quality_report_json"])
    return d

def get_history(limit=50):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, dataset_id, dataset_name, model_type, requested_rows, 
               status, progress, message, generated_rows, quality_score, 
               created_at, completed_at, generated_file_path
        FROM generation_jobs 
        ORDER BY created_at DESC 
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_history(job_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT generated_file_path FROM generation_jobs WHERE id = ?", (job_id,))
    row = cursor.fetchone()
    cursor.execute("DELETE FROM generation_jobs WHERE id = ?", (job_id,))
    conn.commit()
    conn.close()
    return row["generated_file_path"] if row and row["generated_file_path"] else None
