"""환자 관련 요청/응답 데이터 형태 — 38항목 임상 스키마."""
from datetime import date
from typing import Optional

from pydantic import BaseModel


class PatientBase(BaseModel):
    patient_id: str

    # 조직병리
    classification_cancer: Optional[int] = None
    surgical_cancer: Optional[str] = None
    surgical_cancer_t: Optional[str] = None
    surgical_cancer_n: Optional[str] = None
    surgical_cancer_m: Optional[str] = None
    boundary_surgical: Optional[int] = None
    involmentrenal: Optional[bool] = None
    lymphrenal: Optional[bool] = None

    # 치료
    surgicalmethod: Optional[str] = None
    antidrug: Optional[str] = None
    totaldose: Optional[int] = None
    radiationcnt: Optional[int] = None
    radiationperdose: Optional[float] = None
    treatmethod: Optional[int] = None
    treatech: Optional[int] = None

    # 인구통계/병력
    sex: Optional[str] = None
    birth_date: Optional[str] = None
    height: Optional[int] = None
    weight: Optional[int] = None
    diagnosis: Optional[str] = None
    bp: Optional[str] = None
    bs: Optional[str] = None
    sm: Optional[str] = None
    familyhistory: Optional[str] = None
    locationcancer: Optional[int] = None

    # 영상/임상 병기
    cancerimaging: Optional[str] = None
    cancerimaging_t: Optional[str] = None
    cancerimaging_n: Optional[str] = None
    cancerimaging_m: Optional[str] = None

    # 일자/예후
    initialdate: Optional[date] = None
    treatedate: Optional[date] = None
    relapse: Optional[int] = None
    relapsedate: Optional[date] = None
    dead: Optional[int] = None
    deathdate: Optional[date] = None
    deathsign: Optional[int] = None
    lastdate: Optional[date] = None


class PatientCreate(PatientBase):
    pass


class PatientOut(PatientBase):
    id: int

    class Config:
        from_attributes = True
