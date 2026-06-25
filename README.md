# CDSS — 두경부암 방사선치료 임상의사결정 지원

**구조:** React(프론트) + FastAPI(모놀리식 백엔드) + PostgreSQL
**핵심 모델 2종:**
- **모듈1 — HTE**: 처치군(treatmethod 4종) 간 처치효과 비교 (1v2·3v4·1v3·2v4)
- **모듈2 — 예후예측**: 임상변수 + 라디오믹스 → 5년 무재발생존 이진예측

데이터: QIN-HEADNECK 두경부암 278명(아주대 데이터설명서 38컬럼 스키마).
⚠️ 6개 컬럼(classification_cancer, surgical_cancer_t/n/m, bp, familyhistory)은 실데이터 확보 불가로
**합성(가상)값**이며 이게 최종값이다. 무작위 비율 배정이라 결과와 실제 상관이 없다(모델에선 잡음).
CSV 재생성 시:  `scripts/transform_clinical_to_schema.py` → `backend/fill_deferred_columns.py` → `backend/load_csv_to_db.py` (CSV는 `data/clinical/`).

```
Final _project/
├─ backend/              # FastAPI 모놀리식 백엔드 (:8000)
│  ├─ main.py            # 앱 시작점 (스키마는 Alembic 관리)
│  ├─ config.py / .env   # 설정 (DB 주소 등)
│  ├─ database.py        # DB 연결
│  ├─ alembic/           # 마이그레이션 (→ MIGRATIONS.md)
│  ├─ auth/              # 로그인 / JWT / 권한
│  ├─ patients/          # 환자·라디오믹스 테이블 + CRUD
│  ├─ cdss/              # 베이스라인 HTE+예후 (features.py = 학습·서빙 공용 정의)
│  ├─ ml_models/         # 베이스라인 모델(.joblib)
│  ├─ load_csv_to_db.py  # CSV → DB 적재
│  └─ tests/             # pytest
├─ model_service/        # 실모델 서빙 (:8011, cdss_ml env) — causalforest·xgb·shap
│  ├─ app.py             # FastAPI: /active_patients, /predict
│  ├─ models/            # 학습 산출물 pkl 3종
│  ├─ seed_radiomics.py  # 데모용 라디오믹스 적재(생존자 20명)
│  └─ run.sh
├─ frontend/             # React/Vite EMR UI (:5173)
├─ ml_training/          # 모델 학습/평가 (서빙과 분리)
│  └─ sources/           # 실모델 pkl 학습 원코드(HTE phase·XGB)
├─ data/
│  ├─ clinical/          # 임상 엑셀 · 38컬럼 CSV · 데이터설명서 PDF
│  ├─ CT/                # SegRap2023·RADCURE 영상 분할 데이터셋(zip)
│  └─ images/            # 샘플 영상(CHGJ013_pt.nii)
├─ scripts/              # transform_clinical_to_schema.py · data_download.py
└─ docs/                 # 프로젝트 요약 등
```

## 0. 사전 준비 (conda 환경 + PostgreSQL)

이 머신은 root/docker 권한이 없어 **conda 사용자 공간**에 PostgreSQL을 운영한다.

```bash
source ~/miniconda3/etc/profile.d/conda.sh && conda activate cdss
# PostgreSQL 기동 (재부팅 후 매번)
pg_ctl -D ~/cdss_pgdata -l ~/cdss_pg.log -o "-p 5432" start   # 중지: ... stop
```
접속 주소는 `backend/.env` 의 `database_url` (기본 `postgresql+psycopg2://cdss:cdss@localhost:5432/cdss`).

## 1. 백엔드 실행

```bash
cd backend
# 의존성: pip install -r requirements.txt  (이미 cdss 환경에 설치됨)
alembic upgrade head          # 스키마 생성/최신화
python load_csv_to_db.py      # 임상 278명 적재 (멱등; CSV에 6컬럼 합성값 포함)
uvicorn main:app --reload
```
- API 문서: http://localhost:8000/docs   ·   헬스체크: http://localhost:8000/api/health
- 첫 계정: `/docs` 에서 `POST /api/auth/register`

## 2. 실모델 서비스 실행 (causalforest · xgb · shap)

EMR 팝업(모듈1 HTE·모듈2 예후)이 호출하는 실모델 서버. **별도 conda 환경 `cdss_ml`**(py3.11, scikit-learn 1.3.2 + econml·xgboost·shap)에서 돈다.

```bash
cd model_service
python seed_radiomics.py          # (최초 1회) 생존 환자 20명에 데모 라디오믹스 적재
./run.sh                          # uvicorn :8011  (= cdss_ml env)
```
- 헬스: http://localhost:8011/health  ·  활성환자: `/active_patients`
- ⚠️ 라디오믹스 실값 미확보 → `radiomics_features(source=random_demo)`의 **무작위 자리표시자**. 향후 PACS 자동 종양탐지→ROI 라디오믹스 추출로 교체 예정. 영상 배정된 20명만 EMR 노출(사망자 제외).

## 3. 프론트엔드 실행

```bash
cd frontend && npm install && npm run dev     # http://localhost:5173  (데모 로그인 doctor/cdss1234)
```

## 4. 베이스라인 모델 학습 / 평가

```bash
cd ml_training
python train_prognosis.py     # 예후 Cox → ml_models/prognosis_model.joblib
python train_hte.py           # HTE T-learner → ml_models/hte_model.joblib
python evaluate.py            # 교차검증 지표(정직한 일반화 성능)
```
모델 파일이 없으면 백엔드는 **더미 예측값**을 반환하므로 모델 없이도 전체 흐름이 동작한다.

현재 베이스라인(5-fold CV): 예후 Cox **C-index ≈ 0.64**, HTE 결과모델 **AUC ≈ 0.69**.

## 5. 테스트

```bash
cd backend && python -m pytest tests/ -q
```

## 기동 순서 요약

PG(`pg_ctl ... start`) → 백엔드(`backend/` uvicorn :8000) → 실모델 서비스(`model_service/run.sh` :8011) → 프론트(`frontend/` npm run dev :5173).

## 현재 상태 / 다음 할 일

- ✅ DB(PostgreSQL)·38컬럼·278명·Alembic·인증·EMR UI·**실모델 3종(causalforest·xgb·shap) 팝업 연동**
- **라디오믹스 실값 미확보** → 데모는 `radiomics_features(source=random_demo)` 무작위 자리표시자(생존자 20명만 노출). 향후 **PACS 자동 종양탐지 → ROI 라디오믹스 추출** 파이프라인으로 교체.
- 6컬럼(classification_cancer/surgical_cancer_t/n/m/bp/familyhistory)은 합성 최종값(모델에선 잡음).
