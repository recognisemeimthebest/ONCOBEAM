"""저장된 ML 모델을 메모리로 불러오는 도우미.

모델 파일이 아직 없으면 None을 돌려준다 → 뼈대 단계에서도 서버가 돌아간다.
나중에 ml_training/ 에서 학습한 모델을 backend/ml_models/ 에 .joblib로 저장하면,
서버 재시작 시 자동으로 로드된다.
"""
from pathlib import Path

import joblib

MODELS_DIR = Path(__file__).resolve().parent.parent / "ml_models"


def load_model(filename: str):
    path = MODELS_DIR / filename
    if not path.exists():
        return None
    return joblib.load(path)
