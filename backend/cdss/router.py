"""CDSS API: HTE 예측, 예후 예측 (핵심 기능)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from auth.models import User
from auth.security import get_current_user
from patients.models import Patient
from cdss import features as feat
from cdss import hte, prognosis, schemas
from cdss.models import AuditLog, Prediction

router = APIRouter(prefix="/api/cdss", tags=["cdss"])


def _resolve_features(req: schemas.PredictRequest, db: Session) -> dict:
    """요청에 patient_id가 있으면 DB에서 환자를 꺼내 표준 feature 로 변환한다.

    feature 정의는 cdss.features(학습/서빙 공용)를 따른다. patient_id 없으면 직접 준 features 사용.
    """
    if req.patient_id is not None:
        patient = db.query(Patient).filter(Patient.id == req.patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="환자를 찾을 수 없습니다.")
        return feat.build_features(patient)
    return req.features


def _log_prediction(db, user, module, req, features, output):
    """예측 결과 + 접근 이력을 DB에 남긴다 (CDSS 운영 기록)."""
    db.add(Prediction(
        patient_id=req.patient_id,   # 정수 surrogate id (없으면 None)
        module=module,
        model_version=output.get("model_version"),
        input_features=features,
        output=output,
        created_by=user.username,
    ))
    db.add(AuditLog(
        username=user.username,
        action="predict",
        resource=f"{module}:{req.patient_id}" if req.patient_id is not None else module,
    ))
    db.commit()


@router.post("/hte", response_model=schemas.HTEResponse)
def predict_hte(
    req: schemas.PredictRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    features = _resolve_features(req, db)
    result = hte.predict_treatment_effect(features)
    _log_prediction(db, user, "hte", req, features, result)
    return result


@router.post("/prognosis", response_model=schemas.PrognosisResponse)
def predict_prognosis(
    req: schemas.PredictRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    features = _resolve_features(req, db)
    result = prognosis.predict_prognosis(features)
    _log_prediction(db, user, "prognosis", req, features, result)
    return result
