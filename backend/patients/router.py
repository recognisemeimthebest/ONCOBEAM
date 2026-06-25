"""환자 데이터 API: 등록, 목록 조회, 단건 조회.

모든 엔드포인트는 로그인(get_current_user)을 요구한다 — 환자 정보는 민감하므로.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from auth.models import User
from auth.security import get_current_user
from patients import schemas
from patients.models import Patient

router = APIRouter(prefix="/api/patients", tags=["patients"])


@router.post("", response_model=schemas.PatientOut)
def create_patient(
    payload: schemas.PatientCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    patient = Patient(**payload.model_dump())
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


@router.get("", response_model=list[schemas.PatientOut])
def list_patients(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return db.query(Patient).all()


@router.get("/{patient_id}", response_model=schemas.PatientOut)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="환자를 찾을 수 없습니다.")
    return patient
