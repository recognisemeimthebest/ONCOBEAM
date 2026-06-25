# CDSS Feature / Label 정의서

이 문서는 예후예측·HTE 모델의 **입력(feature)** 과 **정답(label)** 을 규정한다.
구현 단일 진실 공급원은 [`backend/cdss/features.py`](features.py) 이며, **학습(ml_training)과 서빙(cdss)이
모두 이 모듈을 import** 해서 인코딩 불일치를 막는다. 정의를 바꾸면 모델을 재학습해야 한다.

데이터 출처: PostgreSQL `patients` 테이블 (278명, QIN-HEADNECK 두경부암). 스키마는 [`patients/models.py`](../patients/models.py).

---

## 1. 공통 Feature (모델 입력) — `FEATURE_ORDER`

치료 시작 시점(`initialdate`)에 알 수 있는 값만 사용한다 (누수 방지).

| # | feature | 출처 컬럼 | 인코딩 |
|---|---------|----------|--------|
| 1 | age | birth_date, initialdate | 치료시작연도 − 출생연도 (출생월 미상→연 기준) |
| 2 | sex_f | sex | F→1, M→0 |
| 3 | height | height | cm (수치) |
| 4 | weight | weight | kg (수치) |
| 5 | stage_num | cancerimaging | 선두 숫자 (4a→4) |
| 6 | t_num | cancerimaging_t | 선두 숫자 (X→결측) |
| 7 | n_num | cancerimaging_n | 선두 숫자 |
| 8 | m_num | cancerimaging_m | 선두 숫자 |
| 9 | dm | bs | Y→1, N→0 |
| 10 | smoke | sm | Y→1, N→0 |
| 11 | totaldose | totaldose | 방사선 총선량 (Gy, 원본 단위 유지) |
| 12 | radiationperdose | radiationperdose | 회당 선량 |
| 13 | radiationcnt | radiationcnt | 분할 횟수 (파생값) |
| 14 | treatech | treatech | 1 conformal / 2 IMRT / 3 기타 |
| 15 | pni | involmentrenal | 신경주위침범 1/0 |
| 16 | lymph | lymphrenal | 림프절침윤 1/0 |
| 17 | margin | boundary_surgical | 1 완전절제 / 2 비완전절제 |

- 결측은 `None`(→ 벡터화 시 NaN). 모델 파이프라인에서 **imputer 필수**.
- **제외 컬럼**: 식별자(patient_id), 처치정의용(treatmethod), 결과/누수(relapse·dead·death*·lastdate·treatedate·diagnosis 텍스트),
  그리고 [추후입력] NULL 5종(classification_cancer, surgical_cancer_t/n/m, bp, familyhistory).
  → 추후입력 값이 채워지면 후보 feature 로 추가 검토.

---

## 2. 예후예측 (생존분석) Label — `survival_label(p)`

| 항목 | 정의 |
|------|------|
| event (사건) | `dead` (1=사망, 0=중도절단) |
| time (기간) | (`deathdate` if dead else `lastdate`) − `initialdate`, **일 단위** |
| 산출 가능 | 278/278명 (사망 이벤트 111) · 추적기간 중앙값 ≈ 1396일 |

- 모델: Cox 비례위험(lifelines/scikit-survival) 또는 RSF. 출력은 위험점수·생존함수.
- 음수 기간/날짜 결측 행은 자동 제외.

---

## 3. HTE (이질적 처치효과) — `treatment_of(p)`

| 항목 | 정의 |
|------|------|
| 처치 T | **항암방사선요법** = `treatmethod ∈ {2, 4}` → 1, 그 외 → 0 |
| 분포 | 처치군 205 / 대조군 73 |
| 결과 Y | 생존(2절의 time/event) — 처치에 따른 생존이득(uplift) 추정 |
| 공변량 X | 1절 feature (단, treatmethod 자체는 제외) |

- 임상 질문: *"이 환자에게 항암을 추가(chemoradiation)하면 방사선 단독 대비 생존이 얼마나 개선되는가"*.
- 모델: T-learner / Causal Forest(econml·causalml) 또는 생존 기반 인과(예: Causal Survival Forest).
- ⚠️ 관측 데이터이므로 **교란(confounding) 보정 가정** 위에서만 해석. 처치 정의는 연구 합의에 따라 변경 가능
  (예: 수술+ vs 비수술, IMRT vs conformal). 바꾸면 `treatment_of` 만 수정.

---

## 4. 데이터 한계 (모델링 시 유의)

- 표본 N=278로 작음 → 과적합 주의, 교차검증/규제 필수.
- `birth_date` 연도만 존재 → 나이 근사치.
- 결측률 높은 병리 feature: pni·lymph·margin (수술 시행자만 존재).
- `totaldose` 단위는 Gy(원본) — cGy 아님.
