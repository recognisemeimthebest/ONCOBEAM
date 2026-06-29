"""CDSS 실모델 서비스 (py3.11 / cdss_ml 환경).

루트의 3개 학습 산출물을 그대로 로드해 환자별 예측을 제공한다.
- causalforest_models.pkl : 4개 대비별 econml CausalForestDML  → CATE + 신뢰구간 (왼쪽)
- xgb_model.pkl           : XGBClassifier(36피처) 5년 사건 위험  → 위험확률 (오른쪽)
- shap_explainer_1_vs_2.pkl: 1_vs_2 대비 RandomForest + SHAP   → 변수 기여도 (아래)

라디오믹스 피처는 DB radiomics_features(source=random_demo)에서 가져온다(데모용 무작위값).
임상 피처는 patients 테이블에서 조립한다. 학습 피처정의는 다운로드/HTE/config.json 기준.
실행: cd model_service && uvicorn app:app --port 8011
"""
import pickle
import re
import warnings
from pathlib import Path

import joblib
import numpy as np
import shap
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, text

warnings.filterwarnings("ignore")

MODELS = Path(__file__).resolve().parent / "models"
DB_URL = "postgresql+psycopg2://cdss:cdss@localhost:5432/cdss"
engine = create_engine(DB_URL)

# ── 모델 로드 ────────────────────────────────────────────────────────────────
CF = joblib.load(MODELS / "causalforest_models.pkl")        # dict: 4 contrasts
XGB = joblib.load(MODELS / "xgb_model.pkl")                 # {'model','features'}
XGB_MODEL, XGB_FEATURES = XGB["model"], XGB["features"]


class _Any:  # shap pkl의 numba 객체를 건너뛰기 위한 스텁
    def __init__(self, *a, **k): pass
    def __new__(cls, *a, **k): return object.__new__(cls)
    def __setstate__(self, s): pass
    def __call__(self, *a, **k): return self
    def __getattr__(self, n): return _Any()


class _SkipUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if module.startswith(("numba", "llvmlite")) or module.startswith("shap"):
            return _Any
        return super().find_class(module, name)


with open(MODELS / "shap_explainer_1_vs_2.pkl", "rb") as f:
    _shap_obj = _SkipUnpickler(f).load()          # explainer는 스텁, rf만 실제
SHAP_RF = _shap_obj["rf"]
SHAP_FEATURES = _shap_obj["features"]             # 9개 (causalforest와 동일 순서)
SHAP_EXPLAINER = shap.TreeExplainer(SHAP_RF, feature_perturbation="tree_path_dependent")

# 대비 라벨 (config.json)
PAIR_LABELS = {
    "1_vs_2": "방사선 vs 항암방사선 (항암 추가 효과)",
    "3_vs_4": "수술+방사선 vs 수술+항암방사선 (수술후 항암 추가)",
    "1_vs_3": "방사선 vs 수술+방사선 (수술 추가 효과)",
    "2_vs_4": "항암방사선 vs 수술+항암방사선 (수술 추가 효과)",
}
BONFERRONI_ALPHA = 0.05 / len(CF)   # 4개 대비 보정

# 치료군 라벨 (treatmethod 1~4)
ARM_LABELS = {1: "방사선 단독(RT)", 2: "항암방사선(CCRT)",
              3: "수술+방사선", 4: "수술+항암"}

FEATURE_KO = {
    "age_at_tx": "진단시 나이", "weight": "체중", "totaldose": "총선량",
    "radiationcnt": "방사선 횟수", "radiationperdose": "회당 선량",
    "pre_original_glcm_InverseVariance": "라디오믹스·GLCM 역분산",
    "pre_original_ngtdm_Busyness": "라디오믹스·NGTDM Busyness",
    "post_original_glrlm_HighGrayLevelRunEmphasis": "라디오믹스·GLRLM HGLRE",
    "post_original_glszm_HighGrayLevelZoneEmphasis": "라디오믹스·GLSZM HGLZE",
}

# ── 피처 조립 ────────────────────────────────────────────────────────────────
def _ord(v):
    if v is None:
        return np.nan
    m = re.match(r"\s*(\d+)", str(v))
    return float(m.group(1)) if m else np.nan


def _num(v):
    try:
        return float(v) if v is not None else np.nan
    except (TypeError, ValueError):
        return np.nan


def _age_at_tx(p):
    by = None
    if p["birth_date"]:
        m = re.match(r"(\d{4})", str(p["birth_date"]))
        by = int(m.group(1)) if m else None
    if by is None:
        return np.nan
    ref = p["initialdate"].year if p["initialdate"] else 2020
    return float(ref - by)


