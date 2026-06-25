"""HTE(처치효과) 모델 학습 — T-learner → backend/ml_models/hte_model.joblib

처치: 항암방사선(treatment=1) vs 방사선단독(0). 결과: 2년 생존(1=생존).
대조군/처치군 각각 결과모델(mu0, mu1)을 학습하고, uplift = P(생존|처치) − P(생존|대조).

실행:
    cd ml_training
    python train_hte.py

주의: 관측데이터 기반이라 교란 보정 가정 위에서만 해석. 정식 인과추론은
econml/causalml(Causal Forest, Causal Survival Forest)로 업그레이드 권장.
"""
import sys
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer

BACKEND = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND))

from cdss import features as feat            # noqa: E402
from cdss.model_wrappers import HTEModel     # noqa: E402
from preprocessing import load_dataset       # noqa: E402

OUTPUT = BACKEND / "ml_models" / "hte_model.joblib"


def main():
    df = load_dataset()
    cols = feat.FEATURE_ORDER

    # 2년 생존 라벨이 확정된(모호하지 않은) 표본만 사용
    d = df.dropna(subset=["surv2yr"]).copy()
    d["surv2yr"] = d["surv2yr"].astype(int)

    imputer = SimpleImputer(strategy="median")
    X = imputer.fit_transform(d[cols].astype(float).to_numpy())  # 이름없는 배열로 학습→서빙 일치
    y = d["surv2yr"].values
    t = d["treatment"].values

    def fit_arm(mask):
        m = RandomForestClassifier(n_estimators=300, min_samples_leaf=5, random_state=0)
        m.fit(X[mask], y[mask])
        return m

    mu1 = fit_arm(t == 1)
    mu0 = fit_arm(t == 0)

    model = HTEModel(mu0=mu0, mu1=mu1, imputer=imputer)
    uplift = model.predict(X)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, OUTPUT)
    print(f"학습표본 {len(d)} (처치 {int(t.sum())}/대조 {int((t==0).sum())}) "
          f"| 2년생존율 {y.mean():.2f}")
    print(f"평균 uplift={uplift.mean():+.3f} (범위 {uplift.min():+.3f}~{uplift.max():+.3f})")
    print(f"저장 완료: {OUTPUT}")


if __name__ == "__main__":
    main()
