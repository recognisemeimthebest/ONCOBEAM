import json
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression
from econml.dr import DRLearner
import warnings
warnings.filterwarnings('ignore')

def run(cfg: dict) -> dict:
	"""Phase 4: DR-Learner CATE 추정 + Bootstrap CI (Bonferroni 보정)"""
	out_dir = Path(cfg['paths']['output_dir'])
	xl_cfg = cfg['xlearner']
	n_boot = xl_cfg['n_bootstrap']
	seed = cfg['project']['random_seed']

	with open(out_dir / 'feature_info.json', encoding='utf-8') as f:
		fi = json.load(f)
	with open(out_dir / 'phase3_psm_results.json', encoding='utf-8') as f:
		phase3 = json.load(f)

	features = fi['final_features']
	outcome_col = fi['outcome_col']
	arm_enc = fi['label_encoders']['arm']
	valid_pairs = phase3['valid_pairs']
	trimmed_idx = phase3['trimmed_indices']
	alpha = phase3['bonferroni_alpha']
	ci_lo = (alpha / 2) * 100
	ci_hi = (1 - alpha / 2) * 100

	df_all = pd.concat(
		[pd.read_csv(out_dir / f'preprocessed_{s}.csv') for s in ['train', 'val', 'test']], ignore_index=True
	)

	results = {}
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

		X =df_pair[features].values
		T =df_pair['T'].values
		Y =df_pair[outcome_col].values

		if len(np.unique(T)) < 2:
			print(f' [phase 4] {pair_key} - single arm only, skip')
			continue

		# DR-learner (IPTW 내부 통합)
		dr = DRLearner(
			model_propensity = LogisticRegression(max_iter=1000, random_state=seed),
			model_regression = RandomForestClassifier(n_estimators=200, max_depth=4, class_weight='balanced', random_state=seed),
			model_final = RandomForestRegressor(n_estimators=200, max_depth=4, random_state=seed),
			discrete_outcome=True,
			random_state=seed
		)
		dr.fit(Y, T, X=X)
		cate_point = dr.effect(X)

		# Bootstrap CI
		boot_means = []
		rng = np.random.default_rng(seed)
		n = len(df_pair)
		for _ in range(n_boot):
			bi = rng.integers(0, n, size=n)
			Xb, Tb, Yb = X[bi], T[bi], Y[bi]
			if len(np.unique(Tb)) < 2:
				continue
			dr_b = DRLearner(
				model_propensity = LogisticRegression(max_iter=500),
				model_regression = RandomForestClassifier(n_estimators=100, max_depth=4, class_weight='balanced', random_state=int(rng.integers(9999))),
				discrete_outcome=True,
			)
			try :
				dr_b.fit(Yb, Tb, X=Xb)
				boot_means.append(dr_b.effect(X).mean())
			except Exception:
				continue

		boot_means = np.array(boot_means)
		mean_cate = float(cate_point.mean())
		ci_low_val = float(np.percentile(boot_means, ci_lo))
		ci_hi_val = float(np.percentile(boot_means, ci_hi))

		if ci_low_val > 0 or ci_hi_val < 0 :
			judgment = 'significant'
		elif abs(mean_cate) >= 0.05:
			judgment = 'borderline'
		else :
			judgment = 'nonsig'

		results[pair_key] = {
			'arm_a': str_a,
			'arm_b': str_b,
			'label': label,
			'mean_cate': round(mean_cate, 4),
			'ci_low': round(ci_low_val, 4),
			'ci_high': round(ci_hi_val, 4),
			'bonferroni_alpha': alpha,
			'judgment': judgment,
			'cate_individual': cate_point.tolist(),
			'n_patients': n,
			'balanced_all': res3['balanced_all'],
			'mean_smd_after': res3['mean_smd_after'],
		}
		print(f' [phase 4] {pair_key} ({label})')
		print(f' 	CATE = {mean_cate:.4f} [{ci_low_val:.4f}, {ci_hi_val:.4f}]'
			f'  -> {judgment} | SMD={res3["mean_smd_after"]:.3f}')

	output = {
		'valid_pairs': valid_pairs,
		'bonferroni_alpha': alpha,
		'results': results,
	}
	with open(out_dir / 'phase4_drlearner_results.json', 'w', encoding='utf-8') as f:
		json.dump(output, f, indent=2, default=lambda o: float(o) if hasattr(o, '__float__') else o)

	print(f' [phase 4] done | {len(results)} pairs processed')
	return output
