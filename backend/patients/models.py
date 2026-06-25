"""환자(Patient) 테이블 정의 — 아주대 암환자 방사선치료 데이터 정형 스키마(38항목).

데이터설명서_1-025-071 의 '임상지표 공통 정형데이터' + '검사 및 치료 등 정형데이터'를 따른다.
- 자연키(patient_id, 예: QIN-HEADNECK-01-0003)는 unique 로 두고, ORM/라우트 호환을 위해
  정수 surrogate PK(id)를 유지한다.
- 데이터에 결측이 많아 임상 컬럼은 모두 nullable.
- [추후입력] 표시 컬럼(classification_cancer, surgical_cancer_t/n/m, bp, familyhistory)은
  DB 담당자가 나중에 채울 예정 → 지금은 NULL.
"""
from sqlalchemy import (Boolean, Column, Date, Float, ForeignKey, Integer,
                        String, Text)
from sqlalchemy.types import JSON

from database import Base


class Patient(Base):
    __tablename__ = "patients"

    # surrogate PK + 자연키
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String(32), unique=True, index=True, nullable=False)  # 대상자ID

    # ---------- 조직병리 데이터 ----------
    classification_cancer = Column(Integer, nullable=True)   # 조직학적 분류 1편평/2선/3기타 [추후입력]
    surgical_cancer = Column(String(10), nullable=True)      # 수술적 병기
    surgical_cancer_t = Column(String(10), nullable=True)    # 수술적 T병기 [추후입력]
    surgical_cancer_n = Column(String(10), nullable=True)    # 수술적 N병기 [추후입력]
    surgical_cancer_m = Column(String(10), nullable=True)    # 수술적 M병기 [추후입력]
    boundary_surgical = Column(Integer, nullable=True)       # 수술부위 경계 1완전절제/2비완전절제
    involmentrenal = Column(Boolean, nullable=True)          # 신경(주위) 침범 유무
    lymphrenal = Column(Boolean, nullable=True)              # 림프절 침윤 범위

    # ---------- 치료 데이터 ----------
    surgicalmethod = Column(Text, nullable=True)             # 수술방법(서술형)
    antidrug = Column(Text, nullable=True)                   # 항암치료 약제(서술형)
    totaldose = Column(Integer, nullable=True)               # 방사선 치료 총선량
    radiationcnt = Column(Integer, nullable=True)            # 방사선 치료 횟수
    radiationperdose = Column(Float, nullable=True)          # 방사선 회당 치료 선량
    treatmethod = Column(Integer, nullable=True)             # 치료 방법 1~8
    treatech = Column(Integer, nullable=True)                # 치료 기법 1conformal/2IMRT/3기타

    # ---------- 임상지표 공통 (인구통계/병력) ----------
    sex = Column(String(1), nullable=True)                   # M/F
    birth_date = Column(String(6), nullable=True)            # 생년월 YYYYMM (월은 가상 01)
    height = Column(Integer, nullable=True)                  # 신장(cm)
    weight = Column(Integer, nullable=True)                  # 체중(kg)
    diagnosis = Column(String(200), nullable=True)           # 진단명(서술형)
    bp = Column(String(1), nullable=True)                    # 고혈압 Y/N [추후입력]
    bs = Column(String(1), nullable=True)                    # 당뇨 Y/N
    sm = Column(String(1), nullable=True)                    # 흡연 Y/N
    familyhistory = Column(String(1), nullable=True)         # 가족력 Y/N [추후입력]
    locationcancer = Column(Integer, nullable=True)          # 원발암 위치 1직장/2전립선/3여성/4두경부/9기타

    # ---------- 영상/임상 병기 ----------
    cancerimaging = Column(String(10), nullable=True)        # 암영상 병기
    cancerimaging_t = Column(String(10), nullable=True)      # 암영상 T병기
    cancerimaging_n = Column(String(10), nullable=True)      # 암영상 N병기
    cancerimaging_m = Column(String(10), nullable=True)      # 암영상 M병기

    # ---------- 치료 일자 / 예후 ----------
    initialdate = Column(Date, nullable=True)                # 치료 시작일
    treatedate = Column(Date, nullable=True)                 # 치료 종료일
    relapse = Column(Integer, nullable=True)                 # 재발 1안함/2국소/3원격
    relapsedate = Column(Date, nullable=True)                # 재발 진단일
    dead = Column(Integer, nullable=True)                    # 사망 0없음/1있음
    deathdate = Column(Date, nullable=True)                  # 사망일
    deathsign = Column(Integer, nullable=True)               # 사망사인 1암/2암이외
    lastdate = Column(Date, nullable=True)                   # 마지막 병원 방문일


class RadiomicsFeature(Base):
    """CBCT 라디오믹스 피처 (모듈2 입력). 설계: cdss/RADIOMICS_FUSION.md

    피처셋이 넓고 가변적이라 patients 에 컬럼으로 붙이지 않고 JSONB 로 보관한다.
    한 환자에 집약정책(source)·피처셋버전(version)별로 여러 레코드 공존 가능.
    """
    __tablename__ = "radiomics_features"

    patient_id = Column(String(32), ForeignKey("patients.patient_id"),
                        primary_key=True)                    # 조인 키
    source = Column(String(20), primary_key=True, default="baseline")  # baseline/mean/delta
    version = Column(String(40), primary_key=True, default="v1")       # 추출설정 버전
    features = Column(JSON, nullable=False)                  # {"original_shape_...": 1.23, ...}
