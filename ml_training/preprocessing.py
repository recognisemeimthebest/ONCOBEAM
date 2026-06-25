"""학습용 데이터셋 빌더 — PostgreSQL patients → feature/label 데이터프레임.

feature/label 정의는 backend/cdss/features.py(서빙 공용)를 그대로 재사용한다.
실행 전 backend/.env 의 PostgreSQL 이 떠 있어야 한다.
"""
import sys
from pathlib import Path

import pandas as pd

# backend 를 import 경로에 추가 → 서빙과 동일한 feature 정의 사용
BACKEND = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND))

from cdss import features as feat          # noqa: E402
from database import SessionLocal          # noqa: E402
from patients.models import Patient        # noqa: E402

HORIZON_DAYS = 730  # 2년


def load_dataset() -> pd.DataFrame:
    """한 행 = 한 환자. 컬럼 = FEATURE_ORDER + [time, event, treatment, surv2yr]."""
    db = SessionLocal()
    try:
        rows = db.query(Patient).all()
    finally:
        db.close()

    records = []
    for p in rows:
        lbl = feat.survival_label(p)
        if lbl is None:
            continue
        time_days, event = lbl
        rec = feat.build_features(p)
        rec["time"] = time_days
        rec["event"] = event
        rec["treatment"] = feat.treatment_of(p)
        # 2년 생존 라벨: 사망≤2년→0, 2년이상 추적→1, 그 전 중도절단→NaN(모호)
        if event == 1 and time_days <= HORIZON_DAYS:
            rec["surv2yr"] = 0
        elif time_days >= HORIZON_DAYS:
            rec["surv2yr"] = 1
        else:
            rec["surv2yr"] = float("nan")
        records.append(rec)

    df = pd.DataFrame(records)
    return df


if __name__ == "__main__":
    df = load_dataset()
    print("데이터셋:", df.shape)
    print("이벤트(사망):", int(df["event"].sum()), "/ 처치군:", int(df["treatment"].sum()))
    print("2년생존 라벨 분포:", df["surv2yr"].value_counts(dropna=False).to_dict())
    print(df[feat.FEATURE_ORDER].describe().round(2).T[["count", "mean", "min", "max"]])
