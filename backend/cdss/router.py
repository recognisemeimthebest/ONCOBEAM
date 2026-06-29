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


# ── AI 권고 수락/기각 (closed-loop + 감사기록) ───────────────────────────────
@router.post("/decision")
def record_decision(
    req: schemas.DecisionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """의료인이 AI 권고를 수락/기각한 결정을 audit_log 에 남긴다.

    EMR 인증 감사기준: 사용자·일시·수행업무·사유. 기각은 사유 필수(식약처: 최종 책임 의료인).
    """
    if req.action not in ("accept", "override"):
        raise HTTPException(status_code=400, detail="action 은 accept/override 만 허용합니다.")
    if req.action == "override" and not (req.reason and req.reason.strip()):
        raise HTTPException(status_code=400, detail="기각(override) 시 사유 입력은 필수입니다.")

    log = AuditLog(
        username=user.username,
        action="cdss_decision",
        resource=f"patient:{req.patient_id}",
        detail=req.model_dump(),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return {
        "id": log.id, "username": log.username, "action": req.action,
        "patient_id": req.patient_id, "reason": req.reason,
        "created_at": log.created_at,
    }


@router.get("/decisions")
def list_decisions(
    limit: int = 100,
    patient_id: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """AI 권고 수락/기각 결정 이력 (감사 추적). patient_id 주면 해당 환자만."""
    q = db.query(AuditLog).filter(AuditLog.action == "cdss_decision")
    if patient_id:
        q = q.filter(AuditLog.resource == f"patient:{patient_id}")
    rows = q.order_by(AuditLog.created_at.desc()).limit(min(limit, 500)).all()
    items = []
    for r in rows:
        d = r.detail or {}
        items.append({
            "id": r.id, "username": r.username, "created_at": r.created_at,
            "patient_id": (r.resource or "").replace("patient:", ""),
            "action": d.get("action"),
            "recommended_label": d.get("recommended_label"),
            "chosen_label": d.get("chosen_label"),
            "reason": d.get("reason"),
            "risk_tier": d.get("risk_tier"),
        })
    return {"items": items, "count": len(items)}


@router.get("/decision/{patient_id}")
def latest_decision(
    patient_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """해당 환자의 가장 최근 결정(있으면) — 배너에 '결정됨' 표시용."""
    log = (
        db.query(AuditLog)
        .filter(AuditLog.action == "cdss_decision",
                AuditLog.resource == f"patient:{patient_id}")
        .order_by(AuditLog.created_at.desc())
        .first()
    )
    if not log:
        return {"decision": None}
    d = log.detail or {}
    return {"decision": {
        "id": log.id, "username": log.username,
        "action": d.get("action"), "reason": d.get("reason"),
        "chosen_label": d.get("chosen_label"),
        "recommended_label": d.get("recommended_label"),
        "created_at": log.created_at,
    }}
