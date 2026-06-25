"""HTE(이질적 처치효과) 예측 로직.

핵심 아이디어: "이 환자에게 처치를 했을 때 결과가 얼마나 달라지는가"를 추정.
실제로는 econml / causalml 등으로 학습한 모델(예: T-learner, Causal Forest)을
ml_training/ 에서 만들어 backend/ml_models/hte_model.joblib 로 저장해 둔다.
"""
from cdss.loader import load_model

# 서버 시작 시 1번만 로드 (없으면 None)
_model = load_model("hte_model.joblib")


def predict_treatment_effect(features: dict) -> dict:
    """입력 특성으로 개별 처치효과(uplift)를 추정.

    features 예: {"age": 60, "biomarker": 3.2, ...}
    """
    if _model is None:
        # --- 더미 응답 (모델 연결 전 단계) ---
        return {
            "treatment_effect": 0.15,  # 처치 시 결과가 +15%p 좋아진다는 가짜 값
            "recommendation": "처치 권고 (예시값)",
            "model_loaded": False,
        }

    # --- 실제 모델 연결 후 (예시) ---
    # X = build_feature_vector(features)
    # effect = float(_model.effect(X)[0])   # econml 계열 API 예시
    X = _to_vector(features)
    effect = float(_model.predict(X)[0])
    return {
        "treatment_effect": effect,
        "recommendation": "처치 권고" if effect > 0 else "처치 비권고",
        "model_loaded": True,
    }


def _to_vector(features: dict):
    """dict → 모델 입력 2D 배열. 순서/인코딩은 cdss.features 공용 정의를 따른다."""
    from cdss.features import to_vector
    return to_vector(features)
