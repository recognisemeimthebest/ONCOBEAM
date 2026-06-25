# -*- coding: utf-8 -*-
"""clinical_data_schema.csv → PostgreSQL(patients 테이블) 적재.

실행 (backend/ 폴더에서):
    python load_csv_to_db.py [csv경로]
기본 csv경로: ../data/clinical/clinical_data_schema.csv
- 테이블이 없으면 생성하고, 기존 patients 데이터는 비운 뒤 다시 적재(멱등).
"""
import sys
from datetime import datetime

import pandas as pd

from database import SessionLocal
from patients.models import Patient

DEFAULT_CSV = "../data/clinical/clinical_data_schema.csv"

# CSV 컬럼명 → 모델 속성명
COLMAP = {
    "patientid": "patient_id",
    "classification cancer": "classification_cancer",
    "surgical cancer": "surgical_cancer",
    "surgical cancerT": "surgical_cancer_t",
    "surgical cancerN": "surgical_cancer_n",
    "surgical cancerM": "surgical_cancer_m",
    "boundarysurgical": "boundary_surgical",
    "involmentrenal": "involmentrenal",
    "lymphrenal": "lymphrenal",
    "surgicalmethod": "surgicalmethod",
    "antidrug": "antidrug",
    "totaldose": "totaldose",
    "radiationcnt": "radiationcnt",
    "radiationperdose": "radiationperdose",
    "treatmethod": "treatmethod",
    "treatech": "treatech",
    "sex": "sex",
    "birth date": "birth_date",
    "height": "height",
    "weight": "weight",
    "diagnosis": "diagnosis",
    "bp": "bp",
    "bs": "bs",
    "sm": "sm",
    "familyhistory": "familyhistory",
    "locationcancer": "locationcancer",
    "cancerimaging": "cancerimaging",
    "cancerimagingT": "cancerimaging_t",
    "cancerimagingN": "cancerimaging_n",
    "cancerimagingM": "cancerimaging_m",
    "initialdate": "initialdate",
    "treatedate": "treatedate",
    "relapse": "relapse",
    "relapsedate": "relapsedate",
    "dead": "dead",
    "deathdate": "deathdate",
    "deathsign": "deathsign",
    "lastdate": "lastdate",
}

INT_FIELDS = {"classification_cancer", "boundary_surgical", "totaldose", "radiationcnt",
              "treatmethod", "treatech", "height", "weight", "locationcancer",
              "relapse", "dead", "deathsign"}
FLOAT_FIELDS = {"radiationperdose"}
BOOL_FIELDS = {"involmentrenal", "lymphrenal"}
DATE_FIELDS = {"initialdate", "treatedate", "relapsedate", "deathdate", "lastdate"}
# 나머지는 문자열 (patient_id, sex, birth_date, diagnosis, bp/bs/sm/familyhistory,
#                surgical_cancer*, cancerimaging*, surgicalmethod, antidrug)


def _empty(v):
    return v is None or str(v).strip() in ("", "nan", "None", "NaN")


def conv(field, v):
    if _empty(v):
        return None
    v = str(v).strip()
    if field in INT_FIELDS:
        return int(float(v))
    if field in FLOAT_FIELDS:
        return float(v)
    if field in BOOL_FIELDS:
        return bool(float(v))
    if field in DATE_FIELDS:
        return datetime.strptime(v.split(".")[0], "%Y%m%d").date()
    return v  # 문자열


def main(csv_path):
    df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
    # 스키마는 Alembic 이 관리한다. 먼저 `alembic upgrade head` 로 테이블을 만들어야 한다.

    db = SessionLocal()
    try:
        deleted = db.query(Patient).delete()
        objs = []
        for _, row in df.iterrows():
            kwargs = {attr: conv(attr, row.get(csv_col))
                      for csv_col, attr in COLMAP.items()}
            if not kwargs.get("patient_id"):
                continue
            objs.append(Patient(**kwargs))
        db.bulk_save_objects(objs)
        db.commit()
        print(f"기존 {deleted}행 삭제 후, {len(objs)}행 적재 완료 → patients")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV)
