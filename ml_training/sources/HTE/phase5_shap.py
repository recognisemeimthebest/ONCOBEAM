import json
import numpy as np
import pandas as pd
import shap
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings('ignore')
from pathlib import Path
from sklearn.ensemble import RandomForestRegressor
import pickle

def run(cfg: dict) -> None:
	""" phase 5: SHAP 분석 - 변수별 CATE 기여도"""
	out_dir = Path(cfg['paths']['output_dir'])
	shap_dir = out_dir / 'shap'
	shap_dir.mkdir(parents = True, exist_ok=True)
	seed = cfg['project']['random_seed']

	with open(out_dir / 'feature_info.json', encoding='utf-8') as f:
		fi = json.load(f)
	with open(out_dir/ 'phase4_drlearner_results.json') as f:
		phase4 = json.load(f)

	features = fi['final_features']
	outcome_col = fi['outcome_col']
	arm_enc = fi['label_encoders']['arm']
	valid_pairs = phase4['valid_pairs']
	results = phase4['results']

	with open(out_dir/ 'phase3_psm_results.json') as f:
		phase3 = json.load(f)
	trimmed_idx = phase3['trimmed_indices']

	df_all = pd.concat(
		[pd.read_csv(out_dir/ f'preprocessed_{s}.csv') for s in ['train', 'val', 'test']],
		ignore_index =True
	)


	shap_summary = {}

	for pair_key in valid_pairs:
		res4 = results[pair_key]
		str_a = res4['arm_a']
		str_b = res4['arm_b']
		label = res4.get('label', pair_key)
		code_a = arm_enc[str_a]
		code_b = arm_enc[str_b]

		idx = trimmed_idx[pair_key]
		df_pair = df_all.iloc[idx].copy()
		df_pair = df_pair[df_pair['arm_enc'].isin([code_a, code_b])].copy()
		df_pair['T'] = (df_pair['arm_enc'] == code_b).astype(int)

		X = df_pair[features].values
		T = df_pair['T'].values
		Y = df_pair[outcome_col].values

		# CATE를 target으로 RF 학습 후 SHAP 추출
		# pseudo-outcome: Y*(2T-1) 로 CATE 근사
		pseudo_outcome = Y * (2*T-1)

		rf = RandomForestRegressor(n_estimators=200, max_depth=4, random_state=seed)
		rf.fit(X, pseudo_outcome)

		explainer = shap.TreeExplainer(rf,feature_perturbation='tree_path_dependent')
		shap_values = explainer.shap_values(X)

		save = {
			'rf': rf,
			'explainer': explainer,
			'features': features,
		}
		with open(shap_dir / f'shap_explainer_{pair_key}.pkl', 'wb') as f:
			pickle.dump(save,f)

		# feature importance (mean |SHAP|)
		mean_shap = np.abs(shap_values).mean(axis=0)
		shap_df = pd.DataFrame({
			'feature': features,
			'mean_shap': mean_shap
		}).sort_values('mean_shap', ascending=False)

		shap_summary[pair_key] = shap_df.to_dict(orient='records')

		# 1. Bar plot (feature importance)
		fig, ax = plt.subplots(figsize=(8, max(4, len(features) * 0.4)))
		ax.barh(shap_df['feature'][::-1], shap_df['mean_shap'][::-1], color='#4C72B0',alpha=0.8)
		ax.set_xlabel('mean |SHAP value|')
		ax.set_title(f'SHAP Feature Importance\n{pair_key}')
		plt.tight_layout()
		fig.savefig(shap_dir / f'shap_importance_{pair_key}.png', dpi=150, bbox_inches='tight')
		plt.close(fig)

		# 2. Beeswarm / Summary plot
		fig, ax = plt.subplots(figsize=(9, max(4, len(features) * 0.4)))
		shap.summary_plot(shap_values, X, feature_names=features, show=False, plot_type='dot')
		plt.title(f'SHAP Summary_{pair_key}')
		plt.tight_layout()
		fig.savefig(shap_dir/ f'shap_summary_{pair_key}.png', dpi=150, bbox_inches='tight')
		plt.close(fig)

		print(f' [phase 5] {pair_key} | top3: '
			f' {shap_df["feature"].iloc[0]}({shap_df["mean_shap"].iloc[0]:.4f}), '
			f' {shap_df["feature"].iloc[1]}({shap_df["mean_shap"].iloc[1]:.4f}), '
			f' {shap_df["feature"].iloc[2]}({shap_df["mean_shap"].iloc[2]:.4f})')

	# 전체 요약 저장
	with open(shap_dir/ 'shap_summary.json', 'w') as f:
		json.dump(shap_summary, f, indent=2, default=lambda o: float(o) if hasattr(o, '__float__') else o )

	print(f'\n [phase 5] done - output: {shap_dir}')
	for p in sorted(shap_dir.glob('*.png')):
		print(f' {p.name}')
