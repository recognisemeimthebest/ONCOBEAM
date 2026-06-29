import { useEffect, useMemo, useState } from 'react'
import { fetchPatients, fetchActivePatients, predictPatient, fetchMe, setAuthExpiredHandler, getToken, clearToken } from './api'
import { mapPatient } from './lib/mapPatient'
import { matchAll } from './search'
import Login from './components/Login'
import TitleBar from './components/TitleBar'
import TabStrip from './components/TabStrip'
import FilterBar from './components/FilterBar'
import PatientQueue from './components/PatientQueue'
import PatientSummary from './components/PatientSummary'
import ClinicalNote from './components/ClinicalNote'
import StatusBar from './components/StatusBar'
import Modal from './components/Modal'
import EvidencePopup from './components/popups/EvidencePopup'

export default function App() {
  const [authed, setAuthed] = useState(() => !!getToken())
  const [patients, setPatients] = useState([])
  const [loadState, setLoadState] = useState('idle') // idle | loading | ready | error
  const [loadError, setLoadError] = useState(null)

  const [filters, setFilters] = useState([]) // [{ field, value, label }]
  const [patientId, setPatientId] = useState(null)
  const [tab, setTab] = useState('진료실')
  const [modal, setModal] = useState(null) // { type, payload }
  const [triage, setTriage] = useState({}) // id -> { risk_tier, risk_prob, diverges, suggested }
  const [doctor, setDoctor] = useState(null)

  useEffect(() => {
    if (!authed) return
    fetchMe().then((u) => setDoctor(u.username)).catch(() => {})
  }, [authed])

  // 로그인되면 DB에서 환자 목록을 불러와 UI 형태로 매핑한다.
  useEffect(() => {
    if (!authed) return
    let alive = true
    setLoadState('loading')
    // DB 전체 환자 + 영상(라디오믹스) 배정된 활성 환자 교집합만 노출
    Promise.all([fetchPatients(), fetchActivePatients()])
      .then(([rows, active]) => {
        if (!alive) return
        const activeSet = new Set(active.patient_ids)
        const imageByPid = Object.fromEntries(active.items.map((i) => [i.patient_id, i.image_case]))
        const mapped = rows
          .map(mapPatient)
          .filter((p) => activeSet.has(p.id))
          .map((p) => ({ ...p, imageCase: imageByPid[p.id] }))
        setPatients(mapped)
        setPatientId((cur) => cur ?? mapped[0]?.id ?? null)
        setLoadState('ready')
      })
      .catch((err) => {
        if (!alive) return
        setLoadError(err.message)
        setLoadState('error')
        if (!getToken()) setAuthed(false) // 토큰 만료 시 로그인 화면으로
      })
    return () => {
      alive = false
    }
  }, [authed])

  // #5 트리아지 — 활성 환자 전원 권고 prefetch (목록 위험뱃지/정렬용). 환자ID 목록이 바뀔 때만.
  const pidKey = patients.map((p) => p.id).join(',')
  useEffect(() => {
    if (loadState !== 'ready' || !patients.length) return
    let alive = true
    Promise.allSettled(patients.map((p) =>
      predictPatient(p.id).then((d) => [p.id, {
        risk_tier: d.recommendation.risk_tier,
        risk_prob: d.recommendation.risk_prob,
        diverges: d.recommendation.suggested_arm != null && d.recommendation.agrees_with_plan === false,
        suggested: d.recommendation.suggested_arm_label,
      }])
    )).then((rs) => {
      if (!alive) return
      const m = {}
      rs.forEach((r) => { if (r.status === 'fulfilled') { const [id, v] = r.value; m[id] = v } })
      setTriage(m)
    })
    return () => { alive = false }
  }, [loadState, pidKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // #6 권고 수락 → 치료계획에 반영 (오더 연계). DB는 그대로, 표시·트리아지 갱신.
  const adoptPlan = (pid, arm) => {
    setPatients((prev) => prev.map((p) => (p.id === pid ? { ...p, plan: { ...p.plan, treatment: arm } } : p)))
    setTriage((prev) => (prev[pid] ? { ...prev, [pid]: { ...prev[pid], diverges: false } } : prev))
  }

  const patient = patients.find((p) => p.id === patientId) ?? patients[0] ?? null

  // 복합 필터 — 모든 조건 AND
  const results = useMemo(() => patients.filter((p) => matchAll(p, filters)), [patients, filters])

  const addFilter = (f) => {
    setFilters((prev) =>
      prev.some((x) => x.field === f.field && x.value === f.value) ? prev : [...prev, f]
    )
  }
  const removeFilter = (i) => setFilters((prev) => prev.filter((_, idx) => idx !== i))
  const clearFilters = () => setFilters([])

  const openModal = (type, payload) => setModal({ type, payload })
  const closeModal = () => setModal(null)

  const logout = () => {
    clearToken()
    setAuthed(false)
    setPatients([])
    setPatientId(null)
    setLoadState('idle')
  }

  // 세션 만료(401) 시 자동으로 로그인 화면 복귀
  useEffect(() => { setAuthExpiredHandler(() => { setAuthed(false); setLoadState('idle') }) }, [])

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />
  }

  if (loadState === 'loading' || loadState === 'idle') {
    return (
      <div className="flex h-screen items-center justify-center bg-bg text-[18px] text-ink-soft">
        환자 데이터를 불러오는 중…
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg text-ink">
        <p className="text-[18px] text-danger">불러오기 실패: {loadError}</p>
        <button type="button" className="emr-btn-primary emr-btn" onClick={logout}>
          로그인 화면으로
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-screen min-w-[1100px] flex-col bg-bg text-ink">
      <TitleBar onAdd={addFilter} patients={patients} results={results} onPick={setPatientId} onLogout={logout} doctor={doctor} />
      <TabStrip tab={tab} onTab={setTab} />
      <FilterBar
        filters={filters}
        onRemove={removeFilter}
        onClear={clearFilters}
        count={results.length}
        total={patients.length}
      />

      <div className="flex min-h-0 flex-1">
        <PatientQueue patients={results} patientId={patientId} onSelect={setPatientId} triage={triage} />
        {patient ? (
          <>
            <PatientSummary patient={patient} openModal={openModal} triage={triage[patient.id]} />
            <ClinicalNote patient={patient} openModal={openModal} onAdoptPlan={adoptPlan} />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-ink-soft">
            <p className="text-[18px] font-semibold">표시할 환자가 없습니다</p>
            <p className="text-[15px]">
              {patients.length === 0
                ? '영상(라디오믹스)이 배정된 환자가 없습니다. model_service의 seed_radiomics.py를 확인하세요.'
                : '좌측 목록에서 환자를 선택하거나 필터를 해제하세요.'}
            </p>
          </div>
        )}
      </div>

      {patient && <StatusBar patient={patient} count={results.length} />}

      {/* 팝업 — AI 근거 상세 (모듈1 HTE + 모듈2 XGBoost 통합) */}
      {modal?.type === 'evidence' && patient && (
        <Modal
          title="AI 근거 상세 — 치료법 비교(HTE) + 예후예측(XGBoost)"
          subtitle={patient.id}
          width={880}
          onClose={closeModal}
        >
          <EvidencePopup patient={patient} />
        </Modal>
      )}
      {modal?.type === 'method' && (
        <Modal title="AI 방법론 · 모델 · 한계" subtitle="의료진 참고 (해석가능성/신뢰)" width={640} onClose={closeModal}>
          <MethodologyContent />
        </Modal>
      )}
      {modal?.type === 'history' && (
        <Modal title="진료기록 상세" subtitle={modal.payload.date} width={560} onClose={closeModal}>
          <div className="emr-panel p-3 text-[16px] leading-relaxed">{modal.payload.summary}</div>
        </Modal>
      )}
      {modal?.type === 'rx' && (
        <Modal title="처방 상세" subtitle={modal.payload.code} width={520} onClose={closeModal}>
          <DetailGrid
            rows={[
              ['구분', modal.payload.kind],
              ['코드', modal.payload.code],
              ['명칭', modal.payload.name],
              ['수량', String(modal.payload.qty)],
              ['일수', `${modal.payload.days}일`],
              ['수가', modal.payload.fee],
            ]}
          />
        </Modal>
      )}
    </div>
  )
}

function MethodologyContent() {
  const rows = [
    ['권고 로직', '병기·5년위험 가이드라인(NCCN식)을 1차 근거로, 인과모델(CATE)·예후(XGB)·SHAP은 보조 근거로 제시'],
    ['모듈1 (HTE)', 'causalforest_models.pkl — econml CausalForestDML, 4개 치료대비 CATE + Bonferroni 보정 CI'],
    ['모듈2 (예후)', 'xgb_model.pkl — XGBoost 36피처(라디오믹스+임상), 5년 재발·사망 위험확률'],
    ['설명(SHAP)', 'shap_explainer_1_vs_2.pkl — RandomForest TreeSHAP, 변수별 기여도'],
    ['위험 임계', '저 <33% · 중 33–66% · 고 ≥66% (운영 컷오프 — 절대 기준 아님, 연속값 함께 참고)'],
    ['코호트 비교', '동일 진행도(국소진행/조기) 환자군의 DB 실제 재발률(relapse) 관측치'],
    ['한계', '라디오믹스 입력은 데모용 자리표시자(무작위) · 외부검증 전 · 의사결정 보조도구(SaMD)'],
  ]
  return (
    <div className="space-y-2">
      <table className="emr-table">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}><th className="w-28 align-top">{k}</th><td className="leading-relaxed">{v}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="px-1 text-[12px] text-ink-soft">최종 판단과 책임은 의료인에게 있습니다. 권고는 환자별 병기·위험·유사환자 근거를 종합한 참고 정보입니다.</p>
    </div>
  )
}

function DetailGrid({ rows }) {
  return (
    <table className="emr-table">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th className="w-24">{k}</th>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
