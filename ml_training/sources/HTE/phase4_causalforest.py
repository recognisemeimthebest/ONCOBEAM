import json
import numpy as np
import pandas as pd
import warnings
warnings.filterwarnings('ignore')
from pathlib import Path
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LogisticRegression
from econml.dml import CausalForestDML


def run(cfg: dict) -> dict:
	"""phase 4: Causal Forest CATE 추정 (개별 환자 CI 직접 제동, Bonferroni 보정)"""
	out_dir = Path(cfg['paths']['output_dir'])
	seed = cfg['project']['random_seed']
	
	with open(out_dir/ 'feature_info.json', encoding='utf-8') as f:
		fi = json.load(f)
	with open(out_dir/ 'phase3_psm_results.json', encoding='utf-8') as f:
		phase3 = json.load(f)

	features = fi['final_features']
	outcome_col = fi['outcome_col']
	arm_enc = fi['label_encoders']['arm']
	valid_pairs = phase3['valid_pairs']
	trimmed_idx = phase3['trimmed_indices']
	alpha = phase3['bonferroni_alpha']

	df_all = pd.concat(
		[pd.read_csv(out_dir / f'preprocessed_{s}.csv') for s in ['train', 'val','test']],
		ignore_index=True
	)

	results = {}
	models = {} # 쌍별 학습된 모델을 저장용 (이후 신규 환자 예측에 사용)

	for pair_key in valid_pairs:
		res3 = phase3['results'][pair_key]
		str_a = res3['arm_a']
		str_b = res3['arm_b']
		code_a = arm_enc[str_a]
		code_b = arm_enc[str_b]
		label = res3.get('label', pair_key)

		idx = trimmed_idx[pair_key]
		df_pair = df_all.iloc[idx].copy()
		df_pair = df_pair[df_pair['arm_enc'].isin([code_a, code_b])].copy()
		df_pair['T'] = (df_pair['arm_enc'] == code_b).astype(int)

		X = df_pair[features].values
		T = df_pair['T'].values
		Y = df_pair[outcome_col].values

		if len(np.unique(T)) < 2:
			print(f' [phase 4] {pair_key} - single arm only, skip')
			continue

		cf = CausalForestDML(
			model_y = RandomForestRegressor(n_estimators=200, max_depth=4, random_state=seed),
			model_t = LogisticRegression(max_iter=1000, random_state=seed),
			discrete_treatment = True,
			n_estimators=500,
			min_samples_leaf = 10,
			max_depth = 5,
			random_state = seed,
			cv=3
		)
		cf.fit(Y, T, X=X)

		cate_point = cf.effect(X)
		# CausalForestDML은 effect_interval()로 개별 CI 직접 제공 
		ci_lower, ci_upper = cf.effect_interval(X, alpha=alpha)

		mean_cate = float(cate_point.mean())
		ci_low_val = float(ci_lower.mean())
		ci_hi_val = float(ci_upper.mean())

		if ci_low_val > 0 or ci_hi_val < 0:
			judgment = 'significant'
		elif abs(mean_cate) >= 0.05:
			judgment = 'borderline'
		else:
			judgment ='nonsig'

		# 개별 환자 단위로 significant 여부 계산 (몇 %가 유의한지)
		individual_sig = ((ci_lower > 0) | (ci_upper < 0))
		pct_significant_patients = float(individual_sig.mean() * 100)

		results[pair_key] = {
			'arm_a': str_a,
			'arm_b': str_b,
			'label': label,
			'mean_cate': round(mean_cate, 4),
			'ci_low': round(ci_low_val, 4),
			'ci_high': round(ci_hi_val, 4),
			'bonferroni_alpha': alpha,
			'judgment': judgment,
			'pct_significant_patients': round(pct_significant_patients, 2),
			'cate_individual': cate_point.tolist(),
			'ci_low_individual': ci_lower.tolist(),
			'ci_high_individual': ci_upper.tolist(),
			'n_patients': len(df_pair),
			'balanced_all': res3['balanced_all'],
			'mean_smd_after': res3['mean_smd_after'],
		}
		models[pair_key] = cf

		print(f' [phase 4] {pair_key} ({label})')
		print(f'	CATE = {mean_cate:.4f} [{ci_low_val:.4f}, {ci_hi_val:.4f}]'
			f'  -> {judgment} | 개별 유의 환자 비율={pct_significant_patients:.1f}%')

	output = {
		'valid_pairs': valid_pairs,
		'bonferroni_alpha': alpha,
		'results': results,
	}

	with open(out_dir / 'phase4_causalforest_results.json','w') as f:
		json.dump(output, f, indent=2, default=lambda o: float(o) if hasattr(o, '__float__') else o)

	# 모델 저장 (신규환자 예측용)
	import pickle
	with open(out_dir / 'causalforest_models.pkl', 'wb') as f:
		pickle.dump(models, f)

	print(f' [phase 4] done | {len(results)} pairs processed | models saved')
	return output
