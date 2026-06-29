// DB 환자행(38컬럼 임상 스키마) → EMR UI가 기대하는 환자 객체로 변환.
//
// ⚠️ 표시 익명화: 원본은 출생연도가 1910~40년대·치료일이 1980~90년대라
//   "현재 진료 중 환자"로 보기에 나이가 비현실적(89~113세)이고 날짜가 옛날이다.
//   → 데모용으로 (1) 나이를 '치료 당시 임상나이'로 보정, (2) 치료 타임라인을 최근으로
//      시프트(간격은 보존 = 표준 date-shift 익명화)한다. 환자ID 해시로 결정적이라 일관됨.
//   모델 입력(model_service)은 실제값을 그대로 쓴다 — 익명화는 화면 표시에만 적용.

const VNOW_YEAR = 2026
// 가상 '최근 마지막 내원' 윈도우: 2025-07-01 ~ 2026-06-20
const VWIN_START = Date.UTC(2025, 6, 1)
const VWIN_DAYS = 354
const DAY = 86400000

const LOCATION_BY_CODE = { 1: '직장', 2: '전립선', 3: '여성암', 4: '두경부', 9: '기타' }

// 두경부 원발부위 → ICD-10 (대표코드). diagnosis 문자열 부분일치.
const ICD_RULES = [
  [/tonsil|pharyngeal tonsil/i, 'C09.9'],
  [/base of tongue/i, 'C01'],
  [/oral tongue|^tongue/i, 'C02.9'],
  [/nasopharynx/i, 'C11.9'],
  [/oropharynx|uvula|posterior/i, 'C10.9'],
  [/hypopharynx|pyriform/i, 'C13.9'],
  [/supraglottis|glottis|larynx/i, 'C32.9'],
  [/floor of mouth|buccal|retromolar|alveolar|oral cavity|lip/i, 'C06.9'],
  [/maxillary sinus|paranasal|nasal cavity/i, 'C31.9'],
  [/salivary/i, 'C08.9'],
]
const icdFor = (site) => {
  for (const [re, code] of ICD_RULES) if (re.test(site)) return code
  return 'C76.0' // 두경부 상세불명
}
const TECHNIQUE_BY_CODE = { 1: 'conformal', 2: 'IMRT', 3: 'etc' }
const RELAPSE_LABEL = { 1: '재발 없음', 2: '국소 재발', 3: '원격 전이' }

// 결정적 해시 (FNV-1a 32bit)
const hashStr = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
const parseISO = (s) => (s ? new Date(s) : null)
const fmtD = (d) => `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

const stageFrom = (t, n, m) => ({
  t: t ? `T${t}` : '', n: n ? `N${n}` : '', m: m ? `M${m}` : '',
})

export function mapPatient(row) {
  const h = hashStr(row.patient_id)

  // ── 익명화 타임라인 ────────────────────────────────────────────────
  const dates = {
    initialdate: parseISO(row.initialdate),
    treatedate: parseISO(row.treatedate),
    relapsedate: parseISO(row.relapsedate),
    deathdate: parseISO(row.deathdate),
    lastdate: parseISO(row.lastdate),
  }
  const present = Object.values(dates).filter(Boolean)
  const latestReal = present.length ? new Date(Math.max(...present.map((d) => d.getTime()))) : null
  // 가상 최근 내원일(결정적)
  const vAnchor = VWIN_START + (h % VWIN_DAYS) * DAY
  const delta = latestReal ? vAnchor - latestReal.getTime() : 0
  const shift = (d) => (d ? new Date(d.getTime() + delta) : null)

  const vInitial = shift(dates.initialdate)
  // 치료 당시 임상나이 (실제 치료연도 − 출생연도)
  const birthYear = row.birth_date ? parseInt(String(row.birth_date).slice(0, 4), 10) : NaN
  const birthMonth = String((h % 12) + 1).padStart(2, '0')  // 원본 생월은 합성(01) → 해시로 분산
  const txYearReal = dates.initialdate ? dates.initialdate.getUTCFullYear() : null
  let ageAtTx = (Number.isFinite(birthYear) && txYearReal) ? txYearReal - birthYear : (50 + (h % 25))
  ageAtTx = clamp(ageAtTx, 35, 80)

  // 가상 출생연도 = 가상 치료연도 − 치료당시나이 → 현재 나이/생년 일관 산출
  const vTxYear = vInitial ? vInitial.getUTCFullYear() : (new Date(vAnchor)).getUTCFullYear()
  const vBirthYear = vTxYear - ageAtTx
  const age = clamp(VNOW_YEAR - vBirthYear, 35, 85)
  const birth = `${vBirthYear}.${birthMonth}`

  // 진료기록 — 시프트된 가상 날짜로
  const history = [
    dates.lastdate && { date: fmtD(shift(dates.lastdate)), summary: '경과관찰 외래 내원.' },
    dates.deathdate && { date: fmtD(shift(dates.deathdate)), summary: '사망.' },
    dates.relapsedate && { date: fmtD(shift(dates.relapsedate)), summary: RELAPSE_LABEL[row.relapse] ?? '재발 진단.' },
    dates.treatedate && { date: fmtD(shift(dates.treatedate)), summary: '방사선 치료 종료.' },
    dates.initialdate && {
      date: fmtD(vInitial),
      summary: `치료 시작 (총선량 ${row.totaldose ?? '-'}Gy / ${row.radiationcnt ?? '-'}회).`,
    },
  ].filter(Boolean).sort((a, b) => (a.date < b.date ? 1 : -1))

  const prescriptions = [
    row.antidrug && { kind: '약품', code: 'CHM', name: `항암: ${row.antidrug}`, qty: 1, days: 1, fee: '급여' },
    row.surgicalmethod && { kind: '수술', code: 'OP', name: row.surgicalmethod, qty: 1, days: 1, fee: '급여' },
    row.totaldose && {
      kind: '치료', code: 'RT', name: `방사선 ${row.totaldose}Gy / ${row.radiationcnt ?? '-'}fx`,
      qty: row.radiationcnt ?? 1, days: 1, fee: '급여',
    },
  ].filter(Boolean)

  const bmi = row.height && row.weight
    ? Math.round((row.weight / (row.height / 100) ** 2) * 10) / 10
    : '-'
  const stage = stageFrom(row.cancerimaging_t, row.cancerimaging_n, row.cancerimaging_m)
  const site = row.diagnosis || LOCATION_BY_CODE[row.locationcancer] || '두경부'

  return {
    id: row.patient_id,
    numericId: row.id,
    sex: row.sex ?? '-',
    age,
    birth,
    location: site,
    histology: row.classification_cancer === 1 ? 'SCC (편평세포암)' : site,
    stage,
    comorbidity: {
      bp: row.bp === 'Y' ? '고혈압' : '정상',
      bs: row.bs === 'Y' ? '당뇨' : '정상',
      smoking: row.sm === 'Y' ? '흡연' : '비흡연',
      familyHistory: row.familyhistory === 'Y' ? '있음' : '없음',
    },
    diagnoses: [{ code: icdFor(site), name: `${site} ${stage.t}${stage.n}${stage.m}`.trim(), main: true }],
    vitals: { height: row.height ?? '-', weight: row.weight ?? '-', bmi },
    plan: {
      treatment: row.treatmethod >= 1 && row.treatmethod <= 4 ? row.treatmethod : 1,
      technique: TECHNIQUE_BY_CODE[row.treatech] ?? 'etc',
      totalDose: row.totaldose ?? 0,
      fractions: row.radiationcnt ?? 0,
    },
    prescriptions,
    history,
  }
}
