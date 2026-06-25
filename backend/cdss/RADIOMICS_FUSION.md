# 모듈 2 — 임상변수 + 라디오믹스 결합 설계

모듈 2(5년 무재발생존 이진예측)의 입력은 **임상변수 16개 + 라디오믹스**다.
이 문서는 두 모달리티를 **어떻게 합쳐 하나의 예측에 쓰는가**를 규정한다.

라디오믹스 산출 포맷(팀 기존 작업 기준): `patient_id` + pyradiomics 피처
(`original_*`, `wavelet-*` = firstorder/shape/glcm/glrlm/glszm/gldm/ngtdm), **환자당 1행**.

---

## 0. 결합 대상 변수

| 모달리티 | 변수 | 현재 상태 |
|---|---|---|
| 임상 (16) | classification_cancer, totaldose, radiationcnt, radiationperdose, treatmethod, treatech, cancerimaging, cancerimaging_t/n/m, sex, bp, bs, sm, familyhistory, birth_date(→age) | classification_cancer·bp·familyhistory 는 [추후입력] NULL |
| 라디오믹스 | pyradiomics 피처 N개 (선택 후 ~15–50개) | QIN-HEADNECK 산출물 **아직 없음** |
| 라벨 | 5년 RFS (1=무사건/0=사건) | 산출가능 202명 (1=87, 0=115, 모호 76 제외) |
| 파생변수 | (추후 제공) | 미포함 |

---

## 1. 결합 키 & 정합성

- **조인 키 = `patient_id`** (양쪽 동일 문자열).
- 한 환자에 CBCT가 주차별 최대 6장 → 라디오믹스는 **환자당 1벡터로 집약**해야 함. 집약 정책(택1, 추출 파이프라인에서 결정):
  - **(A) 기준시점 1장** (예: 치료 전/1주차) — 가장 단순, 예후 baseline.
  - **(B) 평균/대표값** — 주차 피처 평균.
  - **(C) Δ-radiomics** — (마지막−첫) 변화량, 치료 반응 신호. 예후에 강력하나 영상 2장 이상 필요.
  - → 기본 권장 **(A) 기준시점**, 여력되면 (C)를 파생피처로 추가.
- 라디오믹스 없는 환자(CBCT 누락) 처리: 모듈2 학습에서 **제외**하거나, 임상단독 모델로 폴백. (조인은 LEFT JOIN, 결측 표시 유지)

## 2. 저장 스키마

라디오믹스는 피처 집합이 넓고(수백 개) 선택 단계마다 바뀌므로, `patients` 에 직접 컬럼 추가하지 않고
**별도 테이블 + JSONB** 로 둔다(스키마 유연성). ML 단계에서 wide DataFrame 으로 펼친다.

```
radiomics_features
  patient_id  FK→patients.patient_id   (PK 일부)
  source      text     # 집약정책 'baseline'/'mean'/'delta' 등
  version     text     # 피처셋 버전(추출 설정 해시)
  features    JSONB    # {"original_shape_LeastAxisLength": 114.5, ...}
  (PK: patient_id, source, version)
```
- 적재: `patient_id` 별 CSV 한 행 → JSONB 한 레코드. (`load_radiomics.py` 로 별도 적재)
- 다중 집약정책/버전을 한 테이블에 공존 → 실험 비교 용이.

## 3. 결합(fusion) 전략 — 권장: **2-stage Rad-score + 임상 결합**

소표본(202) + 고차원 라디오믹스 → 직접 concat 하면 라디오믹스가 과적합·지배. 라디오믹스 표준 접근을 따른다.

```
[라디오믹스 N개] ──(전처리/선택)──▶ Rad-score (1개 연속값)
                                          │
[임상 16개] ──────────────────────────────┼──▶ 최종 분류기 → 5년 RFS 확률
```

1. **라디오믹스 전처리**
   - 다기관 데이터(AJMC/PNUH/SCHMC…) → **ComBat 하모나이제이션**(스캐너/기관 배치효과 제거).
   - 안정성 필터(ICC, test-retest 또는 Δ), 분산 0 제거, 상관 |r|>0.9 가지치기, z-정규화.
2. **Rad-score 생성**: 선택된 라디오믹스로 **LASSO 로지스틱**(5년 RFS 대상) → 선형결합 점수 1개.
   - 누수 방지: Rad-score 학습은 **train fold 안에서만** 적합(중첩 교차검증).
3. **최종 결합 모델**: 입력 = 임상 16개 + Rad-score → 로지스틱/GBM → 5년 RFS.
   - 해석: 임상 단독 vs +Rad-score 의 AUC 증분으로 라디오믹스 기여 평가(델타 AUC, NRI).

**대안(베이스라인) — Early fusion**: 임상 16 + 라디오믹스 N 을 그대로 concat → 규제 강한 단일 모델
(LASSO/ElasticNet). 구현 단순, 표본 충분할 때만. → 1차 비교군으로만.

**비권장 — Late fusion(별도 모델 확률 평균)**: 임상·라디오믹스 상호작용을 못 살림.

## 4. 파이프라인 통합 지점

기존 `ml_training/preprocessing.py` 의 `load_dataset()` 확장:
1. `patients` → 임상 16개 + 5년 RFS 라벨 (`features.py` 의 `survival_label_5yr` 신설).
2. `radiomics_features`(또는 CSV) → `patient_id` 로 **LEFT JOIN**, JSONB → wide.
3. 출력 DataFrame = `[clinical_16 | radiomics_N | label]`.
4. 학습 스크립트 `train_prognosis_v2.py` 가 3절 2-stage 로 학습 → `prognosis_model.joblib` 교체.
   서빙 래퍼는 `PrognosisModel` 에 Rad-score 단계를 포함(이미 imputer 내장 구조라 확장 용이).

서빙(`cdss/features.py`)도 동일 결합을 재현해야 하므로, **임상+라디오믹스 조립 로직을 features.py 한곳**에 둔다
(학습·서빙 단일 진실 공급원 원칙 유지).

## 5. 진행 차단요인 (모듈2 학습 전 필요)

1. **QIN-HEADNECK 라디오믹스 CSV** (`patient_id` + pyradiomics 피처, 환자당 1행, 집약정책 명시).
2. **임상 NULL 3종** 입력값: classification_cancer, bp, familyhistory.
3. **5년 RFS 라벨**은 확정(이 설계로 산출). **파생 outcome/변수**는 추후 제공분 반영.

→ 위가 갖춰지면 2절(테이블)·4절(파이프라인)·3절(2-stage) 순으로 즉시 구현 가능.
지금은 스키마/조인/Rad-score 골격을 미리 깔아 둔다.
