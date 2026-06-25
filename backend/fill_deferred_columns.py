# -*- coding: utf-8 -*-
"""[추후입력] 6컬럼을 비율에 맞춰 값으로 채워 clinical_data_schema.csv 에 영구 반영.

배경: 실제 임상값을 확보할 수 없어, 이 합성값이 프로젝트 '최종' 값이 된다.
      따라서 임시 DB 채움이 아니라 CSV(정식 데이터셋)에 직접 써서 재적재에도 보존되게 한다.

⚠️ 합성(가상) 데이터다. 무작위 비율 배정이라 다른 변수·결과와 실제 상관이 없다
   (모델에서 이 컬럼들은 신호가 아닌 잡음으로 작동). 분석 해석 시 유의.

특징: 비율(SPEC)대로 개수 정확 배분(최대잔여법) + patientid 정렬 + 시드 고정 → 결정적.

실행 (backend/):  python fill_deferred_columns.py [csv경로]
파이프라인 순서:  transform_clinical_to_schema.py → fill_deferred_columns.py → load_csv_to_db.py
"""
import hashlib
import random
import sys

import pandas as pd

DEFAULT_CSV = "../data/clinical/clinical_data_schema.csv"
SEED = 42

# CSV 컬럼명 → {값: 가중치}.
SPEC = {
    "classification cancer": {"1": 7, "2": 1, "3": 3},
    "surgical cancerT": {"0": 5, "1": 30, "2": 55, "3": 35, "4": 60},
    "surgical cancerN": {"0": 70, "1": 35, "2": 20, "3": 5},
    "surgical cancerM": {"0": 1},          # 전부 0
    "bp": {"N": 350, "Y": 200},
    "familyhistory": {"N": 500, "Y": 50},
}


def _col_seed(col: str) -> int:
    return int(hashlib.md5(col.encode()).hexdigest(), 16) % (2 ** 32)


def allocate(values_weights: dict, n: int):
    total_w = sum(values_weights.values())
    raw = {v: n * w / total_w for v, w in values_weights.items()}
    counts = {v: int(x) for v, x in raw.items()}
    remainder = n - sum(counts.values())
    for v, _ in sorted(raw.items(), key=lambda kv: kv[1] - int(kv[1]), reverse=True)[:remainder]:
        counts[v] += 1
    out = []
    for v, c in counts.items():
        out.extend([v] * c)
    return out, counts


def main(csv_path=DEFAULT_CSV):
    df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
    n = len(df)
    order = df["patientid"].argsort(kind="stable")  # patientid 정렬 기준으로 결정적 배정

    for col, weights in SPEC.items():
        if col not in df.columns:
            df[col] = ""
        values, counts = allocate(weights, n)
        random.Random(SEED ^ _col_seed(col)).shuffle(values)
        col_vals = [None] * n
        for pos, idx in enumerate(order):
            col_vals[idx] = values[pos]
        df[col] = col_vals
        print(f"{col}: {counts}  (총 {n})")

    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    print(f"CSV 반영 완료 → {csv_path}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV)
