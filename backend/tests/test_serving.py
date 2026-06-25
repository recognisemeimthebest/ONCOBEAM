"""모델 서빙 테스트 — 저장된 joblib 로드 + 예측 동작 (DB 불필요)."""
from pathlib import Path

import pytest

from cdss import features as feat, hte, prognosis
from conftest import make_patient

MODELS = Path(__file__).resolve().parent.parent / "ml_models"


def test_dummy_path_when_no_model(monkeypatch):
    """모델 None 이어도 더미 응답으로 서버가 동작."""
    monkeypatch.setattr(prognosis, "_model", None)
    out = prognosis.predict_prognosis({"age": 60})
    assert out["model_loaded"] is False and "risk_score" in out


@pytest.mark.skipif(not (MODELS / "prognosis_model.joblib").exists(),
                    reason="학습된 prognosis 모델 없음")
def test_prognosis_predict_real_model():
    f = feat.build_features(make_patient())
    out = prognosis.predict_prognosis(f)
    assert out["model_loaded"] is True
    assert isinstance(out["risk_score"], float)


@pytest.mark.skipif(not (MODELS / "hte_model.joblib").exists(),
                    reason="학습된 hte 모델 없음")
def test_hte_predict_real_model():
    f = feat.build_features(make_patient())
    out = hte.predict_treatment_effect(f)
    assert out["model_loaded"] is True
    assert isinstance(out["treatment_effect"], float)
    assert out["recommendation"] in ("처치 권고", "처치 비권고")
