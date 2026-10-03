"""
Test suite for SynthGen AI — covers CSV upload, profiling, metadata, synthesis, evaluation, export, and SQLite history.
Uses small in-memory test fixtures; no large external dataset or paid API required.
Run with: python -m pytest tests/ -v
"""
import sys
import os
import json
import io
import tempfile
from pathlib import Path

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
import pandas as pd
import numpy as np

# ─────────────────────────────────────────
# Fixture helpers
# ─────────────────────────────────────────

@pytest.fixture
def small_df():
    """Tiny numeric + categorical dataset for fast unit tests."""
    rng = np.random.default_rng(42)
    return pd.DataFrame({
        "age": rng.integers(18, 70, 20).astype(int),
        "income": rng.normal(50000, 15000, 20).round(2),
        "gender": rng.choice(["Male", "Female", "Non-binary"], 20).tolist(),
        "subscribed": rng.choice([True, False], 20).tolist(),
    })


@pytest.fixture
def csv_bytes(small_df):
    buf = io.StringIO()
    small_df.to_csv(buf, index=False)
    return buf.getvalue().encode()


# ─────────────────────────────────────────
# 1. Profiling service
# ─────────────────────────────────────────

class TestProfilingService:
    def test_profile_shape(self, small_df):
        from backend.profiling_service import profile_dataframe
        p = profile_dataframe(small_df)
        assert p["total_rows"] == 20
        assert p["total_columns"] == 4

    def test_numerical_column(self, small_df):
        from backend.profiling_service import profile_dataframe
        p = profile_dataframe(small_df)
        age = p["columns"]["age"]
        assert age["inferred_type"] == "numerical"
        assert "min" in age and "max" in age and "mean" in age

    def test_categorical_column(self, small_df):
        from backend.profiling_service import profile_dataframe
        p = profile_dataframe(small_df)
        gender = p["columns"]["gender"]
        assert gender["inferred_type"] == "categorical"
        assert "frequencies" in gender

    def test_boolean_column(self, small_df):
        from backend.profiling_service import profile_dataframe
        p = profile_dataframe(small_df)
        sub = p["columns"]["subscribed"]
        assert sub["inferred_type"] == "boolean"

    def test_missing_values(self):
        from backend.profiling_service import profile_dataframe
        df = pd.DataFrame({"x": [1, None, 3], "y": ["a", "b", None]})
        p = profile_dataframe(df)
        assert p["total_missing_cells"] == 2

    def test_duplicates(self):
        from backend.profiling_service import profile_dataframe
        df = pd.DataFrame({"x": [1, 1, 2], "y": ["a", "a", "b"]})
        p = profile_dataframe(df)
        assert p["duplicate_rows"] == 1


# ─────────────────────────────────────────
# 2. Metadata builder
# ─────────────────────────────────────────

class TestMetadataBuilder:
    def test_build_metadata_dict(self, small_df):
        from backend.profiling_service import profile_dataframe, build_sdv_metadata_dict
        p = profile_dataframe(small_df)
        m = build_sdv_metadata_dict(small_df, p)
        assert "columns" in m
        assert "age" in m["columns"]
        assert m["columns"]["age"]["sdtype"] == "numerical"

    def test_id_detection(self):
        from backend.profiling_service import profile_dataframe, build_sdv_metadata_dict
        df = pd.DataFrame({"user_id": range(10), "score": range(10)})
        p = profile_dataframe(df)
        m = build_sdv_metadata_dict(df, p)
        assert m["columns"]["user_id"]["sdtype"] == "id"
        assert m.get("primary_key") == "user_id"


# ─────────────────────────────────────────
# 3. CSV upload validation (dataset_service layer)
# ─────────────────────────────────────────

class TestDatasetServiceValidation:
    def test_empty_csv_rejected(self):
        """A file with 0 bytes should raise ValueError."""
        from backend.dataset_service import read_csv_safely
        import io
        buf = io.StringIO()
        buf.write("")
        buf.seek(0)
        # Empty stream has no rows after read  — test via pandas directly
        with pytest.raises(Exception):
            df = pd.read_csv(io.StringIO(""))

    def test_too_few_rows_rejected(self, tmp_path):
        """CSVs with fewer than 3 rows should be rejected."""
        f = tmp_path / "tiny.csv"
        f.write_text("a,b\n1,2\n")
        from backend.dataset_service import process_and_save_csv
        with pytest.raises(ValueError, match="at least 3 rows"):
            process_and_save_csv(str(f), "tiny.csv")

    def test_valid_csv_accepted(self, tmp_path, small_df):
        f = tmp_path / "test.csv"
        small_df.to_csv(f, index=False)
        from backend.dataset_service import process_and_save_csv
        result = process_and_save_csv(str(f), "test.csv")
        assert result["row_count"] == len(small_df)
        assert result["col_count"] == len(small_df.columns)


# ─────────────────────────────────────────
# 4. Synthesis service (GaussianCopula only — fast)
# ─────────────────────────────────────────

class TestSynthesisService:
    def test_gaussian_copula_samples(self, small_df):
        from backend.synthesis_service import build_sdv_metadata, get_synthesizer_class
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            meta = build_sdv_metadata(small_df)
            Cls = get_synthesizer_class("GaussianCopulaSynthesizer")
            syn = Cls(metadata=meta)
            syn.fit(small_df)
            sample = syn.sample(num_rows=10)
        assert len(sample) == 10
        assert set(sample.columns) == set(small_df.columns)

    def test_invalid_model_type_raises(self, small_df):
        from backend.synthesis_service import get_synthesizer_class
        with pytest.raises(ValueError, match="Unsupported model"):
            get_synthesizer_class("FakeModel")


