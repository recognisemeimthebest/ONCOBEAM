import os, json
import numpy as np
import pandas as pd
import pydicom
import SimpleITK as sitk
from radiomics import featureextractor
import logging

logging.getLogger('radiomics').setLevel(logging.ERROR)

BASE = "/home/ubuntu/영상이미지_validation/"
LIST_CSV = "/home/ubuntu/전처리/RADIO_PRE1.csv"
OUT_CSV = "/home/ubuntu/output/radiomics/radiomics_delta_validation.csv"

def find_bbox(obj):
	if isinstance(obj, dict):
		if 'x' in obj and 'width' in obj:
			return obj
		for v in obj.values():
			r = find_bbox(v)
			if r:
				return r
	elif isinstance(obj, list):
		for v in obj:
			r = find_bbox(v)
			if r:
				return r
	return None

def extract_one(pid, week, extractor):
	img_dir = os.path.join(BASE, pid, 'CBCT', week, 'Image')
	Json_dir = os.path.join(BASE, pid, 'CBCT', week, 'Json')

	dcm_name = [f for f in os.listdir(img_dir) if f.endswith('.dcm')][0]
	ds = pydicom.dcmread(os.path.join(img_dir, dcm_name))
	arr = ds.pixel_array.astype(np.float32)
	slope = float(getattr(ds, 'RescaleSlope',1))
	intercept = float(getattr(ds, 'RescaleIntercept', 0))
	hu = arr * slope + intercept

	jf = [f for f in os.listdir(Json_dir) if f.endswith('.json')][0]
	with open(os.path.join(Json_dir,jf)) as f:
		jdata = json.load(f)
	b = find_bbox(jdata)
	x,y,w,h = int(b['x']), int(b['y']), int(b['width']), int(b['height'])

	mask = np.zeros_like(hu, dtype=np.uint8)
	mask[y:y+h, x:x+w] = 1

	img_sitk = sitk.GetImageFromArray(hu)
	mask_sitk = sitk.GetImageFromArray(mask)

	result = extractor.execute(img_sitk, mask_sitk)
	return {k: float(v) for k, v in result.items() if not k.startswith('diagnostics')}

def main():
	df_list = pd.read_csv(LIST_CSV, encoding='utf-8-sig')
	patient_ids = df_list['patientid'].astype(str).str.strip().str.upper().tolist()
	print(len(patient_ids),'patients')

	extractor = featureextractor.RadiomicsFeatureExtractor()
	extractor.settings['force2D'] =True

	rows = []
	successed, fail = 0,0

	for pid in patient_ids:
		cbct = os.path.join(BASE, pid, 'CBCT')

		if not os.path.isdir(cbct):
			fail += 1
			continue

		weeks = sorted([w for w in os.listdir(cbct) 
			if os.path.isdir(os.path.join(cbct,w)) and w.isdigit()],key=int)
		if len(weeks) < 2:
			fail += 1
			continue
		first_w, last_w = weeks[0], weeks[-1]

		try:
			feat_first = extract_one(pid, first_w, extractor)
			feat_last = extract_one(pid, last_w, extractor)

			rec = {'patientid': pid}
			for k, v in feat_first.items():
				rec['pre_' +k] = v
			for k, v in feat_last.items():
				rec['post_'+k]=v

			for k in feat_first:
				rec['delta_'+ k] = (feat_last[k] - feat_first[k])/ (abs(feat_first[k]) + 1e-6)

			rows.append(rec)
			successed += 1
			if successed %20 == 0:
				print('process:', successed, 'patient completed')
		except Exception as e:
			print('[FAIL]', pid, ':', e)
			fail += 1
	result_df = pd.DataFrame(rows)
	result_df.to_csv(OUT_CSV, index=False, encoding='utf-8-sig')
	print('success:', successed, 'fail:', fail)
	print('number of features:', len(result_df.columns))
	print('save:', OUT_CSV)

if __name__ == '__main__':
	main()


