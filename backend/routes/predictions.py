from enum import Enum
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

class ModelName(str, Enum):
    arimax = "arimax"
    prophet = "prophet"
    lstm_oni = "lstm_oni"
    lstm_baseline = "lstm_baseline"

class ForecastResponse(BaseModel):
    model: str
    date: str
    predicted_food_inflation: float

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent.parent

DATA_PATH = BASE_DIR / "data" / "processed" / "cpi_oni.csv"


MODEL_FILES = {
    "arimax": "arimax_predictions.csv",
    "prophet": "prophet_predictions.csv",
    "lstm_oni": "lstm_predictions.csv",
    "lstm_baseline": "lstm_baseline_predictions.csv"
}


def load_model_predictions(model_name: str):
    filename = MODEL_FILES[model_name]
    file_path = BASE_DIR / "data" / "processed" / filename

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"{filename} not found"
        )

    return pd.read_csv(file_path)


@router.get("/predictions")
def get_predictions(model: Optional[ModelName] = None):

    if model is not None:
        model_name = model.value

        df = load_model_predictions(model_name)

        return {
            "model": model_name,
            "predictions": df.to_dict(orient="records")
        }

    predictions = {}

    for model_name in MODEL_FILES:
        df = load_model_predictions(model_name)

        predictions[model_name] = df.to_dict(
            orient="records"
        )

    return predictions


@router.get("/forecast")
def get_forecast():

    forecasts = {}

    # Load processed data to determine the latest available date
    if not DATA_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Processed dataset not found"
        )

    data_df = pd.read_csv(DATA_PATH)

    data_df["date"] = pd.to_datetime(data_df["date"])

    latest_date = (
        data_df["date"]
        .max()
        .strftime("%Y-%m-%d")
    )

    for model_name in MODEL_FILES:

        df = load_model_predictions(model_name)

        latest = df.iloc[-1]

        if model_name == "arimax":
            forecast_date = latest_date

        elif "date" in df.columns:
            forecast_date = pd.to_datetime(
                latest["date"]
            ).strftime("%Y-%m-%d")

        elif "ds" in df.columns:
            forecast_date = pd.to_datetime(
                latest["ds"]
            ).strftime("%Y-%m-%d")

        else:
            forecast_date = latest_date

        forecasts[model_name] = {
            "date": forecast_date,
            "predicted_food_inflation": float(
                latest["predicted_food_inflation"]
            )
        }

    return forecasts

@router.get("/forecast/{model_name}",response_model=ForecastResponse)
def get_model_forecast(model_name: ModelName):

    model = model_name.value

    df = load_model_predictions(model)

    latest = df.iloc[-1]

    # Get latest available date
    if not DATA_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Processed dataset not found"
        )

    data_df = pd.read_csv(DATA_PATH)

    data_df["date"] = pd.to_datetime(
        data_df["date"]
    )

    latest_date = (
        data_df["date"]
        .max()
        .strftime("%Y-%m-%d")
    )

    if model == "arimax":
        forecast_date = latest_date

    elif "date" in df.columns:
        forecast_date = pd.to_datetime(
            latest["date"]
        ).strftime("%Y-%m-%d")

    elif "ds" in df.columns:
        forecast_date = pd.to_datetime(
            latest["ds"]
        ).strftime("%Y-%m-%d")

    else:
        forecast_date = latest_date

    return {
        "model": model,
        "date": forecast_date,
        "predicted_food_inflation": float(
            latest["predicted_food_inflation"]
        )
    }