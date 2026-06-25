import json
import numpy as np
import pandas as pd
from pathlib import  Path
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

def compute_smd(x0, x1, w0=None, w1=None):
	"""가중치 적용 SMD 계산 (가중치 없으면 단순 SMD)"""
	if w0 is None or w1 is None:
		m0, m1 = x0.mean(), x1.mean()
		v0, v1 = x0.std()**2, x1.std()**2
	else:
		m0 = np.average(x0, weights = w0)
		m1 = np.average(x1, weights = w1)
		v0 = np.average((x0-m0)**2, weights=w0)
		v1 = np.average((x1-m1)**2, weights=w1)
	pooled = np.sqrt((v0 + v1) /  2)
	return float(abs(m1-m0) / pooled) if pooled > 0 else 0.0

def compute_iptw(ps: np.ndarray, T:np.ndarray, clip_lo:float, clip_hi:float) -> np.ndarray:
	""" 
	ATE기준 IPTW 가중치
		처치군(T=1): w=1/ps
		대조군(T=0): W=1/(1-ps)
	PS를clip_lo~clip_hi로 먼저trimming한 뒤 계산
	"""
	ps_clipped = np.clip(ps, clip_lo, clip_hi)
	weights = np.where(T == 1, 1.0 / ps_clipped, 1.0 / (1.0 - ps_clipped))
	return weights

def run(cfg: dict) -> dict:
	"""
	Phase3 : PS 추정 + IPTW 가중치 계산 + 공변량 밸런스 확인
	config의 valid_pairs에 명시된 4쌍만 처리:
		1 vs 2 (항암제 추가 효과)
		3 vs 4 (수술 후 항암제 추가 효과)
		1 vs 3 (수술 추가 효과)
		2 vs 4 (항암 기반 수술 추가 효과)
	"""
	out_dir = Path(cfg['paths']['output_dir'])
	psm_cfg = cfg['psm']
	ps_low = psm_cfg['ps_low']
	ps_high = psm_cfg['ps_high']
	smd_thr = psm_cfg['smd_threshold']
	seed = cfg['project']['random_seed']

	with open(out_dir / 'feature_info.json', encoding='utf-8') as f:
		fi = json.load(f)
	features = fi['final_features']
	arm_enc = fi['label_encoders']['arm']
	arm_dec = {v: k for k, v in arm_enc.items()}

	df_all = pd.concat(
		[pd.read_csv(out_dir / f'preprocessed_{s}.csv') for s in ['train', 'val', 'test']], ignore_index=True
	)

	raw_pairs = cfg['treatment']['valid_pairs']
	pair_labels = cfg['treatment'].get('pair_labels',{})

	psm_summary = {}
	psm_indices = {} # trimming 후 인덱스 (IPTW는 전체 사용하지만 극단 PS 제거)

	for pair in raw_pairs:
		str_a, str_b = str(pair[0]), str(pair[1])
		key = f'{str_a}_vs_{str_b}'

		if str_a not in arm_enc or str_b not in arm_enc:
			print(f'[phase3] {key} - arm 코드 없음, 스킵')
			continue

		code_a = arm_enc[str_a]
		code_b = arm_enc[str_b]

		sub = df_all[df_all['arm_enc'].isin([code_a, code_b])].copy()
		if len(sub) == 0:
			print(f'[phase3] {key} - arm 코드 없음, 스킵')
			continue
		T = (sub['arm_enc'] == code_b).astype(int).values
		X = StandardScaler().fit_transform(sub[features].values)

		# PS 추정 
		lr = LogisticRegression(max_iter = 1000, random_state=seed)
		lr.fit(X, T)
		ps = lr.predict_proba(X)[:,1]
		sub = sub.copy()
		sub['ps'] = ps
		sub['T'] = T

		# Overlap trimming (극단 PS 제거) 
		trim_mask = (ps >= ps_low) & (ps <= ps_high)
		trimmed = sub[trim_mask].copy()
		n_trimmed = int((~trim_mask).sum())

		# IPTW 가중치 계산 (trimmed 서브셋 기준)
		ps_trim = trimmed['ps'].values
		T_trim = trimmed['T'].values
		weights = compute_iptw(ps_trim, T_trim, ps_low, ps_high)
		trimmed['iptw'] = weights

		# SMD 계산: 보정 전 (원본) VS 보정 후(IPTW가중치 적용)
		smd_before, smd_after = {}, {}
		for f in features:
			x0_raw = sub.loc[sub['T'] == 0, f].values
			x1_raw = sub.loc[sub['T'] == 1, f].values
			smd_before[f] = round(compute_smd(x0_raw, x1_raw), 4)

			x0_w = trimmed.loc[trimmed['T'] == 0, f].values
			x1_w = trimmed.loc[trimmed['T'] == 1, f].values
			w0 = weights[T_trim == 0]
			w1 = weights[T_trim == 1]
			smd_after[f] = round(compute_smd(x0_w, x1_w, w0, w1), 4)

		balanced = all(v < smd_thr for v in smd_after.values())
		unbalanced_feats = [f for f, v in smd_after.items() if v >= smd_thr]

		if not balanced:
			print(f'[phase3] {key} - 배런스 미달 변수: {unbalanced_feats}')
		psm_indices[key] = trimmed.index.tolist()
		psm_summary[key] = {
			'arm_a': str_a,
			'arm_b': str_b,
			'label': pair_labels.get(key,key),
			'n_original': len(sub),
			'n_after_trim': len(trimmed),
			'n_trimmed_out': n_trimmed,
			'smd_before':  smd_before,
			'smd_after_iptw':  smd_after,
			'balanced_all':  balanced,
			'unbalanced_feats':  unbalanced_feats,
			'mean_smd_before':  round(float(np.mean(list(smd_before.values()))),4),
			'mean_smd_after':  round(float(np.mean(list(smd_after.values()))), 4),
		}

		# IPTW 가중치 저장 (phase4 에서 사용)
		trimmed[['iptw']].to_csv(
			out_dir / f'iptw_weights_{key}.csv', index=True
		)

		print(f'[phase3] {key} | n{len(sub)} -> {len(trimmed)}'
			f'|mean SMD {psm_summary[key]["mean_smd_before"]:.3f}'
			f'-> {psm_summary[key]["mean_smd_after"]:.3f}'
			f'|balanced={balanced}')

	n_valid = len(psm_summary)
	bonferroni = round(cfg['xlearner']['alpha'] / n_valid, 6) if n_valid > 0 else None

	output = {
		'valid_pairs':  list (psm_summary.keys()),
		'ps_trim_range': [ps_low, ps_high],
		'smd_threshold': smd_thr,
		'results':    psm_summary,
		'trimmed_indices':   psm_indices,
		'bonferroni_alpha':  bonferroni,
	}

	with open(out_dir / 'phase3_psm_results.json', 'w', encoding='utf-8') as f:
		json.dump(output, f, ensure_ascii=False, indent=2)

	print(f'[phase3] done| pairs={n_valid} | Bonferroni alpha={bonferroni}')
	return output 
