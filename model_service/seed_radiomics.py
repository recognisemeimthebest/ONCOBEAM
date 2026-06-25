"""데모용 20명 무작위 라디오믹스 적재 (재현: python seed_radiomics.py).
영상 풀 = SegRap2023 validation 20케이스(segrap_0120~0139)를 환자 20명에 1:1 배정.
대상은 **생존 환자(dead!=1)** 만 — CDSS는 진료 중 환자 대상이므로 사망 환자 제외.
나머지 환자는 EMR에서 숨겨진다(active_patients가 이 20명만 반환)."""
import numpy as np, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from sqlalchemy import create_engine, text
from config import settings
RAD = ["pre_original_glcm_InverseVariance","pre_original_ngtdm_Busyness",
 "post_original_glrlm_HighGrayLevelRunEmphasis","post_original_glszm_HighGrayLevelZoneEmphasis",
 "pre_original_firstorder_10Percentile","pre_original_firstorder_MeanAbsoluteDeviation",
 "pre_original_gldm_DependenceEntropy","pre_original_ngtdm_Coarseness",
 "pre_original_ngtdm_Contrast","delta_original_firstorder_Median"]
SEG = [f"segrap_{i:04d}" for i in range(120,140)]
rng = np.random.RandomState(42)
e = create_engine(settings.database_url)
with e.begin() as c:
    ids = [r[0] for r in c.execute(text(
        "select patient_id from patients where coalesce(dead,0)<>1 order by patient_id"))]
    pick = sorted(rng.choice(ids, size=20, replace=False).tolist())
    c.execute(text("delete from radiomics_features where source='random_demo'"))
    for pid, seg in zip(pick, SEG):
        f = {k: float(round(rng.normal(0,1),5)) for k in RAD}; f["__image_case"] = seg
        c.execute(text("insert into radiomics_features (patient_id,source,version,features) "
                       "values (:p,'random_demo','v1',:f)"), {"p":pid,"f":json.dumps(f)})
print("적재 20명 완료")
