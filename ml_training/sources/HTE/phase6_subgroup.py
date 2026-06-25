import json
import numpy as np
import pandas as pd
import pickle
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from pathlib import Path
from scipy import stats


def run(cfg: dict) -> None:
	"""phase 6: causal forest 개별 유의 환자 서브그룹 특성 분석"""
	out_dir = Path(cfg['paths']['output_dir'])
	sub_dir = out_dir / 'subgroup'
	sub_dir.mkdir(parents = True, exist_ok=True)

	with open(out_dir / 'feature_info.json', encoding='utf-8') as f:
		fi = json.load(f)
	with open(out_dir/ 'phase4_causalforest_results.json') as f:
		cf_results = json.load(f)
	with open(out_dir/ 'phase3_psm_results.json') as f:
		phase3 =json.load(f)

	features = fi['final_features']
	outcome_col = fi['outcome_col']
	arm_enc = fi['label_encoders']['arm']
	trimmed_idx = phase3['trimmed_indices']

	df_all =pd.concat(
		[pd.read_csv(out_dir/f'preprocessed_{s}.csv') for s in ['train','val','test']],
		ignore_index=True
	)

	summary_all = {}

	for pair_key, res in cf_results['results'].items():
		str_a = res['arm_a']
		str_b = res['arm_b']
		code_a = arm_enc[str_a]
		code_b = arm_enc[str_b]

		idx = trimmed_idx[pair_key]
		df_pair = df_all.iloc[idx].copy()
		df_pair = df_pair[df_pair['arm_enc'].isin([code_a, code_b])].copy().reset_index(drop=True)
		ci_low = np.array(res['ci_low_individual'])
		ci_high = np.array(res['ci_high_individual'])
		cate = np.array(res['cate_individual'])

		# 개별적으로 유의한 환자 마스크
		sig_mask = (ci_low > 0) | (ci_high < 0)
		n_sig = int(sig_mask.sum())

		if n_sig == 0:
			print(f' [phase 6] {pair_key} - 유의한 개별 환자 없음, 스킵')
			continue

		df_pair['significant'] = sig_mask
		df_pair['cate_value'] = cate

		# 유의군 vs 비유의군 특성 비교 (t-test, mean 차이)
		comparison = {}
		for f in features:
			sig_vals = df_pair.loc[df_pair['significant'],f]
			nonsig_vals = df_pair.loc[~df_pair['significant'],f]
			if sig_vals.std() == 0 and nonsig_vals.std() == 0:
				continue
			tstat, pval = stats.ttest_ind(sig_vals, nonsig_vals, equal_var=False)
			comparison[f] = {
				'mean_significant': round(float(sig_vals.mean()), 3),
				'mean_nonsignificant': round(float(nonsig_vals.mean()), 3),
				'p_value': round(float(pval), 4),
			}

		comparison_sorted = dict(sorted(comparison.items(), key=lambda x: x[1]['p_value']))
		summary_all[pair_key] = {
			'n_total': len(df_pair),
			'n_significant': n_sig,
			'pct_significant': round(n_sig/len(df_pair) * 100, 1),
			'mean_cate_significant': round(float(cate[sig_mask].mean()), 4),
			'mean_cate_nonsignificant': round(float(cate[~sig_mask].mean()), 4),
		}

		print(f'\n [phase 6] {pair_key}|유의 환자 n={n_sig} ({n_sig/len(df_pair)*100:.1f}%)')
		print(f'	유의군 평균 CATE={cate[sig_mask].mean():.4f} |'
			f'비유의군 평균 CATE={cate[~sig_mask].mean():.4f}')
		top_feats = list(comparison_sorted.items())[:3]
		for fname, fval in top_feats:
			print(f'	{fname}: sig={fval["mean_significant"]} vs '
				f'nonsig={fval["mean_nonsignificant"]} (p={fval["p_value"]})')

		# 시각화 : 유의군 vs 비유의군 주요 변수 비교
		top3_names = [f[0] for f in top_feats]
		fig, axes = plt.subplots(1, len(top3_names), figsize=(5*len(top3_names), 4))
		if len(top3_names) == 1:
			axes = [axes]
		for ax, fname in zip(axes, top3_names):
			data = [df_pair.loc[~df_pair['significant'],fname],
				df_pair.loc[df_pair['significant'], fname]]
			bp = ax.boxplot(data, patch_artist=True, labels=['Non-significant', 'Significant'])
			for patch, color in zip(bp['boxes'],['#4C72B0', '#DD8452']):
				patch.set_facecolor(color)
				patch.set_alpha(0.6)
			ax.set_title(fname)
		fig.suptitle(f'Subgroup Comparison: {pair_key}', fontsize=13, fontweight='bold')
		plt.tight_layout()
		fig.savefig(sub_dir / f'subgroup_{pair_key}.png', dpi=150, bbox_inches='tight')

	with open(sub_dir/'subgroup_summary.json', 'w') as f:
		json.dump(summary_all, f, indent=2)

	print(f'\n [phase 6] done - output:{sub_dir}')
	for p in sorted (sub_dir.glob('*.png')):
		print(f'	{p.name}')
	
