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


class DecisionRequest(BaseModel):
    """의료인의 AI 권고 수락/기각 결정 (closed-loop, 감사기록용).

    식약처: CDSS는 보조도구 → 최종 결정은 의료인.
    EMR 인증 감사기준: 사용자·일시·수행업무·사유 기록.
    """
    patient_id: str                      # 환자 자연키(QIN-HEADNECK-...)
    action: str                          # 'accept' | 'override'
    recommended_arm: Optional[int] = None
    recommended_label: Optional[str] = None
    chosen_arm: Optional[int] = None
    chosen_label: Optional[str] = None
    reason: Optional[str] = None         # 기각 시 필수
    risk_tier: Optional[str] = None
    risk_prob: Optional[float] = None
    headline: Optional[str] = None
