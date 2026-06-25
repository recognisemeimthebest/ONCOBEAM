"""예후예측 모델 학습 — Cox 비례위험(lifelines) → backend/ml_models/prognosis_model.joblib

실행:
    cd ml_training
    python train_prognosis.py
"""
import sys
from pathlib import Path

import joblib
import numpy as np
from lifelines import CoxPHFitter
from lifelines.utils import concordance_index
from sklearn.impute import SimpleImputer

BACKEND = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND))

from cdss import features as feat            # noqa: E402
from cdss.model_wrappers import PrognosisModel  # noqa: E402
from preprocessing import load_dataset       # noqa: E402

OUTPUT = BACKEND / "ml_models" / "prognosis_model.joblib"


def main():
    df = load_dataset()
    cols = feat.FEATURE_ORDER

    # 결측 대치 (중앙값) — imputer 는 모델과 함께 저장해 서빙 때 동일 적용
    imputer = SimpleImputer(strategy="median")
    X = imputer.fit_transform(df[cols].astype(float).to_numpy())  # 이름없는 배열로 학습→서빙 일치

    train = df[["time", "event"]].copy().reset_index(drop=True)
    for i, c in enumerate(cols):
        train[c] = X[:, i]
    train = train[train["time"] > 0]

    cph = CoxPHFitter(penalizer=0.1)  # N 작아 규제 부여
    cph.fit(train, duration_col="time", event_col="event")

    # 학습데이터 C-index (참고용; 정식 평가는 교차검증 권장)
    risk = np.asarray(cph.predict_partial_hazard(train[cols])).ravel()
    c = concordance_index(train["time"], -risk, train["event"])

    model = PrognosisModel(cph=cph, imputer=imputer, columns=cols)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, OUTPUT)
    print(f"학습 {len(train)}명 | C-index(학습)={c:.3f}")
    print(f"저장 완료: {OUTPUT}")


if __name__ == "__main__":
    main()
