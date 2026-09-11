from enum import Enum
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel


# ============================================================
# MODEL NAMES
# ============================================================

class ModelName(str, Enum):
    arimax = "arimax"
    prophet = "prophet"
    lstm_oni = "lstm_oni"
    lstm_baseline = "lstm_baseline"


# ============================================================
# RESPONSE MODEL
# ============================================================

class ForecastResponse(BaseModel):
    model: str
    date: str
    predicted_food_inflation: float


router = APIRouter()


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent.parent

DATA_PATH = BASE_DIR / "data" / "processed" / "cpi_oni.csv"


MODEL_FILES = {
    "arimax": "arimax_predictions.csv",
    "prophet": "prophet_predictions.csv",
    "lstm_oni": "lstm_predictions.csv",
    "lstm_baseline": "lstm_baseline_predictions.csv",
}


# ============================================================
# LOAD MODEL PREDICTIONS
# ============================================================

def load_model_predictions(model_name: str) -> pd.DataFrame:

    if model_name not in MODEL_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model: {model_name}"
        )

    filename = MODEL_FILES[model_name]
    file_path = BASE_DIR / "data" / "processed" / filename

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"{filename} not found"
        )

    try:
        df = pd.read_csv(file_path)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not read {filename}: {str(exc)}"
        )

    # Prophet uses "ds"; convert it to the common "date" name
    if "date" not in df.columns and "ds" in df.columns:
        df = df.rename(columns={"ds": "date"})

    required_columns = {
        "date",
        "predicted_food_inflation"
    }

    missing_columns = required_columns - set(df.columns)

    if missing_columns:
        raise HTTPException(
            status_code=500,
            detail=(
                f"{filename} is missing required columns: "
                f"{sorted(missing_columns)}"
            )
        )

    # Clean date column
    df["date"] = pd.to_datetime(
        df["date"],
        errors="coerce"
    )

    # Clean prediction column
    df["predicted_food_inflation"] = pd.to_numeric(
        df["predicted_food_inflation"],
        errors="coerce"
    )

    # Remove completely invalid prediction rows
    df = df.dropna(
        subset=["date", "predicted_food_inflation"]
    ).copy()

    # Sort chronologically
    df = df.sort_values("date").reset_index(drop=True)

    if df.empty:
        raise HTTPException(
            status_code=500,
            detail=f"{filename} contains no valid prediction rows"
        )

    return df


# ============================================================
# GET LATEST VALID FORECAST
# ============================================================

def get_latest_prediction(model_name: str):

    df = load_model_predictions(model_name)

    latest = df.iloc[-1]

    forecast_date = latest["date"].strftime("%Y-%m-%d")

    prediction = float(
        latest["predicted_food_inflation"]
    )

    return {
        "model": model_name,
        "date": forecast_date,
        "predicted_food_inflation": prediction
    }


# ============================================================
# ALL PREDICTIONS
# ============================================================

@router.get("/predictions")
def get_predictions(
    model: Optional[ModelName] = None
):

    # Specific model
    if model is not None:

        model_name = model.value
        df = load_model_predictions(model_name)

        output_df = df.copy()

        output_df["date"] = (
            output_df["date"]
            .dt.strftime("%Y-%m-%d")
        )

        return {
            "model": model_name,
            "predictions": output_df.to_dict(
                orient="records"
            )
        }

    # All models
    predictions = {}

    for model_name in MODEL_FILES:

        df = load_model_predictions(model_name)

        output_df = df.copy()

        output_df["date"] = (
            output_df["date"]
            .dt.strftime("%Y-%m-%d")
        )

        predictions[model_name] = (
            output_df.to_dict(
                orient="records"
            )
        )

    return predictions


# ============================================================
# LATEST FORECAST FOR ALL MODELS
# ============================================================

@router.get("/forecast")
def get_forecast():

    forecasts = {}

    for model_name in MODEL_FILES:

        forecasts[model_name] = get_latest_prediction(
            model_name
        )

    return forecasts


# ============================================================
# LATEST FORECAST FOR ONE MODEL
# ============================================================

@router.get(
    "/forecast/{model_name}",
    response_model=ForecastResponse
)
def get_model_forecast(
    model_name: ModelName
):

    return get_latest_prediction(
        model_name.value
    )