from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_PATH = BASE_DIR / "data" / "processed" / "cpi_oni.csv"


@router.get("/data")
def get_data():
    if not DATA_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Processed dataset not found"
        )

    df = pd.read_csv(DATA_PATH)

    return df.to_dict(orient="records")