import os
import uuid
import re
import pandas as pd
import numpy as np
from pathlib import Path
from werkzeug.utils import secure_filename
from backend.config import Config, UPLOAD_DIR
from backend import database
from backend.profiling_service import profile_dataframe, build_sdv_metadata_dict

def sanitize_filename(filename):
    clean_name = secure_filename(filename)
    if not clean_name:
        clean_name = f"dataset_{uuid.uuid4().hex[:8]}.csv"
    # Ensure .csv extension
    if not clean_name.lower().endswith(".csv"):
        clean_name += ".csv"
    return clean_name

def read_csv_safely(file_path):
    """Attempt reading CSV with standard encodings and fallback delimiters"""
    encodings = ["utf-8", "latin-1", "iso-8859-1", "cp1252"]
    last_error = None
    for enc in encodings:
        try:
            df = pd.read_csv(file_path, encoding=enc)
            return df
        except UnicodeDecodeError as e:
            last_error = e
            continue
        except Exception as e:
            last_error = e
            break
    raise ValueError(f"Failed to read CSV file: {str(last_error)}")

def process_and_save_csv(file_stream, original_filename, is_sample=False):
    """
    Validate, save and profile an incoming CSV file or sample dataset.
    """
    clean_original = sanitize_filename(original_filename)
    dataset_id = str(uuid.uuid4())
    stored_filename = f"{dataset_id}.csv"
    dest_path = UPLOAD_DIR / stored_filename
    
    # Save file to disk
    if hasattr(file_stream, "save"):
        file_stream.save(str(dest_path))
    elif isinstance(file_stream, (str, Path)):
        # If copying from sample file
        import shutil
        shutil.copy(str(file_stream), str(dest_path))
    else:
        with open(dest_path, "wb") as f:
            f.write(file_stream.read())
            
    # Check file size
    file_size = dest_path.stat().st_size
    if file_size == 0:
        if dest_path.exists():
            dest_path.unlink()
        raise ValueError("The uploaded CSV file is empty (0 bytes).")
        
    if file_size > Config.MAX_CONTENT_LENGTH:
        if dest_path.exists():
            dest_path.unlink()
        raise ValueError(f"File size exceeds maximum allowed limit of {Config.MAX_CONTENT_LENGTH // (1024*1024)}MB.")

    # Read and validate contents with pandas
    try:
        df = read_csv_safely(dest_path)
    except Exception as e:
        if dest_path.exists():
            dest_path.unlink()
        raise ValueError(f"Invalid or malformed CSV format: {str(e)}")

    row_count, col_count = df.shape
    if row_count < 3:
        if dest_path.exists():
            dest_path.unlink()
        raise ValueError("Dataset must have at least 3 rows to learn statistical patterns.")
        
    if col_count < 1:
        if dest_path.exists():
            dest_path.unlink()
        raise ValueError("Dataset must have at least 1 column.")
        
    if row_count > Config.MAX_ROWS_UPLOAD:
        if dest_path.exists():
            dest_path.unlink()
        raise ValueError(f"Dataset has {row_count} rows, which exceeds the limit of {Config.MAX_ROWS_UPLOAD} rows.")

    # Run profiling
    profile = profile_dataframe(df)
    metadata_dict = build_sdv_metadata_dict(df, profile)
    
    # Persist in DB
    database.save_dataset(
        dataset_id=dataset_id,
        filename=stored_filename,
        original_name=clean_original,
        row_count=row_count,
        col_count=col_count,
        file_size=file_size,
        metadata_dict=metadata_dict,
        profile_dict=profile
    )
    
    return {
        "id": dataset_id,
        "filename": stored_filename,
        "original_name": clean_original,
        "row_count": row_count,
        "col_count": col_count,
        "file_size": file_size,
        "profile": profile,
        "metadata": metadata_dict
    }

def get_dataset_df(dataset_id):
    dataset = database.get_dataset(dataset_id)
    if not dataset:
        raise FileNotFoundError(f"Dataset with ID {dataset_id} not found.")
    file_path = UPLOAD_DIR / dataset["filename"]
    if not file_path.exists():
        raise FileNotFoundError(f"Underlying CSV file for dataset {dataset_id} does not exist.")
    return read_csv_safely(file_path), dataset

def get_dataset_preview(dataset_id, limit=20):
    df, dataset = get_dataset_df(dataset_id)
    preview_df = df.head(limit).copy()
    
    # Replace NaN, inf, -inf with None for valid JSON serialization
    preview_df = preview_df.replace({np.nan: None, np.inf: None, -np.inf: None})
    records = preview_df.to_dict(orient="records")
    
    return {
        "dataset_id": dataset_id,
        "original_name": dataset["original_name"],
        "total_rows": dataset["row_count"],
        "total_columns": dataset["col_count"],
        "file_size": dataset["file_size"],
        "preview_count": len(records),
        "columns": list(df.columns),
        "records": records,
        "duplicate_rows": int(df.duplicated().sum()),
        "missing_cells_total": int(df.isna().sum().sum())
    }
