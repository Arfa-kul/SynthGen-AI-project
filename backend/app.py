import os
import sys
from pathlib import Path

# Add project root to sys.path so backend modules are discoverable
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from flask import Flask, jsonify
from flask_cors import CORS
from backend.config import Config
from backend.database import init_db
from backend.routes.dataset_routes import dataset_bp
from backend.routes.generation_routes import gen_bp
from backend.routes.history_routes import history_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Configure CORS for local development with frontend
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # Initialize SQLite database tables
    with app.app_context():
        init_db()
        
    # Register API blueprints
    app.register_blueprint(dataset_bp)
    app.register_blueprint(gen_bp)
    app.register_blueprint(history_bp)
    
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "healthy",
            "service": "SynthGen AI API",
            "version": "1.0.0",
            "sdv_installed": True
        }), 200

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Endpoint not found"}), 404

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": "Internal server error"}), 500

    return app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"[SynthGen AI] Starting backend on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
