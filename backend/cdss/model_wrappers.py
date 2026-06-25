"""학습·서빙 공용 모델 래퍼.

joblib 로 저장한 모델을 백엔드가 그대로 불러와 .predict(X) 한 번으로 쓰도록,
전처리(imputer)와 추론 로직을 객체 안에 함께 담는다. 학습(ml_training)은 backend 를
sys.path 에 추가해 `cdss.model_wrappers` 로 import → 피클 모듈 경로가 서빙과 일치한다.
"""
import numpy as np


class PrognosisModel:
    """예후(생존) 위험점수 래퍼. predict(X) → 위험점수(클수록 고위험)."""

    def __init__(self, cph, imputer, columns):
        self.cph = cph            # lifelines CoxPHFitter
        self.imputer = imputer    # sklearn SimpleImputer
        self.columns = list(columns)

    def predict(self, X):
        import pandas as pd
        Xi = self.imputer.transform(np.asarray(X, dtype=float))
        df = pd.DataFrame(Xi, columns=self.columns)
        return np.asarray(self.cph.predict_partial_hazard(df)).ravel()


class HTEModel:
    """T-learner uplift 래퍼. predict(X) → 처치효과(2년 생존확률 차이, 처치−대조)."""

    def __init__(self, mu0, mu1, imputer):
        self.mu0 = mu0   # 대조군 결과모델
        self.mu1 = mu1   # 처치군 결과모델
        self.imputer = imputer

    def _p_survive(self, model, Xi):
        # 분류기면 생존(=1) 확률, 회귀기면 예측값
        if hasattr(model, "predict_proba"):
            return model.predict_proba(Xi)[:, 1]
        return model.predict(Xi)

    def predict(self, X):
        Xi = self.imputer.transform(np.asarray(X, dtype=float))
        return self._p_survive(self.mu1, Xi) - self._p_survive(self.mu0, Xi)
