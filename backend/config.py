import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
STORAGE_DIR = PROJECT_ROOT / "storage"
UPLOAD_DIR = STORAGE_DIR / "uploads"
GENERATED_DIR = STORAGE_DIR / "generated"
REPORTS_DIR = STORAGE_DIR / "reports"
DATABASE_PATH = STORAGE_DIR / "synthgen.db"
SAMPLE_DATA_DIR = PROJECT_ROOT / "sample_data"

# Ensure directories exist
for directory in [STORAGE_DIR, UPLOAD_DIR, GENERATED_DIR, REPORTS_DIR, SAMPLE_DATA_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "synthgen-ai-secret-key-2026")
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB max upload
    ALLOWED_EXTENSIONS = {"csv"}
    
    # Dataset Limits
    MAX_ROWS_UPLOAD = 100_000
    MAX_ROWS_GENERATE = 50_000
    DEFAULT_GENERATION_ROWS = 200
    PREVIEW_ROWS = 20
    
    # Storage settings
    UPLOAD_FOLDER = str(UPLOAD_DIR)
    GENERATED_FOLDER = str(GENERATED_DIR)
    DATABASE_PATH = str(DATABASE_PATH)
    
    # Supported SDV models
    SUPPORTED_MODELS = {
        "GaussianCopulaSynthesizer": {
            "name": "Gaussian Copula",
            "type": "statistical",
            "description": "Fast classical multivariate copula model. Great for small-to-medium numerical & categorical datasets.",
            "default_params": {
                "default_distribution": "beta"
            }
        },
        "CTGANSynthesizer": {
            "name": "CTGAN (Conditional GAN)",
            "type": "deep_learning",
            "description": "Deep learning GAN architecture modeled for complex distributions and tabular columns.",
            "default_params": {
                "epochs": 100,
                "batch_size": 200,
                "verbose": False
            }
        },
        "TVAESynthesizer": {
            "name": "TVAE (Variational AutoEncoder)",
            "type": "deep_learning",
            "description": "Deep tabular variational autoencoder. Often trains faster than CTGAN with high fidelity.",
            "default_params": {
                "epochs": 100,
                "batch_size": 200
            }
        }
    }
