import time
import os
import random
import numpy as np
import pandas as pd
from pathlib import Path
import warnings

from backend.config import Config, GENERATED_DIR
from backend import database


def get_synthesizer_class(model_type):
    from sdv.single_table import GaussianCopulaSynthesizer, CTGANSynthesizer, TVAESynthesizer
    registry = {
        "GaussianCopulaSynthesizer": GaussianCopulaSynthesizer,
        "CTGANSynthesizer": CTGANSynthesizer,
        "TVAESynthesizer": TVAESynthesizer,
    }
    if model_type not in registry:
        raise ValueError(f"Unsupported model '{model_type}'. Choose from: {list(registry.keys())}")
    return registry[model_type]


def build_sdv_metadata(df, user_overrides=None):
    """
    Build an SDV Metadata object from a DataFrame.
    Uses the new sdv.metadata.Metadata class (not the deprecated SingleTableMetadata).
    """
    from sdv.metadata import Metadata

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        metadata = Metadata.detect_from_dataframe(data=df)

    TABLE_NAME = "table"  # default table name used by Metadata.detect_from_dataframe

    if user_overrides:
        columns_meta = user_overrides.get("columns", {})
        for col_name, col_cfg in columns_meta.items():
            if col_name in df.columns:
                target_sdtype = col_cfg.get("sdtype")
                if target_sdtype:
                    try:
                        metadata.update_column(
                            table_name=TABLE_NAME,
                            column_name=col_name,
                            sdtype=target_sdtype,
                        )
                    except Exception:
                        pass

        primary_key = user_overrides.get("primary_key")
        if primary_key and primary_key in df.columns:
            try:
                metadata.set_primary_key(table_name=TABLE_NAME, column_name=primary_key)
            except Exception:
                pass

    return metadata


def train_and_generate(dataset_id, model_type, model_params, requested_rows, job_id, progress_callback=None):
    """
    Full SDV training + sampling pipeline executed in a background thread.
    """
    from backend.dataset_service import get_dataset_df
    from backend.evaluation_service import evaluate_synthetic_data

    # 1. Load dataset
    if progress_callback:
        progress_callback(10, "Loading original dataset and validating structure…")

    df, dataset_record = get_dataset_df(dataset_id)
    user_metadata = dataset_record.get("metadata")

    # 2. Build SDV metadata object
    if progress_callback:
        progress_callback(25, "Detecting and building SDV metadata schema…")

    metadata = build_sdv_metadata(df, user_metadata)

    # 3. Random seed
    random_seed = model_params.get("random_seed")
    if random_seed is not None and str(random_seed).strip() != "":
        try:
            seed_val = int(random_seed)
            random.seed(seed_val)
            np.random.seed(seed_val)
            try:
                import torch
                torch.manual_seed(seed_val)
            except ImportError:
                pass
        except (ValueError, TypeError):
            pass

    # 4. Instantiate synthesizer
    if progress_callback:
        progress_callback(40, f"Initializing {model_type}…")

    SynthesizerCls = get_synthesizer_class(model_type)
    kwargs = {"metadata": metadata}

    if model_type == "GaussianCopulaSynthesizer":
        kwargs["default_distribution"] = model_params.get("default_distribution", "beta")
    elif model_type in ("CTGANSynthesizer", "TVAESynthesizer"):
        epochs = max(10, int(model_params.get("epochs", 100)))
        batch_size = int(model_params.get("batch_size", 200))
        batch_size = min(batch_size, max(10, len(df)))
        kwargs["epochs"] = epochs
        kwargs["batch_size"] = batch_size
        if model_type == "CTGANSynthesizer":
            kwargs["verbose"] = False

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        synthesizer = SynthesizerCls(**kwargs)

    # 5. Train
    if progress_callback:
        progress_callback(55, f"Training {model_type} on {len(df)} rows. Learning distributions & correlations…")

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        synthesizer.fit(df)

    # 6. Sample
    if progress_callback:
        progress_callback(75, f"Sampling {requested_rows} synthetic rows from the learned model…")

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        synthetic_df = synthesizer.sample(num_rows=requested_rows)

    # 7. Save to disk
    output_path = GENERATED_DIR / f"{job_id}.csv"
    synthetic_df.to_csv(output_path, index=False)

    # 8. Evaluate quality
    if progress_callback:
        progress_callback(87, "Running SDV quality evaluation — computing fidelity scores…")

    quality_report = evaluate_synthetic_data(df, synthetic_df, metadata)

    if progress_callback:
        progress_callback(100, "Synthesis and evaluation completed successfully!")

    return {
        "job_id": job_id,
        "dataset_id": dataset_id,
        "model_type": model_type,
        "requested_rows": requested_rows,
        "generated_rows": len(synthetic_df),
        "generated_file_path": str(output_path),
        "quality_score": quality_report.get("overall_score", 0.0),
        "quality_report": quality_report,
    }
