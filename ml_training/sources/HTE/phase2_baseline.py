import json
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score, f1_score
from xgboost import XGBClassifier

def run(cfg:dict)->dict:
	"""Phase2: 베이스라인 분류 모델 (LR/RF/XGB)"""
	out_dir = Path(cfg['paths']['output_dir'])
	seed = cfg['project']['random_seed']

	with open(out_dir / 'feature_info.json', encoding='utf-8') as f:
		fi = json.load(f)
	features = fi['final_features']
	outcome = fi['outcome_col']

	df_tr = pd.read_csv(out_dir/'preprocessed_train.csv')
	df_va = pd.read_csv(out_dir/'preprocessed_val.csv')
	X_tr, y_tr = df_tr[features].values, df_tr[outcome].values
	X_va, y_va = df_va[features].values, df_va[outcome].values

	models = {
		'LR':LogisticRegression(max_iter=1000, class_weight='balanced', random_state=seed),
		'RF':RandomForestClassifier(n_estimators=200, class_weight='balanced', random_state=seed),
		'XGB':XGBClassifier(n_estimators=200, use_label_encoder=False, eval_metrics='logloss', random_state=seed),
	}
	results = {}
	for name, model in models.items():
		model.fit(X_tr, y_tr)
		prob = model.predict_proba(X_va)[:,1]
		pred = (prob >= 0.5).astype(int)
		results[name] = {
			'auc': round(roc_auc_score(y_va, prob), 4),
			'f1': round(f1_score(y_va,pred),4),
		}
		print(f'[Phase2] {name} | AUC={results[name]["auc"]} | F1={results[name]["f1"]}')

	with open(out_dir / 'phase2_results.json', 'w', encoding='utf-8') as f:
		json.dump(results, f, indent=2)
	return results
