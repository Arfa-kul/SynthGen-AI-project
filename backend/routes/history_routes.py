from flask import Blueprint, jsonify
from pathlib import Path
from backend import database

history_bp = Blueprint("history", __name__, url_prefix="/api/history")

@history_bp.route("", methods=["GET"])
def get_history_list():
    try:
        jobs = database.get_history(limit=100)
        return jsonify({"history": jobs}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve history: {str(e)}"}), 500

@history_bp.route("/<job_id>", methods=["DELETE"])
def delete_history_item(job_id):
    try:
        deleted_file_path = database.delete_history(job_id)
        # Remove file from disk if present
        if deleted_file_path:
            p = Path(deleted_file_path)
            if p.exists():
                try:
                    p.unlink()
                except Exception:
                    pass
        return jsonify({"message": f"Job {job_id} and its associated generated artifacts have been removed."}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to delete history item: {str(e)}"}), 500
