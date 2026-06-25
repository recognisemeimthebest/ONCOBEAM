"""모델 학습 → 저장 흐름 예시 (뼈대용 더미).

이 스크립트는 '학습한 모델을 backend/ml_models/ 에 .joblib로 저장'하는
전체 흐름을 보여주기 위한 최소 예시입니다. 실제 HTE/예후 모델로 교체하세요.

실행:
    cd ml_training
    python train_example.py
"""
from pathlib import Path

import joblib
import numpy as np
from sklearn.linear_model import LinearRegression

# 모델을 저장할 위치 = 백엔드가 읽는 곳
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "backend" / "ml_models"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def main():
    # --- 1. 데이터 준비 (여기서는 가짜 데이터) ---
    # 실제로는 pandas로 CSV를 읽어옵니다: df = pd.read_csv("data.csv")
    X = np.random.rand(200, 2)        # 특성 2개 (예: age, biomarker)
    y = X[:, 0] * 0.5 + X[:, 1] * 0.3  # 가짜 정답

    # --- 2. 학습 (실제로는 econml / scikit-survival 모델로 교체) ---
    model = LinearRegression()
    model.fit(X, y)

    # --- 3. 저장 ---
    out = OUTPUT_DIR / "prognosis_model.joblib"
    joblib.dump(model, out)
    print(f"저장 완료: {out}")
    print("백엔드를 재시작하면 이 모델을 자동으로 불러옵니다.")


if __name__ == "__main__":
    main()
