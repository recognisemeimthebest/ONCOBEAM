# model_service/models

실모델 서비스가 로드하는 학습 산출물 pkl 3종이 위치하는 폴더.
**용량·비공개 사유로 git 에는 포함하지 않는다(.gitignore).** 팀 내부에서 별도 전달받아 여기에 둔다.

| 파일 | 내용 | 입력 |
|---|---|---|
| `causalforest_models.pkl` | econml CausalForestDML 4대비(1_vs_2·3_vs_4·1_vs_3·2_vs_4) → CATE+CI | 9피처 |
| `xgb_model.pkl` | XGBClassifier 5년 재발·사망 위험 `{'model','features'}` | 36피처 |
| `shap_explainer_1_vs_2.pkl` | 1_vs_2 RandomForest + SHAP `{'rf','explainer','features'}` | 9피처 |

학습 원코드: `../../ml_training/sources/HTE`(causalforest·shap), `../../ml_training/sources/XGB`(xgb).
로드/추론 환경은 `cdss_ml` conda env (py3.11, scikit-learn==1.3.2 + econml·xgboost·shap).
