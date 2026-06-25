"""예후예측 로직.

핵심 아이디어: "이 환자의 향후 경과(예: 6개월 생존확률, 재발 위험)"를 추정.
실제로는 scikit-survival / lifelines 등으로 학습한 생존분석 모델을
ml_training/ 에서 만들어 backend/ml_models/prognosis_model.joblib 로 저장한다.
"""
from cdss.loader import load_model

_model = load_model("prognosis_model.joblib")


def predict_prognosis(features: dict) -> dict:
    """입력 특성으로 예후(위험도/생존확률)를 추정."""
    if _model is None:
        # --- 더미 응답 (모델 연결 전 단계) ---
        return {
            "risk_score": 0.32,
            "survival_6m": 0.80,  # 6개월 생존확률 80% (가짜 값)
            "model_loaded": False,
        }

    # --- 실제 모델 연결 후 (예시) ---
    X = _to_vector(features)
    risk = float(_model.predict(X)[0])
    return {
        "risk_score": risk,
        "survival_6m": None,  # 생존함수 출력은 모델 종류에 맞게 추가
        "model_loaded": True,
    }


def _to_vector(features: dict):
    """dict → 모델 입력 2D 배열. 순서/인코딩은 cdss.features 공용 정의를 따른다."""
    from cdss.features import to_vector
    return to_vector(features)
