import json
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

def run(cfg: dict) -> dict:
	"""phase 1:데이터 로드 + 전처리+  분할"""
	out_dir = Path(cfg['paths']['output_dir'])
	out_dir.mkdir(parents=True, exist_ok=True)

	df = pd.read_csv(cfg['paths']['data_file'])
	cols = cfg['columns']
	feats = cfg['features']

	# keep_arms 필터링 (treatmethod 1~4만 유지)
	keep = cfg['treatment'].get('keep_arms',None)
	if keep:
		df = df[df[cols['treatment']].isin(keep)].reset_index(drop=True)
		print(f'[Phase1] keep_arms 필터 후 n={len(df)}')
	# 추적기간 최소 기준 필터링 (2년 이상)
	min_follow_up = cfg.get('min_follow_up_years', 2.0)
	df = df[df['follow_up_years'] >= min_follow_up].reset_index(drop=True)
	print(f' [phase 1] 추적기간 {min_follow_up}년 이상 필터 후 n ={len(df)}')

	# 결측치 처리
	missing_threshold = cfg.get('missing_threshold',0.8)

	# 후보 피처 목록 (인코딩 전 원본 컬럼 기준)
	candidate_continuous = feats.get('continuous', [])
	candidate_categorical = feats.get('categorical',[])
	candidate_binary = feats.get('binary',[])
	all_candidates = candidate_continuous + candidate_categorical + candidate_binary

	# 결측률 계산 -> 80% 이상이면 변수 제외
	missing_rate = df[all_candidates].isnull().mean()
	dropped_cols = missing_rate[missing_rate >= missing_threshold].index.tolist()
	kept_cols = missing_rate[missing_rate < missing_threshold].index.tolist()

	if dropped_cols:
		print(f'[Phase 1] 결측 80% 이상 변수 제외: {dropped_cols}')

	# 제외 변수를 각 타입 목록에서도 제거
	candidate_continuous = [c for c in candidate_continuous if c in kept_cols]
	candidate_categorical = [c for c in candidate_categorical if c in kept_cols]
	candidate_binary = [c for c in candidate_binary if c in ketp_cols]

	# 결측 80% 미만이면 수치형 중앙값, 범주형 최빈값으로 대체
	for col in candidate_continuous + candidate_binary:
		if df[col].isnull().any():
			median_val = df[col].median()
			df[col] = df[col].fillna(median_val)
	for col in candidate_categorical:
		if df[col].isnull().any():
			mode_val = df[col].mode()[0]
			df[col] = df[col].fillna(mode_val)

	# outcome / treatment 컬럼 결측은 행 제거
	essential = [cols['outcome'], cols['treatment']]
	n_before = len(df)
	df = df.dropna(subset=essential).reset_index(drop=True)
	if len(df) < n_before:
		print(f'[Phase1] outcome/treatment 결측행제거: {n_before - len(df)}건')

	# 이상치 처리
	# 1) 도메인 기반 범위 클리핑 (임상적으로 불가능한 값 -> NaN -> 중앙값으로 재 대체)
	domain_bounds = {
		'weight': (30, 220), # kg
		'age_at_tx': (10, 110), # 세
		'follow_up_years': (0,30), #년 (음수 방지)
		'dti_years': (0, 5), # 치료 소요기간
	}
	for col, (lo, hi) in domain_bounds.items():
		if col in df.columns:
			out_mask = (df[col] < lo) | (df[col] > hi)
			n_out = out_mask.sum()
			if n_out > 0 :
				df.loc[out_mask, col] = np.nan
				df[col] = df[col].fillna(df[col].median())
				print(f'[Phase1] 도메인 이상치 {col}:{n_out}건 -> 중앙값 대체')

	# IQR 기반 클리핑 (방사선 선량 변수 등 도메인범위 불명확한 수치형)
	iqr_cols = [c for c in candidate_continuous if c in df.columns and c not in domain_bounds]
	for col in iqr_cols:
		q1, q3 = df[col].quantile(0.25), df[col].quantile(0.75)
		iqr = q3 - q1
		lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
		out_mask = (df[col] < lo) | (df[col]> hi)
		n_out = out_mask.sum()
		if n_out > 0:
			df[col] = df[col].clip(lower=lo, upper=hi)
			print(f'[Phase1] IQR클리핑 {col}: {n_out}건 -> [{lo:.2f},{hi:.2f}]')

	# 범주형 인코딩
	label_encoders = {}
	for col in candidate_categorical:
		if col in df.columns:
			le = LabelEncoder()
			df[col+'_enc'] = le.fit_transform(df[col].astype(str))
			label_encoders[col] = dict (zip(le.classes_.tolist(),le.transform(le.classes_).tolist())) 
	# 치료 arm 인코딩
	le_arm = LabelEncoder()
	df['arm_enc'] = le_arm.fit_transform(df[cols['treatment']].astype(str))
	label_encoders['arm'] = dict(zip(le_arm.classes_.tolist(), le_arm.transform(le_arm.classes_).tolist()))
	
	# 최종 피처 목록
	final_features = (
		candidate_continuous + candidate_binary + [c + 'enc_' for c in candidate_categorical if c + '_enc' in df.columns]

	)
	final_features = [f for f in final_features if f in df.columns]
	df_clean = df.reset_index(drop=True)
	print(f'[Phase1] 최종 n={len(df_clean)}|사용 features = {final_features}')

	# 클래스 가중치
	y = df_clean[cols['outcome']]
	class_counts = y.value_counts().to_dict()
	total = len(y)
	total_weight = {int(k): round(total / (2*v), 4) for k, v in class_counts.items()}

	# train/val/test 분할 (70/15/15
	idx = np.arange(len(df_clean))
	idx_tv, idx_test = train_test_split(idx, test_size=0.15, stratify=y, random_state=cfg['project']['random_seed'])
	idx_train, idx_val = train_test_split(idx_tv, test_size=0.15/0.85, stratify=y.iloc[idx_tv], random_state=cfg['project']['random_seed'])

	for name, idxs in [('train', idx_train), ('val',idx_val), ('test',idx_test)]:
		df_clean.iloc[idxs].to_csv(out_dir/f'preprocessed_{name}.csv', index=False)

	feature_info = {
		'final_features': final_features,
		'label_encoders': label_encoders,
		'class_weight': total_weight,
		'outcome_col': cols['outcome'],
		'n_total': len(df_clean),
	}
	with open(out_dir/'feature_info.json', 'w', encoding='utf-8') as f:
		json.dump(feature_info, f, ensure_ascii=False, indent=2)

	print(f'[Phase1] 완료 | n={len(df_clean)} | features={final_features}')
	return feature_info
