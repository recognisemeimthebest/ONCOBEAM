#!/usr/bin/env bash
# CDSS 실모델 서비스 기동 (causalforest / xgb / shap, py3.11 cdss_ml 환경, 포트 8011)
# 전제: PostgreSQL 기동 + radiomics_features(source=random_demo) 적재 완료.
set -e
cd "$(dirname "$0")"
exec ~/miniconda3/envs/cdss_ml/bin/uvicorn app:app --host 0.0.0.0 --port 8011 "$@"