def _age_group(age):
    if np.isnan(age):
        return None
    if age < 40: return "<40yrs"
    if age < 50: return "40-49yrs"
    if age < 60: return "50-59yrs"
    if age < 70: return "60-69yrs"
    if age < 80: return "70-79yrs"
    return ">80yrs"


def causalforest_vector(p, rad):
    """9피처: 임상 5 + 라디오믹스 4 (causalforest/shap 공용)."""
    v = [
        _age_at_tx(p), _num(p["weight"]), _num(p["totaldose"]),
        _num(p["radiationcnt"]), _num(p["radiationperdose"]),
        rad.get("pre_original_glcm_InverseVariance", 0.0),
        rad.get("pre_original_ngtdm_Busyness", 0.0),
        rad.get("post_original_glrlm_HighGrayLevelRunEmphasis", 0.0),
        rad.get("post_original_glszm_HighGrayLevelZoneEmphasis", 0.0),
    ]
    # causal forest는 NaN 불가 → 0 대체
    return np.array([[0.0 if (x is None or np.isnan(x)) else x for x in v]])


def xgb_vector(p, rad):
    """36피처 (xgb_model['features'] 순서). 결측은 NaN(XGBoost 자체 처리)."""
    age = _age_at_tx(p)
    ag = _age_group(age)
    sex = p["sex"]
    feat = {
        "pre_original_firstorder_10Percentile": rad.get("pre_original_firstorder_10Percentile", np.nan),
        "pre_original_firstorder_MeanAbsoluteDeviation": rad.get("pre_original_firstorder_MeanAbsoluteDeviation", np.nan),
        "pre_original_gldm_DependenceEntropy": rad.get("pre_original_gldm_DependenceEntropy", np.nan),
        "pre_original_ngtdm_Coarseness": rad.get("pre_original_ngtdm_Coarseness", np.nan),
        "pre_original_ngtdm_Contrast": rad.get("pre_original_ngtdm_Contrast", np.nan),
        "delta_original_firstorder_Median": rad.get("delta_original_firstorder_Median", np.nan),
        "classification cancer": _num(p["classification_cancer"]),
        "totaldose": _num(p["totaldose"]), "radiationcnt": _num(p["radiationcnt"]),
        "radiationperdose": _num(p["radiationperdose"]), "treatmethod": _num(p["treatmethod"]),
        "treatech": _num(p["treatech"]), "height": _num(p["height"]), "weight": _num(p["weight"]),
        "locationcancer": _num(p["locationcancer"]), "age_at_tx": age,
        "img_stage": _ord(p["cancerimaging"]), "imgT_stage": _ord(p["cancerimaging_t"]),
        "imgN_stage": _ord(p["cancerimaging_n"]), "imgM_stage": _ord(p["cancerimaging_m"]),
        "sex_F": 1.0 if sex == "F" else 0.0, "sex_M": 1.0 if sex == "M" else 0.0,
        "bp_N": 1.0 if p["bp"] == "N" else 0.0, "bp_Y": 1.0 if p["bp"] == "Y" else 0.0,
        "bs_N": 1.0 if p["bs"] == "N" else 0.0, "bs_Y": 1.0 if p["bs"] == "Y" else 0.0,
        "sm_N": 1.0 if p["sm"] == "N" else 0.0, "sm_Y": 1.0 if p["sm"] == "Y" else 0.0,
        "familyhistory_N": 1.0 if p["familyhistory"] == "N" else 0.0,
        "familyhistory_Y": 1.0 if p["familyhistory"] == "Y" else 0.0,
    }
    for g in ["40-49yrs", "50-59yrs", "60-69yrs", "70-79yrs", "<40yrs", ">80yrs"]:
        feat[f"age_group_{g}"] = 1.0 if ag == g else 0.0
    return np.array([[feat[k] for k in XGB_FEATURES]])


# ── DB 조회 ──────────────────────────────────────────────────────────────────
PATIENT_COLS = ("id, patient_id, classification_cancer, totaldose, radiationcnt, "
                "radiationperdose, treatmethod, treatech, height, weight, locationcancer, "
                "birth_date, initialdate, sex, bp, bs, sm, familyhistory, cancerimaging, "
                "cancerimaging_t, cancerimaging_n, cancerimaging_m")


def load_patient(pid):
    with engine.connect() as c:
        row = c.execute(text(
            f"select {PATIENT_COLS} from patients where patient_id=:p"), {"p": pid}).mappings().first()
        rad = c.execute(text(
            "select features from radiomics_features where patient_id=:p and source='random_demo'"),
            {"p": pid}).scalar()
    return (dict(row) if row else None), (rad or None)


