import pandas as pd


def infer_column_type(series, col_name=""):
    clean = series.dropna()
    total = len(series)
    n = len(clean)

    if n == 0:
        return "categorical"

    col_lower = str(col_name).lower()
    is_id_name = any(t in col_lower for t in ["_id", " id", "uuid", "identifier", "code", "key"])
    if is_id_name and clean.nunique() == n and n > 5:
        return "id"

    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if clean.nunique() <= 2:
        val_set = {str(x).strip().lower() for x in clean.unique()}
        if val_set.issubset({"true", "false", "0", "1", "yes", "no", "y", "n", "t", "f"}):
            return "boolean"

    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    if series.dtype == "object":
        sample = clean.head(20)
        strs = [str(x) for x in sample]
        if any(("-" in s or "/" in s or ":" in s) for s in strs):
            try:
                parsed = pd.to_datetime(sample, errors="coerce")
                if parsed.notna().sum() >= len(sample) * 0.8:
                    return "datetime"
            except Exception:
                pass

    if pd.api.types.is_numeric_dtype(series):
        return "numerical"

    try:
        pd.to_numeric(clean.head(50), errors="raise")
        return "numerical"
    except Exception:
        pass

    return "categorical"


def profile_dataframe(df):
    import numpy as np

    nrows, ncols = df.shape
    dup_rows = int(df.duplicated().sum())
    total_cells = nrows * ncols
    total_missing = int(df.isna().sum().sum())
    type_counts = {"numerical": 0, "categorical": 0, "boolean": 0, "datetime": 0, "id": 0}
    cols_profile = {}

    for col in df.columns:
        series = df[col]
        itype = infer_column_type(series, col)
        type_counts[itype] = type_counts.get(itype, 0) + 1

        non_null = int(series.notna().sum())
        missing = int(series.isna().sum())
        missing_pct = round(missing / nrows * 100, 2) if nrows else 0
        unique = int(series.nunique(dropna=True))
        clean_s = series.dropna()

        info = {
            "name": col,
            "inferred_type": itype,
            "sdv_type": "id" if itype == "id" else (
                "datetime" if itype == "datetime" else (
                    "boolean" if itype == "boolean" else (
                        "numerical" if itype == "numerical" else "categorical"
                    )
                )
            ),
            "non_null_count": non_null,
            "missing_count": missing,
            "missing_pct": missing_pct,
            "unique_count": unique,
            "sample_values": [str(x) for x in clean_s.head(5).tolist()],
        }

        if itype == "numerical":
            num_s = pd.to_numeric(clean_s, errors="coerce").dropna()
            if len(num_s) > 0:
                info["min"] = float(round(num_s.min(), 4))
                info["max"] = float(round(num_s.max(), 4))
                info["mean"] = float(round(num_s.mean(), 4))
                info["median"] = float(round(num_s.median(), 4))
                info["std"] = float(round(num_s.std(), 4)) if len(num_s) > 1 else 0.0
                try:
                    n_bins = min(10, max(3, num_s.nunique()))
                    counts, edges = np.histogram(num_s, bins=n_bins)
                    info["histogram"] = [
                        {
                            "range": f"{round(edges[i], 2)}–{round(edges[i+1], 2)}",
                            "bin_start": float(round(edges[i], 2)),
                            "bin_end": float(round(edges[i+1], 2)),
                            "count": int(counts[i]),
                            "percentage": round(int(counts[i]) / len(num_s) * 100, 2),
                        }
                        for i in range(len(counts))
                    ]
                except Exception:
                    info["histogram"] = []

        elif itype in ("categorical", "boolean", "id"):
            vc = clean_s.value_counts().head(10)
            info["frequencies"] = [
                {
                    "value": str(v),
                    "count": int(cnt),
                    "percentage": round(cnt / non_null * 100, 2) if non_null else 0,
                }
                for v, cnt in vc.items()
            ]

        elif itype == "datetime":
            dt_s = pd.to_datetime(clean_s, errors="coerce").dropna()
            if len(dt_s):
                info["min_date"] = str(dt_s.min())
                info["max_date"] = str(dt_s.max())

        cols_profile[col] = info

    return {
        "total_rows": nrows,
        "total_columns": ncols,
        "duplicate_rows": dup_rows,
        "duplicate_pct": round(dup_rows / nrows * 100, 2) if nrows else 0,
        "total_missing_cells": total_missing,
        "missing_pct_overall": round(total_missing / total_cells * 100, 2) if total_cells else 0,
        "type_counts": type_counts,
        "columns": cols_profile,
    }


def build_sdv_metadata_dict(df, profile):
    """
    Build a plain Python dict describing column sdtypes.
    This dict is stored in DB and later passed to build_sdv_metadata() in synthesis_service.
    """
    columns_meta = {}
    primary_key = None

    for col_name, info in profile.get("columns", {}).items():
        stype = info.get("sdv_type", "categorical")
        if stype == "id" and primary_key is None:
            if info.get("unique_count") == len(df):
                primary_key = col_name
                columns_meta[col_name] = {"sdtype": "id"}
                continue
        if stype == "numerical":
            columns_meta[col_name] = {"sdtype": "numerical"}
        elif stype == "boolean":
            columns_meta[col_name] = {"sdtype": "boolean"}
        elif stype == "datetime":
            columns_meta[col_name] = {"sdtype": "datetime"}
        else:
            columns_meta[col_name] = {"sdtype": "categorical"}

    meta = {"columns": columns_meta}
    if primary_key:
        meta["primary_key"] = primary_key
    return meta
