# -*- coding: utf-8 -*-
"""
Batch_01-and-Batch_02-Clinical-Data_aug242020.xlsx (QIN-HEADNECK 두경부암 임상데이터)를
데이터설명서_1-025-071 (아주대 암환자 방사선치료 데이터) 정형 스키마로 변환.

출력 컬럼 순서(사용자 지정):
patientid, classification cancer, surgical cancer, surgical cancerT, surgical cancerN,
surgical cancerM, boundarysurgical, involmentrenal, lymphrenal, surgicalmethod, antidrug,
totaldose, radiationcnt, radiationperdose, treatmethod, treatech, sex, birth date, height,
weight, diagnosis, bp, bs, sm, familyhistory, locationcancer, cancerimaging, cancerimagingT,
cancerimagingN, cancerimagingM, initialdate, treatedate, relapse, relapsedate, dead,
deathdate, deathsign, lastdate
"""
import pandas as pd
import numpy as np

# 실행: scripts/ 에서  python transform_clinical_to_schema.py
SRC = "../data/clinical/Batch_01-and-Batch_02-Clinical-Data_aug242020.xlsx"
OUT = "../data/clinical/clinical_data_schema.csv"

xl = pd.ExcelFile(SRC)
# 각 시트 첫 행은 중복 헤더 → 제거 후 병합
df = pd.concat([xl.parse(s).iloc[1:] for s in xl.sheet_names], ignore_index=True)


def s(v):
    """문자열 정규화: nan/공백 → None"""
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return None
    t = str(v).strip()
    return t if t and t.lower() != "nan" else None


def ymd(v):
    """날짜 → yyyymmdd 문자열"""
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return None
    try:
        d = pd.to_datetime(v)
        return d.strftime("%Y%m%d")
    except Exception:
        return None


def num(v):
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return None
    try:
        return float(str(v).strip())
    except Exception:
        return None


# ---- 컬럼 그룹 헬퍼 ----
def cols_like(key):
    return [c for c in df.columns if key in c]

POS_NODE_COLS = cols_like("Number of nodes positive")
RT_DOSE_COLS = ["Radiotherapy Procedure, Total radiation dose delivered",
                "Radiotherapy Procedure, Total radiation dose delivered.1",
                "Radiotherapy Procedure, Total radiation dose delivered.2"]
RT_FRAC_COLS = ["Radiotherapy Procedure, Radiation dose per fraction",
                "Radiotherapy Procedure, Radiation dose per fraction.1",
                "Radiotherapy Procedure, Radiation dose per fraction.2"]
RT_DESC_COLS = [c for c in df.columns if "Radiotherapy Procedure, Procedure description" in c]
RT_START_COLS = [c for c in df.columns if "Radiotherapy Procedure, Date treatment started" in c]
RT_STOP_COLS = [c for c in df.columns if "Radiotherapy Procedure, Date treatment stopped" in c]
SURG_DATE_COLS = [c for c in df.columns if c.startswith("Surgery, Date of procedure")]
SURG_DESC_COLS = [c for c in df.columns if c.startswith("Surgery, Procedure Description")]
CHEMO_AGENT_COLS = [c for c in df.columns if "Chemotherapy, Antineoplastic agent" in c]
CHEMO_START_COLS = [c for c in df.columns if "Chemotherapy, Date treatment started" in c]


def first_nonnull(row, cols):
    for c in cols:
        v = row.get(c)
        if s(v) is not None:
            return v
    return None


