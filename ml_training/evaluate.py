"""베이스라인 모델 정직한 평가 — 교차검증 지표.

학습데이터 지표는 낙관적이므로 K-fold 교차검증으로 일반화 성능을 추정한다.
- 예후(Cox): CV C-index (시간순위 일치도)
- HTE 결과모델: 2년 생존 분류의 CV AUC (예측 프록시).
  ※ 인과 처치효과 자체는 정답이 없어 직접 검증 불가 — 결과모델 판별력만 본다.

실행:
    cd ml_training
    python evaluate.py
"""
import sys
from pathlib import Path

import numpy as np
from lifelines import CoxPHFitter
from lifelines.utils import concordance_index
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold

BACKEND = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND))

from cdss import features as feat            # noqa: E402
from preprocessing import load_dataset       # noqa: E402

SEED = 0
K = 5


def eval_prognosis_cox(df):
    cols = feat.FEATURE_ORDER
    d = df[df["time"] > 0].reset_index(drop=True)
    y_event = d["event"].values
    skf = StratifiedKFold(n_splits=K, shuffle=True, random_state=SEED)
    cidx = []
    import pandas as pd
    for tr, te in skf.split(d[cols], y_event):
        imp = SimpleImputer(strategy="median")
        Xtr = imp.fit_transform(d[cols].iloc[tr].astype(float).to_numpy())
        Xte = imp.transform(d[cols].iloc[te].astype(float).to_numpy())
        # fold 내 분산 0(상수) 컬럼 제거 → Cox 수렴 실패 방지
        keep = [i for i in range(len(cols)) if Xtr[:, i].std() > 1e-8]
        kcols = [cols[i] for i in keep]
        Xtr, Xte = Xtr[:, keep], Xte[:, keep]
        train = d[["time", "event"]].iloc[tr].reset_index(drop=True)
        for j, c in enumerate(kcols):
            train[c] = Xtr[:, j]
        cph = CoxPHFitter(penalizer=0.5)  # 소표본 안정화 위해 규제 강화
        cph.fit(train, duration_col="time", event_col="event")
        risk = np.asarray(cph.predict_partial_hazard(pd.DataFrame(Xte, columns=kcols))).ravel()
        cidx.append(concordance_index(d["time"].iloc[te], -risk, d["event"].iloc[te]))
    return np.mean(cidx), np.std(cidx)


def eval_hte_outcome_auc(df):
    cols = feat.FEATURE_ORDER
    d = df.dropna(subset=["surv2yr"]).reset_index(drop=True)
    y = d["surv2yr"].astype(int).values
    skf = StratifiedKFold(n_splits=K, shuffle=True, random_state=SEED)
    aucs = []
    for tr, te in skf.split(d[cols], y):
        imp = SimpleImputer(strategy="median")
        Xtr = imp.fit_transform(d[cols].iloc[tr].astype(float).to_numpy())
        Xte = imp.transform(d[cols].iloc[te].astype(float).to_numpy())
        m = RandomForestClassifier(n_estimators=300, min_samples_leaf=5, random_state=SEED)
        m.fit(Xtr, y[tr])
        p = m.predict_proba(Xte)[:, 1]
        if len(np.unique(y[te])) > 1:
            aucs.append(roc_auc_score(y[te], p))
    return np.mean(aucs), np.std(aucs)


def main():
    df = load_dataset()
    print(f"데이터셋 {len(df)}명 | 사망 {int(df['event'].sum())} | "
          f"2년생존 라벨확정 {int(df['surv2yr'].notna().sum())}")

    m, s = eval_prognosis_cox(df)
    print(f"\n[예후 Cox]  {K}-fold CV C-index = {m:.3f} ± {s:.3f}")
    print("  (0.5=무작위, 0.7±=쓸만, 0.8↑=양호)")

    m, s = eval_hte_outcome_auc(df)
    print(f"\n[HTE 결과모델] {K}-fold CV AUC(2년생존) = {m:.3f} ± {s:.3f}")
    print("  ※ 처치효과 자체가 아닌 결과예측 판별력. 인과효과는 정답이 없어 직접검증 불가.")


if __name__ == "__main__":
    main()
