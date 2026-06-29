import { useEffect, useMemo, useState } from 'react'
import { fetchPatients, fetchActivePatients, getToken, clearToken } from './api'
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
      <TitleBar onAdd={addFilter} patients={patients} results={results} onPick={setPatientId} onLogout={logout} />
      <TabStrip tab={tab} onTab={setTab} />
      <FilterBar
        filters={filters}
        onRemove={removeFilter}
        onClear={clearFilters}
        count={results.length}
        total={patients.length}
      />

      <div className="flex min-h-0 flex-1">
        <PatientQueue patients={results} patientId={patientId} onSelect={setPatientId} />
        {patient && <PatientSummary patient={patient} openModal={openModal} />}
        {patient && <ClinicalNote patient={patient} openModal={openModal} />}
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
