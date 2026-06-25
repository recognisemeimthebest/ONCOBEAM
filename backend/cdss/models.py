"""CDSS 운영 테이블 — 예측 로그 / 모델 레지스트리 / 접근 감사.

서빙 계층에서 '예측을 실제로 운영'하기 위한 기록용 테이블들.
스키마는 Alembic 이 관리한다 (→ MIGRATIONS.md).
"""
from sqlalchemy import (Boolean, Column, DateTime, ForeignKey, Integer,
                        String, Text, func)
from sqlalchemy.types import JSON

from database import Base


class Prediction(Base):
    """모델 1회 예측 결과 기록 (이력·재현·시연 근거)."""
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    # API 요청의 patient_id 는 정수 surrogate id(patients.id) → 동일 기준으로 저장.
    patient_id = Column(Integer, ForeignKey("patients.id"),
                        nullable=True, index=True)   # 임의 features 예측이면 NULL
    module = Column(String(20), nullable=False, index=True)  # 'hte' / 'prognosis'
    model_version = Column(String(40), nullable=True)        # 어떤 pkl 버전이 냈는지
    input_features = Column(JSON, nullable=True)             # 입력 스냅샷
    output = Column(JSON, nullable=False)                    # 예측 결과(모듈별 구조 자유)
    created_by = Column(String(50), nullable=True)           # 호출 사용자
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class ModelRegistry(Base):
    """로드되는 외부 pkl 의 버전·입력명세·성능 메타 추적."""
    __tablename__ = "model_registry"

    id = Column(Integer, primary_key=True, index=True)
    module = Column(String(20), nullable=False)              # 'hte' / 'prognosis'
    version = Column(String(40), nullable=False)
    filename = Column(String(200), nullable=False)           # ml_models/ 내 파일명
    input_spec = Column(JSON, nullable=True)                 # feature 이름·순서·인코딩
    metrics = Column(JSON, nullable=True)                    # 외부 검증 지표(AUC 등)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=False)               # 현재 서빙 중 버전
    registered_at = Column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    """민감정보 접근/행위 감사 로그 (역할기반 + IRB 관점)."""
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), nullable=True, index=True)
    action = Column(String(40), nullable=False)              # login/view_patient/predict ...
    resource = Column(String(200), nullable=True)            # patient_id, endpoint 등
    detail = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