rows = []
for _, r in df.iterrows():
    o = {}

    # ---------- 식별자 / 위치 ----------
    o["patientid"] = s(r["PatientID"])
    o["locationcancer"] = 4  # 전부 두경부암(QIN-HEADNECK)

    # ---------- 조직병리 ----------
    # [추후입력] 조직형 컬럼은 DB 담당자가 직접 채울 예정 → 공란
    o["classification cancer"] = None
    # 원본에 별도 병리(수술적) 병기 없음 → 공란. 임상/영상 병기는 cancerimaging*로.
    o["surgical cancer"] = None
    o["surgical cancerT"] = None
    o["surgical cancerN"] = None
    o["surgical cancerM"] = None

    # 절제연: Negative→1(완전절제), Positive/Close→2(비완전절제)
    margin = s(r["Tumor Margin Status"])
    if margin == "Negative":
        o["boundarysurgical"] = 1
    elif margin in ("Positive", "Close"):
        o["boundarysurgical"] = 2
    else:
        o["boundarysurgical"] = None

    # 신경(주위) 침범 Boolean ← Perineural invasion finding
    pni = s(r["Perineural invasion finding"])
    o["involmentrenal"] = 1 if pni == "Yes" else (0 if pni == "No" else None)

    # 림프절 침윤 Boolean ← 양성 림프절 수 합 > 0
    pos_vals = [num(r.get(c)) for c in POS_NODE_COLS]
    pos_present = [v for v in pos_vals if v is not None]
    if not pos_present:
        o["lymphrenal"] = None
    else:
        o["lymphrenal"] = 1 if sum(pos_present) > 0 else 0

    # ---------- 치료 ----------
    surg_desc = "; ".join(sorted({s(r[c]) for c in SURG_DESC_COLS if s(r[c])}))
    o["surgicalmethod"] = surg_desc or None

    agents = sorted({s(r[c]) for c in CHEMO_AGENT_COLS if s(r[c])})
    agents = [a for a in agents if a.lower() not in
              ("unknown", "unknown regimen", "regimen unknown")]
    o["antidrug"] = "; ".join(agents) or None

    # 방사선 선량 단위를 Gy로 통일. 원본에 cGy 가 섞여 있어 정규화한다.
    #  - 총선량: 200 초과면 cGy 로 보고 /100 (예: 6720 cGy → 67.2 Gy)
    #  - 회당선량: 100 초과면 cGy 로 보고 /100 (예: 202 cGy → 2.02 Gy)
    dose = num(first_nonnull(r, RT_DOSE_COLS))
    frac = num(first_nonnull(r, RT_FRAC_COLS))
    if dose is not None and dose > 200:
        dose = dose / 100.0
    if frac is not None and frac > 100:
        frac = frac / 100.0
    # 회당선량이 10 Gy 초과로 비현실적이면, 분할횟수를 회당선량 칸에 오기재한 것으로 보고 정정.
    #  (예: 총선량 70 Gy + 칸값 35 → 분할 35회, 회당 70/35 = 2 Gy)
    cnt_override = None
    if dose and frac and frac > 10:
        cnt_override = int(round(frac))
        frac = dose / frac
    o["totaldose"] = int(round(dose)) if dose is not None else None       # Gy(정수)
    o["radiationperdose"] = round(frac, 2) if frac is not None else None   # Gy
    # 분할횟수: 보정값이 있으면 그것을, 없으면 정규화된 Gy 값으로 계산
    o["radiationcnt"] = (cnt_override if cnt_override is not None
                         else (int(round(dose / frac)) if dose and frac else None))

    has_surg = any(s(r[c]) for c in SURG_DESC_COLS + SURG_DATE_COLS)
    has_chemo = any(s(r[c]) for c in CHEMO_AGENT_COLS)
    has_rt = dose is not None or any(s(r[c]) for c in RT_START_COLS)
    # treatmethod: 1방사선 / 2항암방사선 / 3수술+방사선 / 4수술+항암방사선 / 8기타
    if has_surg and has_chemo and has_rt:
        o["treatmethod"] = 4
    elif has_surg and has_rt:
        o["treatmethod"] = 3
    elif has_chemo and has_rt:
        o["treatmethod"] = 2
    elif has_rt:
        o["treatmethod"] = 1
    else:
        o["treatmethod"] = 8

    # treatech: 1 conformal / 2 IMRT / 3 기타 (원본 description은 자유서술이라 대부분 3)
    rt_desc = " ".join([s(r[c]) for c in RT_DESC_COLS if s(r[c])]).lower()
    if "imrt" in rt_desc:
        o["treatech"] = 2
    elif "conformal" in rt_desc:
        o["treatech"] = 1
    else:
        o["treatech"] = 3

    # ---------- 인구통계 ----------
    sex = s(r["Patient's Sex"])
    o["sex"] = sex if sex in ("M", "F") else None
    by = s(r["Patient's Birth Date"])  # 연도만 존재 → 가상 월 01 부여 (YYYYMM)
    o["birth date"] = (by.split(".")[0] + "01") if by else None
    o["height"] = int(round(num(r["Patient's Height"]))) if num(r["Patient's Height"]) else None
    o["weight"] = int(round(num(r["Patient's Weight"]))) if num(r["Patient's Weight"]) else None

    # 진단명(서술형): 원발부위 (+ 조직학적 등급)
    site = s(r["Primary tumor site"])
    grade = s(r["Histological grade finding"])
    diag = site or ""
    if grade and grade not in ("Unknown",):
        diag = f"{diag} ({grade} grade)".strip()
    o["diagnosis"] = diag.replace(",", " ") or None  # ',' 사용불가

    # 병력/생활습관
    o["bp"] = None  # 원본에 고혈압 정보 없음
    dm = s(r["History of Diabetes Mellitus"])
    o["bs"] = "N" if dm == "No" else ("Y" if dm else None)
    sm = s(r["Tobacco Smoking Behavior"])
    o["sm"] = "N" if sm == "No" else ("Y" if sm in ("Yes", "Former") else None)
    o["familyhistory"] = None  # 원본에 가족력 정보 없음

    # ---------- 영상/임상 병기 ----------
    o["cancerimaging"] = s(r["Tumor staging"])
    o["cancerimagingT"] = s(r["T Stage"])
    o["cancerimagingN"] = s(r["N Stage"])
    o["cancerimagingM"] = s(r["M Stage"])

    # ---------- 치료 일자 ----------
    start_dates = [ymd(r[c]) for c in (RT_START_COLS + SURG_DATE_COLS + CHEMO_START_COLS)]
    start_dates = [d for d in start_dates if d]
    o["initialdate"] = min(start_dates) if start_dates else None
    stop_dates = [ymd(r[c]) for c in RT_STOP_COLS]
    stop_dates = [d for d in stop_dates if d]
    o["treatedate"] = max(stop_dates) if stop_dates else None

    # ---------- 예후 ----------
    loc_rec = s(r["Location of first recurrence"])
    fu = s(r["Followup status"])
    rec_date = ymd(r["Date of cancer recurrence"])
    # relapse: 1 재발안함 / 2 국소재발 / 3 원격재발
    distant_kw = ("Distant", "Local/Distant", "Both", "Local/Distant")
    local_kw = ("Local", "Regional", "Locoregional")
    if loc_rec in distant_kw or fu in ("Distant Disease", "Local/Distant"):
        o["relapse"] = 3
    elif loc_rec in local_kw or fu in ("Local Disease",):
        o["relapse"] = 2
    elif rec_date:
        o["relapse"] = 2  # 재발일은 있으나 위치 미상 → 국소로 보수적 처리
    else:
        o["relapse"] = 1
    o["relapsedate"] = rec_date

    death_date = ymd(r["Date of death"])
    o["dead"] = 1 if death_date else 0
    o["deathdate"] = death_date
    cod = s(r["Cause of death"])
    if cod in ("Unrelated", "Complication"):
        o["deathsign"] = 2
    elif cod in ("Distant Disease", "Local Disease", "Local/Distant"):
        o["deathsign"] = 1
    else:
        o["deathsign"] = None
    o["lastdate"] = ymd(r["Follow-up visit date"])

    rows.append(o)


ORDER = ["patientid", "classification cancer", "surgical cancer", "surgical cancerT",
         "surgical cancerN", "surgical cancerM", "boundarysurgical", "involmentrenal",
         "lymphrenal", "surgicalmethod", "antidrug", "totaldose", "radiationcnt",
         "radiationperdose", "treatmethod", "treatech", "sex", "birth date", "height",
         "weight", "diagnosis", "bp", "bs", "sm", "familyhistory", "locationcancer",
         "cancerimaging", "cancerimagingT", "cancerimagingN", "cancerimagingM",
         "initialdate", "treatedate", "relapse", "relapsedate", "dead", "deathdate",
         "deathsign", "lastdate"]

out = pd.DataFrame(rows)[ORDER]
# 유효 PatientID 행만
out = out[out["patientid"].notna() & out["patientid"].str.startswith("QIN")].reset_index(drop=True)
out.to_csv(OUT, index=False, encoding="utf-8-sig")
print(f"저장: {OUT}  ({len(out)} 행 x {len(ORDER)} 컬럼)")
print(out.head(8).to_string())
