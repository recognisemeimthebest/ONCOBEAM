"""CDSS 예측 요청/응답 형태."""
from typing import Optional

from pydantic import BaseModel


class PredictRequest(BaseModel):
    """직접 특성을 넣거나(features), 저장된 환자 id를 참조할 수 있다."""
    patient_id: Optional[int] = None
    features: dict = {}  # 예: {"age": 60, "biomarker": 3.2}


class HTEResponse(BaseModel):
    treatment_effect: float
    recommendation: str
    model_loaded: bool


class PrognosisResponse(BaseModel):
    risk_score: float
    survival_6m: Optional[float] = None
    model_loaded: bool
