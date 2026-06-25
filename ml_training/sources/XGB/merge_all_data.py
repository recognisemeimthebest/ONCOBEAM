import pandas as pd
import numpy as np

TRAIN_RAD = "/home/ubuntu/전처리/radiomics_delta.csv"
TRAIN_CLIN = "/home/ubuntu/전처리/RADIO_PRE1_with_event5yr.csv"
VAL_RAD = "/home/ubuntu/전처리/validation/radiomics_delta.csv"
VAL_CLIN = "/home/ubuntu/전처리/validation/RADIO_PRE1_event5yr.csv"
OUT = "/home/ubuntu/전처리/FANAL_DATASET.csv"

LEAK = ['effect','label_5yr', 'event_5yr', 'has_relapse', 'has_death', 'event_date', 'days_to_event', 'days_to_last', 'follow_up_days', 'follow_up_years', 'follow_up_group', 'dti_years', 'relapse', 're;a[sedate', 'dead', 'deathdate', 'deathsign', 'lastdate', 'treatedate', 'initialdate', 'relapsedate','patientid']
def load_merge(rad_path, clin_path):
	rad = pd.read_csv(rad_path)
	clin = pd.read_csv(clin_path, encoding='utf-8-sig')
	rad['pid'] = rad['patientid'].astype(str).str.strip().str.upper()
	clin['pid'] = clin['patientid'].astype(str).str.strip().str.upper()
	clin = clin.drop(columns=[c for c in LEAK if c in clin.columns], errors='ignore')
	rad = rad.drop(columns=['patientid'], errors = 'ignore')
	return rad.merge(clin, on='pid', how='inner')

train = load_merge(TRAIN_RAD, TRAIN_CLIN)
val = load_merge(VAL_RAD, VAL_CLIN)
print(len(train), len(val))

both = pd.concat([train, val], ignore_index=True)
print(len(both))
print(both['label'].value_counts().to_dict())

cat_cols = [c for c in both.columns if both[c].dtype == 'object' and c not in ['pid', 'split']]
print(cat_cols)
both = pd.get_dummies(both, columns=cat_cols, dummy_na=False)
num_cols = both.select_dtypes(include=[np.number]).columns
both[num_cols] = both[num_cols].fillna(both[num_cols].median())

both.to_csv(OUT, index=False, encoding='utf-8-sig')
print()
print(len(both))
print(len(both.columns))
print(OUT)

