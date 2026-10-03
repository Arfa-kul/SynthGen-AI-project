import os
import pandas as pd
from pathlib import Path
from flask import Blueprint, request, jsonify, send_file
from backend.config import Config
from backend import database
from backend.job_service import submit_generation_job, get_job_info
from backend.export_service import export_file, get_generated_df

gen_bp = Blueprint("generation", __name__, url_prefix="/api")

@gen_bp.route("/models", methods=["GET"])
def get_supported_models():
    """Return all available SDV synthesizers and their parameters"""
    return jsonify({
        "models": Config.SUPPORTED_MODELS,
        "default_rows": Config.DEFAULT_GENERATION_ROWS,
        "max_rows": Config.MAX_ROWS_GENERATE
    }), 200

@gen_bp.route("/datasets/<dataset_id>/train", methods=["POST"])
@gen_bp.route("/jobs/<dataset_id>/generate", methods=["POST"])
def start_generation(dataset_id):
    """
    Kick off model training and synthetic data generation job.
    """
    body = request.get_json() or {}
    
    # Validation
    dataset = database.get_dataset(dataset_id)
    if not dataset:
        return jsonify({"error": f"Dataset {dataset_id} not found."}), 404
        
    model_type = body.get("model_type", "GaussianCopulaSynthesizer")
    if model_type not in Config.SUPPORTED_MODELS:
        return jsonify({
            "error": f"Invalid model '{model_type}'. Choose from: {list(Config.SUPPORTED_MODELS.keys())}"
        }), 400
        
    requested_rows = body.get("requested_rows", Config.DEFAULT_GENERATION_ROWS)
    try:
        requested_rows = int(requested_rows)
    except (ValueError, TypeError):
        return jsonify({"error": "requested_rows must be a valid integer."}), 400
        
    if requested_rows < 1:
        return jsonify({"error": "Requested rows must be at least 1."}), 400
        
    if requested_rows > Config.MAX_ROWS_GENERATE:
        return jsonify({
            "error": f"Requested rows ({requested_rows}) exceeds max generation limit of {Config.MAX_ROWS_GENERATE}."
        }), 400

    model_params = body.get("model_params", {})
    if not isinstance(model_params, dict):
        model_params = {}
        
    try:
        job = submit_generation_job(
            dataset_id=dataset_id,
            model_type=model_type,
            model_params=model_params,
            requested_rows=requested_rows
        )
        return jsonify({
            "message": "Generation job created and started in background.",
            "job": job
        }), 202
    except Exception as e:
        return jsonify({"error": f"Failed to start generation job: {str(e)}"}), 500

@gen_bp.route("/jobs/<job_id>/status", methods=["GET"])
def get_job_status(job_id):
    try:
        job = get_job_info(job_id)
        return jsonify({
            "job_id": job["id"],
            "dataset_id": job["dataset_id"],
            "dataset_name": job["dataset_name"],
            "model_type": job["model_type"],
            "requested_rows": job["requested_rows"],
            "generated_rows": job["generated_rows"],
            "status": job["status"],
            "progress": job["progress"],
            "message": job["message"],
            "quality_score": job["quality_score"],
            "created_at": job["created_at"],
            "completed_at": job["completed_at"]
        }), 200
    except FileNotFoundError as fnf:
        return jsonify({"error": str(fnf)}), 404
    except Exception as e:
        return jsonify({"error": f"Error fetching status: {str(e)}"}), 500

@gen_bp.route("/jobs/<job_id>/quality", methods=["GET"])
def get_quality_report(job_id):
    try:
        job = get_job_info(job_id)
        if job["status"] != "completed":
            return jsonify({
                "job_id": job_id,
                "status": job["status"],
                "message": "Quality evaluation is only available once job has completed."
            }), 400
            
        return jsonify({
            "job_id": job["id"],
            "dataset_name": job["dataset_name"],
            "model_type": job["model_type"],
            "quality_score": job["quality_score"],
            "quality_report": job.get("quality_report")
        }), 200
    except FileNotFoundError as fnf:
        return jsonify({"error": str(fnf)}), 404
    except Exception as e:
        return jsonify({"error": f"Failed to fetch quality report: {str(e)}"}), 500

@gen_bp.route("/jobs/<job_id>/preview", methods=["GET"])
def get_generated_preview(job_id):
    limit = request.args.get("limit", default=Config.PREVIEW_ROWS, type=int)
    limit = min(max(limit, 5), 100)
    try:
        df, job, _ = get_generated_df(job_id)
        preview_df = df.head(limit).copy()
        preview_df = preview_df.replace({float('inf'): None, float('-inf'): None})
        preview_df = preview_df.where(pd.notnull(preview_df), None)
        
        return jsonify({
            "job_id": job_id,
            "dataset_name": job["dataset_name"],
            "model_type": job["model_type"],
            "total_rows": len(df),
            "columns": list(df.columns),
            "records": preview_df.to_dict(orient="records")
        }), 200
    except (FileNotFoundError, ValueError) as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to preview generated data: {str(e)}"}), 500

@gen_bp.route("/jobs/<job_id>/download", methods=["GET"])
def download_output(job_id):
    format_type = request.args.get("format", default="csv").lower()
    try:
        file_path, filename, mime_type = export_file(job_id, export_type=format_type)
        return send_file(
            file_path,
            as_attachment=True,
            download_name=filename,
            mimetype=mime_type
        )
    except FileNotFoundError as fnf:
        return jsonify({"error": str(fnf)}), 404
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": f"Download failed: {str(e)}"}), 500
