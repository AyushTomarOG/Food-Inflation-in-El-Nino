from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent.parent

COMPARISON_PATH = (
    BASE_DIR / "data" / "processed" / "model_comparison.csv"
)


class ModelMetrics(BaseModel):
    Model: str
    MAE: float
    RMSE: float
    sMAPE: float
    MASE: float


class ComparisonResponse(BaseModel):
    test_period: str
    metrics: list[ModelMetrics]


@router.get(
    "/comparison",
    response_model=ComparisonResponse
)
def get_comparison():

    if not COMPARISON_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Model comparison results not found"
        )

    df = pd.read_csv(COMPARISON_PATH)

    # Rename CSV column so it matches the API model
    df = df.rename(columns={
        "sMAPE (%)": "sMAPE"
    })

    return {
        "test_period": "January 2024 - December 2025",
        "metrics": df.to_dict(orient="records")
    }