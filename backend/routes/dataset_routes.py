import os
from pathlib import Path
from flask import Blueprint, request, jsonify
from backend.config import Config, SAMPLE_DATA_DIR
from backend import database
from backend.dataset_service import process_and_save_csv, get_dataset_preview, get_dataset_df

dataset_bp = Blueprint("datasets", __name__, url_prefix="/api/datasets")

@dataset_bp.route("/upload", methods=["POST"])
def upload_dataset():
    if "file" not in request.files:
        return jsonify({"error": "No file part in the request"}), 400
        
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected for upload"}), 400
        
    if not file.filename.lower().endswith(".csv"):
        return jsonify({"error": "Unsupported file format. Please upload a valid CSV (.csv) file."}), 400
        
    try:
        result = process_and_save_csv(file, file.filename)
        return jsonify({
            "message": "Dataset successfully uploaded and profiled.",
            "dataset": result
        }), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": f"Internal error during file processing: {str(e)}"}), 500

@dataset_bp.route("/sample", methods=["POST"])
def load_sample_dataset():
    data = request.get_json() or {}
    sample_key = data.get("sample_key", "students")
    
    file_map = {
        "students": SAMPLE_DATA_DIR / "students_performance.csv",
        "churn": SAMPLE_DATA_DIR / "customer_churn.csv"
    }
    
    sample_path = file_map.get(sample_key, file_map["students"])
    if not sample_path.exists():
        return jsonify({"error": f"Sample dataset '{sample_key}' not found on server."}), 404
        
    try:
        result = process_and_save_csv(sample_path, sample_path.name, is_sample=True)
        return jsonify({
            "message": f"Sample dataset '{sample_path.name}' loaded successfully.",
            "dataset": result
        }), 201
    except Exception as e:
        return jsonify({"error": f"Failed to load sample dataset: {str(e)}"}), 500

@dataset_bp.route("/<dataset_id>/profile", methods=["GET"])
def get_profile(dataset_id):
    dataset = database.get_dataset(dataset_id)
    if not dataset:
        return jsonify({"error": f"Dataset {dataset_id} not found."}), 404
        
    return jsonify({
        "dataset_id": dataset["id"],
        "original_name": dataset["original_name"],
        "row_count": dataset["row_count"],
        "col_count": dataset["col_count"],
        "file_size": dataset["file_size"],
        "created_at": dataset["created_at"],
        "profile": dataset.get("profile"),
        "metadata": dataset.get("metadata")
    }), 200

@dataset_bp.route("/<dataset_id>/preview", methods=["GET"])
def get_preview(dataset_id):
    limit = request.args.get("limit", default=Config.PREVIEW_ROWS, type=int)
    limit = min(max(limit, 5), 100)
    try:
        preview = get_dataset_preview(dataset_id, limit=limit)
        return jsonify(preview), 200
    except FileNotFoundError as fnf:
        return jsonify({"error": str(fnf)}), 404
    except Exception as e:
        return jsonify({"error": f"Failed to load preview: {str(e)}"}), 500

@dataset_bp.route("/<dataset_id>/metadata", methods=["PUT"])
def update_metadata(dataset_id):
    """
    Allow users to review inferred column types and correct them before training.
    """
    dataset = database.get_dataset(dataset_id)
    if not dataset:
        return jsonify({"error": f"Dataset {dataset_id} not found."}), 404
        
    body = request.get_json() or {}
    overrides = body.get("metadata")
    if not overrides:
        return jsonify({"error": "No metadata supplied in request body."}), 400
        
    try:
        database.update_dataset_metadata(dataset_id, overrides)
        return jsonify({
            "message": "Metadata successfully updated.",
            "metadata": overrides
        }), 200
    except Exception as e:
        return jsonify({"error": f"Failed to update metadata: {str(e)}"}), 500

@dataset_bp.route("", methods=["GET"])
def list_all_datasets():
    datasets = database.list_datasets()
    return jsonify({"datasets": datasets}), 200
