// DB 환자행(38컬럼 임상 스키마) → EMR UI가 기대하는 환자 객체로 변환.
//
// 범위: "환자 목록·기본정보". 인구통계·병기·치료·예후 날짜는 DB 실제값을 쓴다.
// DB에 없는 항목(대기열·바이탈 일부·AI 분석)은 UI가 깨지지 않도록 안전한 기본값을 채운다.
// AI 필드(cate/shap/cbct/verdict/recommendation)는 아직 /api/cdss 와 미연동 → 중립 placeholder.

const THIS_YEAR = 2026

// 원발암 위치 코드(1직장/2전립선/3여성/4두경부/9기타). 이 코호트는 대부분 4(두경부).
const LOCATION_BY_CODE = { 1: '직장', 2: '전립선', 3: '여성암', 4: '두경부', 9: '기타' }
// 치료 기법 코드(1conformal/2IMRT/3기타) → mockData TECHNIQUES key
const TECHNIQUE_BY_CODE = { 1: 'conformal', 2: 'IMRT', 3: 'etc' }
const RELAPSE_LABEL = { 1: '재발 없음', 2: '국소 재발', 3: '원격 전이' }

// "193701"(YYYYMM) → "1937.01"
const fmtBirth = (yyyymm) => {
  if (!yyyymm || yyyymm.length < 4) return '-'
  const y = yyyymm.slice(0, 4)
  const m = yyyymm.length >= 6 ? yyyymm.slice(4, 6) : '01'
  return `${y}.${m}`
}
// "1986-04-11"(ISO date) → "1986.04.11"
const fmtDate = (iso) => (iso ? iso.replaceAll('-', '.') : null)

const ageFrom = (yyyymm) => {
  const y = yyyymm ? parseInt(yyyymm.slice(0, 4), 10) : NaN
  return Number.isFinite(y) ? THIS_YEAR - y : null
}

// cancerimaging_t/n/m → { t:'T4a', n:'N0', m:'M0' } (값 없으면 빈 문자열)
const stageFrom = (t, n, m) => ({
  t: t ? `T${t}` : '',
  n: n ? `N${n}` : '',
  m: m ? `M${m}` : '',
})

export function mapPatient(row) {
  const age = ageFrom(row.birth_date)
  const bmi =
    row.height && row.weight
      ? Math.round((row.weight / (row.height / 100) ** 2) * 10) / 10
      : '-'

  // 진료기록 — DB의 치료/예후 날짜에서 합성
  const history = [
    row.lastdate && { date: fmtDate(row.lastdate), summary: '마지막 병원 방문일.' },
    row.deathdate && { date: fmtDate(row.deathdate), summary: '사망.' },
    row.relapsedate && {
      date: fmtDate(row.relapsedate),
      summary: RELAPSE_LABEL[row.relapse] ?? '재발 진단.',
    },
    row.treatedate && { date: fmtDate(row.treatedate), summary: '방사선 치료 종료.' },
    row.initialdate && {
      date: fmtDate(row.initialdate),
      summary: `치료 시작 (총선량 ${row.totaldose ?? '-'}Gy / ${row.radiationcnt ?? '-'}회).`,
    },
  ]
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  // 처방내역 — DB의 항암제/수술/방사선에서 합성
  const prescriptions = [
    row.antidrug && { kind: '약품', code: 'CHM', name: `항암: ${row.antidrug}`, qty: 1, days: 1, fee: '급여' },
    row.surgicalmethod && { kind: '수술', code: 'OP', name: row.surgicalmethod, qty: 1, days: 1, fee: '급여' },
    row.totaldose && {
      kind: '치료',
      code: 'RT',
      name: `방사선 ${row.totaldose}Gy / ${row.radiationcnt ?? '-'}fx`,
      qty: row.radiationcnt ?? 1,
      days: 1,
      fee: '급여',
    },
  ].filter(Boolean)

  const stage = stageFrom(row.cancerimaging_t, row.cancerimaging_n, row.cancerimaging_m)
  const site = row.diagnosis || LOCATION_BY_CODE[row.locationcancer] || '두경부'

  return {
    // 표시용 id는 자연키(QIN-HEADNECK-01-xxxx), API 호출용 정수 PK는 따로 보관
    id: row.patient_id,
    numericId: row.id,
    sex: row.sex ?? '-',
    age,
    birth: fmtBirth(row.birth_date),
    location: site,
    histology: row.classification_cancer === 1 ? 'SCC (편평세포암)' : site,
    stage,
    comorbidity: {
      bp: row.bp === 'Y' ? '고혈압' : '정상',
      bs: row.bs === 'Y' ? '당뇨' : '정상',
      smoking: row.sm === 'Y' ? '흡연' : '비흡연',
      familyHistory: row.familyhistory === 'Y' ? '있음' : '없음',
    },
    diagnoses: [{ code: row.cancerimaging ?? '-', name: site, main: true }],
    // 신체계측 — DB의 신장·체중에서. (혈압·맥박·체온은 DB에 없어 제외)
    vitals: {
      height: row.height ?? '-',
      weight: row.weight ?? '-',
      bmi,
    },
    plan: {
      treatment: row.treatmethod >= 1 && row.treatmethod <= 4 ? row.treatmethod : 1,
      technique: TECHNIQUE_BY_CODE[row.treatech] ?? 'etc',
      totalDose: row.totaldose ?? 0,
      fractions: row.radiationcnt ?? 0,
    },
    prescriptions,
    history,

    // ── AI 분석(미연동) — 안전 placeholder. /api/cdss 연동 시 교체 예정 ──
    recurrence: { 1: 0, 2: 0, 3: 0, 4: 0 },
    verdict: 'uncertain',
    cate: [],
    shap: [],
    recommendation: 'AI 분석 미연동 단계입니다. (환자 기본정보만 DB 연결됨)',
    cbct: {
      bbox: [],
      volume: [{ week: 1, volume: 100, current: true }],
      effect: { label: 'warning', score: 0, reasons: ['AI 반응 평가 미연동'], recommendation: '—' },
    },
  }
}
