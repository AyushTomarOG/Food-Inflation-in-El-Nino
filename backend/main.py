from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.data import router as data_router
from routes.predictions import router as predictions_router
from routes.comparison import router as comparison_router

app = FastAPI(
    title="Food Inflation Forecasting API",
    description="Backend API for food inflation forecasting and model comparison",
    version="1.0.0"
)

app = FastAPI(
    title="Food Inflation Forecasting API",
    description="Backend API for food inflation forecasting and model comparison",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data_router)
app.include_router(predictions_router)
app.include_router(comparison_router)


@app.get("/")
def root():
    return {
        "message": "Food Inflation Forecasting API is running"
    }

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "Food Inflation Forecasting API"
    }