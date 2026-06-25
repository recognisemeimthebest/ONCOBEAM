import json
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from econml.metalearners import XLearner

def run(cfg: dict) -> dict:
	"""phase 4: X-learner CATE 추정 + Bootstrap CI (IPTW 가중치 적용, Bonferroni 보정)"""
	out_dir = Path(cfg['paths']['output_dir'])
	xl_cfg = cfg['xlearner']
	n_boot = xl_cfg['n_bootstrap']
	seed = cfg['project']['random_seed']

	with open(out_dir / 'feature_info.json', encoding='utf-8') as f:
		fi = json.load(f)
	with open(out_dir / 'phase3_psm_results.json',encoding='utf-8') as f:
		phase3 = json.load(f)

	features = fi['final_features']
	outcome_col = fi['outcome_col']
	arm_enc = fi['label_encoders']['arm']
	valid_pairs = phase3['valid_pairs']
	trimmed_idx = phase3['trimmed_indices']
	alpha = phase3['bonferroni_alpha']
	ci_lo = (alpha /2) * 100
	ci_hi = (1 - alpha/2) * 100

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

		# trimmed 서브셋 + IPTW 가중치 로드
		idx = trimmed_idx[pair_key]
		df_pair = df_all.iloc[idx].copy()
		df_pair = df_pair[df_pair['arm_enc'].isin([code_a, code_b])].copy()
		df_pair['T'] = (df_pair['arm_enc'] == code_b).astype(int)

		iptw_path = out_dir / f'iptw_weights_{pair_key}.csv'
		iptw_df = pd.read_csv(iptw_path, index_col=0)
		df_pair = df_pair.join(iptw_df, how='left')

		X = df_pair[features].values
		T = df_pair['T'].values
		Y = df_pair[outcome_col].values
		W = df_pair['iptw'].values  # IPTW 샘플 가중치

		if len(np.unique(T)) < 2:
			print(f'[phase 4] {pair_key} - single arm only, skip')
			continue

		# X-learner (sample_weight 지원)
		xl = XLearner(
			models = RandomForestClassifier(n_estimators=200, max_depth=4, class_weight='balanced', random_state=seed),
			propensity_model = LogisticRegression(max_iter=1000, random_state=seed)
		)
		xl.fit(Y, T, X=X)
		cate_point = xl.effect(X)

		# Bootstrap CI
		boot_means = []
		rng = np.random.default_rng(seed)
		n = len(df_pair)
		for _ in range(n_boot):
			bi = rng.integers(0, n, size=n)
			Xb, Tb, Yb, Wb = X[bi], T[bi], Y[bi], W[bi]
			if len(np.unique(Tb)) < 2 :
				continue
			xl_b = XLearner(
				models = RandomForestClassifier(n_estimators=100, max_depth=4, class_weight = 'balanced', random_state=int(rng.integers(999))),
				propensity_model = LogisticRegression(max_iter=500)
			)
			xl_b.fit(Yb, Tb, X=Xb)
			boot_means.append(xl_b.effect(X).mean())

		boot_means = np.array(boot_means)
		mean_cate = float(cate_point.mean())
		ci_low_val = float(np.percentile(boot_means, ci_lo))
		ci_hi_val = float(np.percentile(boot_means, ci_hi))

		if ci_low_val > 0 or ci_hi_val < 0:
			judgment = 'significant'
		elif abs(mean_cate) >= 0.05:
			judgment = 'borderline'
		else:
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
		print(f' 	CATE={mean_cate:+.4f} [{ci_low_val:+.4f}, {ci_hi_val:+.4f}]'
			f' -> {judgment} | SMD={res3["mean_smd_after"]:.3f}')

	output = {
		'valid_pairs': valid_pairs,
		'bonferroni_alpha': alpha,
		'results': results,
	}
	with open(out_dir / 'phase4_xlearner_results.json', 'w', encoding='utf-8') as f:
		json.dump(output, f, ensure_ascii=False, indent=2, default=lambda o: float(o) if hasattr(o, '_float_') else o )

	print(f' [phase 4] done | {len(results)} pairs processed')
	return output
