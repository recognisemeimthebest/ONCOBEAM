"""cdss.features — 인코딩·라벨·처치군 로직 테스트 (DB 불필요)."""
import math
from datetime import date

from cdss import features as feat
from conftest import make_patient


# ── 인코딩 ──────────────────────────────────────────────────────────────────
def test_ord_extracts_leading_digit():
    assert feat._ord("4a") == 4
    assert feat._ord("2c") == 2
    assert feat._ord("X") is None
    assert feat._ord(None) is None


def test_birth_year():
    assert feat._birth_year("195003") == 1950
    assert feat._birth_year(None) is None


def test_build_features_keys_and_values():
    p = make_patient(sex="F", birth_date="194001", initialdate=date(2000, 1, 1))
    f = feat.build_features(p)
    # 모든 FEATURE_ORDER 키 존재
    assert set(feat.FEATURE_ORDER).issubset(f.keys())
    assert f["age"] == 60          # 2000 - 1940
    assert f["sex_f"] == 1
    assert f["stage_num"] == 4     # '4a' → 4
    assert f["dm"] == 0 and f["smoke"] == 1
    assert f["pni"] == 1 and f["lymph"] == 0


def test_to_vector_order_and_nan():
    p = make_patient(height=None)   # 결측 → NaN
    vec = feat.to_vector(feat.build_features(p))
    assert len(vec) == 1 and len(vec[0]) == len(feat.FEATURE_ORDER)
    idx = feat.FEATURE_ORDER.index("height")
    assert math.isnan(vec[0][idx])


# ── 모듈1: 처치군 ───────────────────────────────────────────────────────────
def test_treatment_arm():
    assert feat.treatment_arm(make_patient(treatmethod=1)) == 1
    assert feat.treatment_arm(make_patient(treatmethod=4)) == 4
    assert feat.treatment_arm(make_patient(treatmethod=8)) is None  # 기타 제외
    assert feat.HTE_CONTRASTS == [(1, 2), (3, 4), (1, 3), (2, 4)]


# ── 모듈2: 5년 RFS 라벨 ─────────────────────────────────────────────────────
def test_rfs_event_within_5yr_is_zero():
    # 1년 만에 사망 → 5년내 사건 → 0
    p = make_patient(initialdate=date(2000, 1, 1), dead=1, deathdate=date(2001, 1, 1))
    assert feat.rfs_label_5yr(p) == 0


def test_rfs_eventfree_followed_5yr_is_one():
    # 사건 없이 6년 추적 → 1
    p = make_patient(initialdate=date(2000, 1, 1), dead=0, relapse=1,
                     lastdate=date(2006, 1, 1))
    assert feat.rfs_label_5yr(p) == 1


def test_rfs_censored_before_5yr_is_none():
    # 사건 없이 2년만 추적 → 모호(None)
    p = make_patient(initialdate=date(2000, 1, 1), dead=0, relapse=1,
                     lastdate=date(2002, 1, 1))
    assert feat.rfs_label_5yr(p) is None


def test_rfs_relapse_after_5yr_is_one():
    p = make_patient(initialdate=date(2000, 1, 1), relapse=2,
                     relapsedate=date(2006, 6, 1), lastdate=date(2006, 6, 1))
    assert feat.rfs_label_5yr(p) == 1


# ── 생존 라벨 ───────────────────────────────────────────────────────────────
def test_survival_label():
    p = make_patient(initialdate=date(2000, 1, 1), dead=1, deathdate=date(2001, 1, 1))
    days, event = feat.survival_label(p)
    assert event == 1 and days == 366  # 2000 윤년