def cohort_stats(t_stage, n_stage, suggested_arm):
    """유사 병기 환자군의 실제 재발률 (DB relapse). '나와 비슷한 환자' 신뢰 근거.

    유사 = 같은 진행도 버킷(국소진행 vs 조기). relapse 1=없음 / 2·3=재발.
    권고 치료군 vs 그 외의 관측 재발률을 비교한다.
    """
    T, N = _stage_ord(t_stage), _stage_ord(n_stage)
    target_adv = (T is not None and T >= 3) or (N is not None and N >= 1)
    with engine.connect() as c:
        rows = c.execute(text(
            "select treatmethod, cancerimaging_t, cancerimaging_n, relapse "
            "from patients where relapse is not null")).all()

    def is_adv(t, n):
        to, no = _stage_ord(t), _stage_ord(n)
        return (to is not None and to >= 3) or (no is not None and no >= 1)

    peers = [r for r in rows if is_adv(r[1], r[2]) == target_adv]
    def rate(group):
        g = [r for r in group if r[3] in (1, 2, 3)]
        if not g:
            return None, 0
        recur = sum(1 for r in g if r[3] in (2, 3))
        return round(recur / len(g) * 100, 1), len(g)

    arm_grp = [r for r in peers if r[0] == suggested_arm]
    other_grp = [r for r in peers if r[0] != suggested_arm]
    arm_rate, arm_n = rate(arm_grp)
    other_rate, other_n = rate(other_grp)
    all_rate, all_n = rate(peers)
    return {
        "bucket": "국소진행(T3-4 또는 N+)" if target_adv else "조기(T1-2 N0)",
        "n_total": all_n,
        "recur_overall": all_rate,
        "suggested_arm": suggested_arm,
        "suggested_arm_label": ARM_LABELS.get(suggested_arm),
        "recur_suggested": arm_rate, "n_suggested": arm_n,
        "recur_other": other_rate, "n_other": other_n,
        "small_sample": arm_n < 5,
    }


# ── 권고 합성 (임상 가이드라인 + 위험 + 인과모델 근거) ────────────────────────
def _stage_ord(v):
    if not v:
        return None
    m = re.match(r"\s*(\d+)", str(v))
    return int(m.group(1)) if m else None


def synthesize_recommendation(contrasts, prob, current_arm, t_stage, n_stage):
    """헤드라인 권고 = 병기(NCCN식 가이드라인) + 5년위험. 인과모델(CATE)은 근거로 첨부.

    이유: 라디오믹스가 데모 placeholder라 Causal Forest CATE가 거의 모든 환자에서
    동일 방향(RT)으로 수렴 → 권고가 획일적. 임상적으로도 단일 인과모델을 치료결정
    단독 근거로 쓰지 않는다. 그래서 환자별로 실제 변하는 병기·위험을 1차 근거로 삼고,
    CATE/SHAP/XGB는 '근거 상세'와 rationale에 보조로 제시한다.
    """
    T, N = _stage_ord(t_stage), _stage_ord(n_stage)
    stage_txt = f"T{T if T is not None else '?'}N{N if N is not None else '?'}"
    risk_tier = "고위험" if prob >= 0.66 else ("중등도" if prob >= 0.33 else "저위험")
    advanced = (T is not None and T >= 3) or (N is not None and N >= 1)

    # 가이드라인(NCCN-lite) 기반 표준 치료군
    if current_arm in (3, 4):                       # 수술 시행 환자 → 수술 후 보조
        suggested = 4 if (advanced or risk_tier == "고위험") else 3
        basis = f"수술 시행 + {stage_txt} → 수술 후 보조요법"
    elif advanced:                                   # 국소진행 → 동시항암방사선
        suggested = 2
        basis = f"국소진행({stage_txt}) → 동시항암방사선(CCRT) 표준"
    else:                                            # 조기 → 방사선 단독 고려
        suggested = 1
        basis = f"조기({stage_txt}) → 방사선 단독(RT) 고려"
    if risk_tier == "고위험" and suggested == 1:     # 고위험이면 단독요법 상향
        suggested = 2
        basis += " · 고위험 → CCRT 상향"

    rationale = [basis, f"5년 재발·사망 위험 {prob*100:.0f}% ({risk_tier}, XGBoost)"]
    # 인과모델 근거(보조): 유의한 대비 1~2개만
    n_sig = 0
    for c in contrasts:
        if c["significant"]:
            n_sig += 1
            win = c["b"] if c["cate"] > 0 else c["a"]
            if n_sig <= 2:
                rationale.append(
                    f"[Causal Forest] {ARM_LABELS[win]} 우세 (CATE {c['cate']:+.2f}, 유의)")

    confidence = "높음" if (T is not None and N is not None) else "보통(병기정보 일부 결측)"
    agrees = current_arm in ARM_LABELS and suggested == current_arm
    headline = f"AI 권고: {ARM_LABELS[suggested]} · 5년 위험 {prob*100:.0f}%({risk_tier})"

    return {
        "suggested_arm": suggested,
        "suggested_arm_label": ARM_LABELS.get(suggested),
        "headline": headline,
        "rationale": rationale,
        "risk_prob": prob,
        "risk_tier": risk_tier,
        "confidence": confidence,
        "n_significant": n_sig,
        "stage": stage_txt,
        "current_arm": current_arm if current_arm in ARM_LABELS else None,
        "current_arm_label": ARM_LABELS.get(current_arm),
        "agrees_with_plan": agrees,
        "caveats": [
            "권고는 병기·위험 가이드라인 기반이며 Causal Forest/XGBoost는 보조 근거",
            "라디오믹스 입력은 데모용 자리표시자(무작위) — 영상소견 기여는 미반영",
            "의사결정 보조 도구이며 최종 판단은 의사 평가에 따릅니다(SaMD)",
        ],
    }