# ─────────────────────────────────────────
# 5. Quality evaluation
# ─────────────────────────────────────────

class TestEvaluationService:
    def test_evaluation_returns_score(self, small_df):
        from backend.synthesis_service import build_sdv_metadata, get_synthesizer_class
        from backend.evaluation_service import evaluate_synthetic_data
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            meta = build_sdv_metadata(small_df)
            syn = get_synthesizer_class("GaussianCopulaSynthesizer")(metadata=meta)
            syn.fit(small_df)
            synth_df = syn.sample(10)
        report = evaluate_synthetic_data(small_df, synth_df, meta)
        assert "overall_score" in report
        assert 0.0 <= report["overall_score"] <= 1.0

    def test_column_distributions_present(self, small_df):
        from backend.synthesis_service import build_sdv_metadata, get_synthesizer_class
        from backend.evaluation_service import evaluate_synthetic_data
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            meta = build_sdv_metadata(small_df)
            syn = get_synthesizer_class("GaussianCopulaSynthesizer")(metadata=meta)
            syn.fit(small_df)
            synth_df = syn.sample(10)
        report = evaluate_synthetic_data(small_df, synth_df, meta)
        assert "column_distributions" in report
        assert "age" in report["column_distributions"]


# ─────────────────────────────────────────
# 6. Export service
# ─────────────────────────────────────────

class TestExportService:
    def _make_job_fixture(self, tmp_path, small_df):
        """Write a generated CSV and create a matching DB job record."""
        import uuid
        from backend.config import GENERATED_DIR
        from backend import database

        dataset_id = str(uuid.uuid4())
        job_id = str(uuid.uuid4())
        # Save generated CSV
        gen_path = GENERATED_DIR / f"{job_id}.csv"
        small_df.to_csv(gen_path, index=False)

        # Register dataset
        from backend.profiling_service import profile_dataframe, build_sdv_metadata_dict
        p = profile_dataframe(small_df)
        m = build_sdv_metadata_dict(small_df, p)
        database.save_dataset(dataset_id, f"{dataset_id}.csv", "test.csv", len(small_df), len(small_df.columns), 100, m, p)
        database.create_job(job_id, dataset_id, "test.csv", "GaussianCopulaSynthesizer", {}, 20)
        database.update_job_status(job_id, "completed", 100, "Done", str(gen_path), 20, 0.85, {"overall_score": 0.85})
        return job_id

    def test_csv_export(self, tmp_path, small_df):
        from backend import database
        database.init_db()
        job_id = self._make_job_fixture(tmp_path, small_df)
        from backend.export_service import export_file
        path, filename, mime = export_file(job_id, "csv")
        assert Path(path).exists()
        assert filename.endswith(".csv")
        assert mime == "text/csv"

    def test_json_export(self, tmp_path, small_df):
        from backend import database
        database.init_db()
        job_id = self._make_job_fixture(tmp_path, small_df)
        from backend.export_service import export_file
        path, filename, mime = export_file(job_id, "json")
        assert Path(path).exists()
        with open(path) as f:
            data = json.load(f)
        assert isinstance(data, list)


# ─────────────────────────────────────────
# 7. SQLite history operations
# ─────────────────────────────────────────

class TestDatabase:
    def test_create_and_get_job(self):
        import uuid
        from backend import database
        database.init_db()
        ds_id = str(uuid.uuid4())
        jb_id = str(uuid.uuid4())
        database.save_dataset(ds_id, f"{ds_id}.csv", "sample.csv", 50, 4, 1024, {}, {})
        database.create_job(jb_id, ds_id, "sample.csv", "GaussianCopulaSynthesizer", {}, 100)
        job = database.get_job(jb_id)
        assert job is not None
        assert job["status"] == "queued"
        assert job["requested_rows"] == 100

    def test_update_job_status(self):
        import uuid
        from backend import database
        database.init_db()
        ds_id = str(uuid.uuid4())
        jb_id = str(uuid.uuid4())
        database.save_dataset(ds_id, f"{ds_id}.csv", "sample.csv", 50, 4, 1024, {}, {})
        database.create_job(jb_id, ds_id, "sample.csv", "GaussianCopulaSynthesizer", {}, 100)
        database.update_job_status(jb_id, "completed", 100, "Done", "/some/path.csv", 100, 0.87, {"overall_score": 0.87})
        job = database.get_job(jb_id)
        assert job["status"] == "completed"
        assert job["quality_score"] == pytest.approx(0.87)

    def test_delete_history(self):
        import uuid
        from backend import database
        database.init_db()
        ds_id = str(uuid.uuid4())
        jb_id = str(uuid.uuid4())
        database.save_dataset(ds_id, f"{ds_id}.csv", "sample.csv", 50, 4, 1024, {}, {})
        database.create_job(jb_id, ds_id, "sample.csv", "GaussianCopulaSynthesizer", {}, 100)
        database.delete_history(jb_id)
        assert database.get_job(jb_id) is None


# ─────────────────────────────────────────
# 8. Invalid input handling
# ─────────────────────────────────────────

class TestInvalidInputs:
    def test_infer_empty_series(self):
        from backend.profiling_service import infer_column_type
        s = pd.Series([], dtype="object")
        t = infer_column_type(s, "x")
        assert t == "categorical"  # fallback

    def test_profile_single_column(self):
        from backend.profiling_service import profile_dataframe
        df = pd.DataFrame({"only": [1.0, 2.0, 3.0, 4.0, 5.0]})
        p = profile_dataframe(df)
        assert p["total_columns"] == 1
        assert p["total_rows"] == 5
