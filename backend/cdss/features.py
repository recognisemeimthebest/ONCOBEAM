"""CDSS feature/label 정의 — 서빙(cdss)과 학습(ml_training)이 공유하는 단일 진실 공급원.

38컬럼 patients 스키마에서 모델 입력(feature)·정답(label)을 만드는 규칙을 한곳에 둔다.
학습 때와 서빙 때 feature 순서/인코딩이 어긋나면 예측이 조용히 틀리므로 반드시 이 모듈을 쓴다.

설계 메모:
- 예측 시점(치료 시작) 기준으로 알 수 있는 값만 feature 로 사용 → 누수(leakage) 방지.
- [추후입력] 컬럼(classification_cancer, surgical_cancer_t/n/m, bp, familyhistory)은 현재 NULL → 제외.
- HTE 처치(treatment)는 '항암방사선 vs 방사선단독' = treatmethod ∈ {2,4} → 1, else 0.
  처치 정의에 쓰는 treatmethod 는 feature 에서 제외(인과 누수 방지).
"""
import re

# 모델 입력 feature 순서 (학습/서빙 공통). 바뀌면 모델 재학습 필요.
FEATURE_ORDER = [
    "age",          # 치료시작 시점 나이 (initialdate.year - 출생연도)
    "sex_f",        # 여성 1 / 남성 0
    "height",       # cm
    "weight",       # kg
    "stage_num",    # 전체 병기 ordinal
    "t_num",        # T 병기 ordinal
    "n_num",        # N 병기 ordinal
    "m_num",        # M 병기 ordinal
    "dm",           # 당뇨 1/0
    "smoke",        # 흡연 1/0
    "totaldose",    # 방사선 총선량
    "radiationperdose",
    "radiationcnt",
    "treatech",     # 1 conformal / 2 IMRT / 3 기타
    "pni",          # 신경주위침범 1/0
    "lymph",        # 림프절 침윤 1/0
    "margin",       # 절제연 1완전/2비완전
]


def _ord(v):
    """'4a','2c','X','3' 같은 병기 문자열에서 선두 숫자만 추출. 없으면 None."""
    if v is None:
        return None
    m = re.match(r"\s*(\d+)", str(v))
    return int(m.group(1)) if m else None


def _num(v):
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _bool01(v):
    return None if v is None else (1 if v else 0)


def _birth_year(birth_date):
    if not birth_date:
        return None
    m = re.match(r"(\d{4})", str(birth_date))
    return int(m.group(1)) if m else None


def build_features(p) -> dict:
    """Patient ORM 객체(또는 .속성 접근 가능한 객체) → feature dict.

    값이 없으면 None (결측). 모델 파이프라인의 imputer 가 처리.
    """
    by = _birth_year(getattr(p, "birth_date", None))
    age = None
    if by:
        ref_year = p.initialdate.year if getattr(p, "initialdate", None) else 2020
        age = ref_year - by

    sex = getattr(p, "sex", None)
    return {
        "age": age,
        "sex_f": 1 if sex == "F" else (0 if sex == "M" else None),
        "height": _num(getattr(p, "height", None)),
        "weight": _num(getattr(p, "weight", None)),
        "stage_num": _ord(getattr(p, "cancerimaging", None)),
        "t_num": _ord(getattr(p, "cancerimaging_t", None)),
        "n_num": _ord(getattr(p, "cancerimaging_n", None)),
        "m_num": _ord(getattr(p, "cancerimaging_m", None)),
        "dm": 1 if getattr(p, "bs", None) == "Y" else (0 if getattr(p, "bs", None) == "N" else None),
        "smoke": 1 if getattr(p, "sm", None) == "Y" else (0 if getattr(p, "sm", None) == "N" else None),
        "totaldose": _num(getattr(p, "totaldose", None)),
        "radiationperdose": _num(getattr(p, "radiationperdose", None)),
        "radiationcnt": _num(getattr(p, "radiationcnt", None)),
        "treatech": _num(getattr(p, "treatech", None)),
        "pni": _bool01(getattr(p, "involmentrenal", None)),
        "lymph": _bool01(getattr(p, "lymphrenal", None)),
        "margin": _num(getattr(p, "boundary_surgical", None)),
    }


def to_vector(features: dict):
    """feature dict → 모델 입력 2D 배열 (FEATURE_ORDER 순서). 결측은 NaN."""
    return [[_nan(features.get(k)) for k in FEATURE_ORDER]]


def _nan(v):
    return float("nan") if v is None else v


# ── 모듈1(HTE) ──────────────────────────────────────────────────────────────
# 처치는 treatmethod 4군(1방사선/2항암방사선/3수술+방사선/4수술+항암방사선). 8(기타)은 제외.
# 비교 대비 4종(2×2 요인): 항암추가(1v2, 3v4) · 수술추가(1v3, 2v4).
HTE_ARMS = (1, 2, 3, 4)
HTE_CONTRASTS = [(1, 2), (3, 4), (1, 3), (2, 4)]


def treatment_arm(p):
    """HTE 처치군 = treatmethod (1~4). 그 외(8 등)는 None(HTE 제외)."""
    tm = getattr(p, "treatmethod", None)
    return tm if tm in HTE_ARMS else None


# ── 모듈2(예후) ─────────────────────────────────────────────────────────────
# 임상 입력 16종(스펙). classification_cancer·bp·familyhistory 는 현재 [추후입력] NULL.
MODULE2_CLINICAL = [
    "classification_cancer", "totaldose", "radiationcnt", "radiationperdose",
    "treatmethod", "treatech", "cancerimaging", "cancerimaging_t",
    "cancerimaging_n", "cancerimaging_m", "sex", "bp", "bs", "sm",
    "familyhistory", "birth_date",
]
HORIZON_5YR = 1825  # 5년(일)


def rfs_label_5yr(p):
    """모듈2 라벨: 5년 무재발생존 이진. 1=5년내 재발·사망 없음 / 0=있음 / None=모호(제외).

    사건 = 재발(relapse∈{2,3}) 또는 사망(dead=1). 시점 = 치료시작~사건/마지막추적.
    5년 전 무사건 중도절단은 판정 불가 → None.
    """
    start = getattr(p, "initialdate", None)
    if start is None:
        return None
    ev = []
    if getattr(p, "relapse", None) in (2, 3) and getattr(p, "relapsedate", None):
        ev.append(p.relapsedate)
    if getattr(p, "dead", None) == 1 and getattr(p, "deathdate", None):
        ev.append(p.deathdate)
    if ev:
        return 0 if (min(ev) - start).days <= HORIZON_5YR else 1
    end = getattr(p, "lastdate", None) or getattr(p, "deathdate", None)
    if end and (end - start).days >= HORIZON_5YR:
        return 1
    return None


def treatment_of(p) -> int:
    """[구버전·호환용] 이진 처치(항암 여부). 모듈1 4군 설계는 treatment_arm 사용."""
    tm = getattr(p, "treatmethod", None)
    return 1 if tm in (2, 4) else 0


def survival_label(p):
    """생존분석 라벨 (time_days, event). 산출 불가하면 None.

    event = dead(1/0), time = (사망일 or 마지막방문일) - 치료시작일, 일 단위.
    """
    start = getattr(p, "initialdate", None)
    if start is None:
        return None
    dead = getattr(p, "dead", None)
    end = getattr(p, "deathdate", None) if dead == 1 else getattr(p, "lastdate", None)
    if end is None:
        return None
    days = (end - start).days
    if days < 0:
        return None
    return days, int(dead or 0)