# ── API ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="CDSS Model Service", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["*"], allow_headers=["*"],
)


class PredictReq(BaseModel):
    patient_id: str


@app.get("/active_patients")
def active_patients():
    """영상(라디오믹스)이 배정된 환자만 — EMR에 노출할 대상."""
    with engine.connect() as c:
        rows = c.execute(text(
            "select patient_id, features->>'__image_case' as image_case "
            "from radiomics_features where source='random_demo' order by patient_id")).mappings().all()
    return {"patient_ids": [r["patient_id"] for r in rows],
            "items": [dict(r) for r in rows]}


@app.post("/predict")
def predict(req: PredictReq):
    p, rad = load_patient(req.patient_id)
    if p is None:
        raise HTTPException(404, "환자를 찾을 수 없습니다.")
    if rad is None:
        raise HTTPException(409, "영상(라디오믹스)이 배정되지 않은 환자입니다.")

    # 1) Causal Forest — 대비별 CATE + Bonferroni CI (왼쪽)
    Xcf = causalforest_vector(p, rad)
    contrasts = []
    for key, model in CF.items():
        a, b = key.split("_vs_")
        cate = float(model.effect(Xcf)[0])
        lo, hi = model.effect_interval(Xcf, alpha=BONFERRONI_ALPHA)
        lo, hi = float(lo[0]), float(hi[0])
        contrasts.append({
            "key": key, "a": int(a), "b": int(b),
            "label": PAIR_LABELS.get(key, key),
            "cate": cate, "ci_low": lo, "ci_high": hi,
            "significant": bool(lo > 0 or hi < 0),
        })

    # 2) XGBoost — 5년 사건(재발/사망) 위험확률 (오른쪽)
    Xxgb = xgb_vector(p, rad)
    prob_event = float(XGB_MODEL.predict_proba(Xxgb)[0, 1])

    # 3) SHAP — 1_vs_2 대비 변수 기여도 (아래)
    sv = SHAP_EXPLAINER.shap_values(Xcf)[0]
    base = float(np.ravel(SHAP_EXPLAINER.expected_value)[0])
    shap_list = sorted(
        [{"feature": f, "feature_ko": FEATURE_KO.get(f, f),
          "value": float(v), "x": float(Xcf[0, i])}
         for i, (f, v) in enumerate(zip(SHAP_FEATURES, sv))],
        key=lambda d: abs(d["value"]), reverse=True)

    # 4) 권고 합성 (진료화면 배너용) — 병기·위험 가이드라인 + 인과모델 근거
    recommendation = synthesize_recommendation(
        contrasts, prob_event, p.get("treatmethod"),
        p.get("cancerimaging_t"), p.get("cancerimaging_n"))

    # 5) 유사 환자 코호트 비교 (실제 재발률)
    cohort = cohort_stats(p.get("cancerimaging_t"), p.get("cancerimaging_n"),
                          recommendation["suggested_arm"])

    return {
        "patient_id": req.patient_id,
        "image_case": rad.get("__image_case"),
        "bonferroni_alpha": BONFERRONI_ALPHA,
        "recommendation": recommendation,
        "cohort": cohort,
        "contrasts": contrasts,
        "xgb": {"prob_event_5yr": prob_event},
        "shap": {"base_value": base, "contributions": shap_list,
                 "contrast": "1_vs_2", "contrast_label": PAIR_LABELS["1_vs_2"]},
    }


@app.get("/health")
def health():
    return {"status": "ok", "models": ["causalforest", "xgb", "shap"],
            "contrasts": list(CF.keys()), "n_active": len(active_patients()["patient_ids"])}
