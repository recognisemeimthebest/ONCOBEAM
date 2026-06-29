import { useEffect, useState } from 'react'
import { predictPatient, recordDecision, fetchLatestDecision } from '../api'

// 진료화면 상단 AI 권고 배너 (point-of-care) + closed-loop + 코호트/스토리/위험스펙트럼.
const RISK_TONE = {
  고위험: { bg: '#fbe6e8', fg: '#b3303d', bd: '#f1c4c9', dot: '#d62839' },
  중등도: { bg: '#fdf2e0', fg: '#b8730a', bd: '#f3dcae', dot: '#d98300' },
  저위험: { bg: '#e6f5ec', fg: '#1f7a44', bd: '#bce3cc', dot: '#1f9d55' },
}
const fmtTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso); const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function AiRecommendationBanner({ patient, openModal, onAdopt }) {
  const [pred, setPred] = useState(null)
  const [error, setError] = useState(null)
  const [decision, setDecision] = useState(null)
  const [mode, setMode] = useState('idle')
  const [reason, setReason] = useState('')

  useEffect(() => {
    let alive = true
    setPred(null); setError(null); setDecision(null); setMode('idle'); setReason('')
    predictPatient(patient.id).then((d) => alive && setPred(d)).catch((e) => alive && setError(e.message))
    fetchLatestDecision(patient.id).then((d) => alive && setDecision(d.decision)).catch(() => {})
    return () => { alive = false }
  }, [patient.id])

  const rec = pred?.recommendation
  const submit = async (action) => {
    if (action === 'override' && !reason.trim()) return
    setMode('busy')
    try {
      await recordDecision({
        patient_id: patient.id, action,
        recommended_arm: rec.suggested_arm, recommended_label: rec.suggested_arm_label,
        chosen_arm: action === 'accept' ? rec.suggested_arm : rec.current_arm,
        chosen_label: action === 'accept' ? rec.suggested_arm_label : rec.current_arm_label,
        reason: action === 'override' ? reason.trim() : null,
        risk_tier: rec.risk_tier, risk_prob: rec.risk_prob, headline: rec.headline,
      })
      if (action === 'accept' && rec.suggested_arm) onAdopt?.(rec.suggested_arm)  // #6 오더 반영
      const fresh = await fetchLatestDecision(patient.id)
      setDecision(fresh.decision); setMode('idle'); setReason('')
    } catch (e) { setError(e.message); setMode('idle') }
  }

  const Shell = ({ children, style }) => (
    <div className="emr-panel m-1.5 mb-0 min-h-[150px] border-l-4 p-2.5" style={style}>{children}</div>
  )
  if (error) return <Shell style={{ borderLeftColor: '#b3303d' }}><p className="text-[15px] text-danger">AI 권고 실패: {error}</p></Shell>
  if (!rec) return <Skeleton />

  const tone = RISK_TONE[rec.risk_tier] ?? RISK_TONE.중등도
  const diverges = rec.suggested_arm != null && rec.agrees_with_plan === false
  const verdict = rec.suggested_arm == null
    ? { icon: '•', word: '참고', sub: '판정 보류', bg: '#eef2f7', fg: '#3a4658', bd: '#d7dee7' }
    : diverges
      ? { icon: '⚠', word: '재검토 권고', sub: `현재 ${rec.current_arm_label ?? '—'} 와 상이`, bg: '#fdf2e0', fg: '#b8730a', bd: '#f3dcae' }
      : { icon: '✓', word: '계획 적정', sub: '현재 계획과 일치', bg: '#e6f5ec', fg: '#1f7a44', bd: '#bce3cc' }

  // #2 해석 스토리 (익명화된 표시값으로 구성 — 환자에게 설명하듯)
  const sexKo = patient.sex === 'M' ? '남' : patient.sex === 'F' ? '여' : ''
  const site = String(patient.location).split(' ')[0]
  const stageTxt = `${patient.stage.t}${patient.stage.n}${patient.stage.m}`
  const story = `${patient.age}세 ${sexKo} · ${site} ${stageTxt} → ${rec.suggested_arm_label ?? '표준치료'} 권고. 5년 재발·사망 위험 ${(rec.risk_prob * 100).toFixed(0)}%(${rec.risk_tier}).`
  const co = pred.cohort

  return (
    <Shell style={{ borderLeftColor: verdict.fg, background: '#fbfdff' }}>
      {/* 히어로 */}
      <div className="flex items-center gap-3">
        <div className="flex w-[88px] shrink-0 flex-col items-center justify-center rounded-md py-2"
          style={{ background: verdict.bg, color: verdict.fg, border: `1px solid ${verdict.bd}` }}>
          <span className="text-[24px] font-extrabold leading-none">{verdict.icon}</span>
          <span className="mt-1 whitespace-nowrap text-[13px] font-bold">{verdict.word}</span>
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
            <span className="h-2 w-2 rounded-full" style={{ background: tone.dot }} />AI 의사결정 지원
          </span>
          <button type="button" onClick={() => openModal('method')} title="방법론·모델·한계"
            className="ml-1 rounded-full border border-line px-1.5 text-[11px] font-bold text-ink-soft hover:bg-[#eaf2fd]">ⓘ</button>
          <div className="mt-0.5 truncate text-[21px] font-extrabold leading-tight text-ink">권고: {rec.suggested_arm_label ?? '표준 치료 유지'}</div>
          <div className="text-[14px] text-ink-soft">{verdict.sub} · 병기 {rec.stage ?? '—'}</div>
        </div>
        <button type="button" onClick={() => openModal('evidence')}
          className="shrink-0 self-start text-[14px] font-semibold text-accent hover:underline">근거 상세 ▸</button>
      </div>

      {/* #2 스토리 한 줄 */}
      <p className="mt-2 rounded bg-[#f1f6fc] px-2 py-1 text-[14px] leading-snug text-ink">🗣 {story}</p>

      {/* #3+#4 위험 스펙트럼 바 */}
      <RiskSpectrum prob={rec.risk_prob} tier={rec.risk_tier} onClick={() => openModal('evidence')} />

      {/* #1 코호트 비교 */}
      {co && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-line-soft bg-panel-alt px-2 py-1 text-[13px]">
          <span className="font-semibold text-ink-soft">유사 환자(코호트)</span>
          <span>{co.bucket} · <b className="tabular">{co.n_total}</b>명</span>
          <span className="text-ink-soft">|</span>
          <span>권고군({co.suggested_arm_label}) 실제 재발 <b className="tabular text-accent">{co.recur_suggested ?? '—'}%</b> <span className="text-ink-soft">(n={co.n_suggested})</span></span>
          <span className="text-ink-soft">vs 그 외 <b className="tabular">{co.recur_other ?? '—'}%</b></span>
          {co.small_sample && <span className="rounded-sm bg-[#fdf2e0] px-1 text-[11px] text-[#b8730a]">표본 적음</span>}
        </div>
      )}

      {/* 근거 + 신뢰도 */}
      <div className="mt-2 flex flex-wrap items-start gap-x-3 gap-y-1">
        <span className="rounded-sm border border-line px-1.5 py-0.5 text-[12px] text-ink-soft">신뢰도 {rec.confidence} · 인과근거 {rec.n_significant}/4</span>
        <ul className="flex-1 space-y-0.5">
          {(rec.rationale ?? []).slice(0, 3).map((r, i) => (
            <li key={i} className="flex gap-1.5 text-[14px] text-ink"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-soft" />{r}</li>
          ))}
        </ul>
      </div>

      {rec.caveats?.length > 0 && (
        <p className="mt-1.5 flex gap-1 text-[12px] leading-relaxed text-ink-soft"><span>⚠️</span><span>{rec.caveats.join(' · ')}</span></p>
      )}

      {/* 의사 결정 */}
      <div className="mt-2 border-t border-line-soft pt-2">
        {decision ? (
          <div className="flex flex-wrap items-center gap-2 text-[14px]">
            <span className="rounded-sm px-2 py-0.5 font-bold" style={decision.action === 'accept' ? { background: '#e6f5ec', color: '#1f7a44' } : { background: '#fdf2e0', color: '#b8730a' }}>
              {decision.action === 'accept' ? '✓ 수락됨' : '✎ 기각됨'}
            </span>
            <span className="text-ink-soft">{decision.username} · {fmtTime(decision.created_at)}
              {decision.action === 'override' && decision.chosen_label && (<> · 선택: <b className="text-ink">{decision.chosen_label}</b></>)}</span>
            {decision.reason && <span className="text-ink">사유: {decision.reason}</span>}
            <button type="button" onClick={() => { setDecision(null); setMode('idle') }} className="ml-auto text-[13px] text-accent hover:underline">다시 결정</button>
          </div>
        ) : mode === 'override' ? (
          <div className="space-y-1.5">
            <p className="text-[14px] font-semibold text-ink-soft">기각 사유 (필수)</p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: T3N1, 전신상태 양호 → 표준 CCRT 유지"
              className="h-14 w-full resize-none rounded border border-line bg-white p-2 text-[15px] outline-none focus:border-accent" />
            <div className="flex items-center gap-1.5">
              <button type="button" disabled={!reason.trim()} onClick={() => submit('override')} className="emr-btn-primary emr-btn disabled:opacity-50">기각 기록</button>
              <button type="button" onClick={() => { setMode('idle'); setReason('') }} className="emr-btn">취소</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-ink-soft">본 권고는 의료인의 판단을 보조하며, 최종 결정·책임은 의료인에게 있습니다.</span>
            <div className="ml-auto flex items-center gap-1.5">
              <button type="button" disabled={mode === 'busy' || rec.suggested_arm == null} onClick={() => submit('accept')}
                className="emr-btn rounded border border-[#bce3cc] bg-[#e6f5ec] font-semibold text-[#1f7a44] disabled:opacity-50">✓ 수락 · 계획 반영</button>
              <button type="button" disabled={mode === 'busy'} onClick={() => setMode('override')}
                className="emr-btn rounded border border-[#f3dcae] bg-[#fdf2e0] font-semibold text-[#b8730a]">✎ 기각 / 다르게 결정</button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}

// #3+#4 위험 스펙트럼: 0~100% 연속값 + 저/중/고 구역 + 환자 위치 마커
function RiskSpectrum({ prob, tier, onClick }) {
  const pct = Math.max(0, Math.min(100, prob * 100))
  return (
    <button type="button" onClick={onClick} className="mt-2 block w-full text-left">
      <div className="mb-0.5 flex items-center justify-between text-[12px] text-ink-soft">
        <span>5년 재발·사망 위험 스펙트럼</span>
        <span className="tabular font-semibold text-ink">{pct.toFixed(0)}% · {tier}</span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full"
        style={{ background: 'linear-gradient(90deg,#cdebd8 0%,#cdebd8 33%,#fbe7c4 33%,#fbe7c4 66%,#f4c9cf 66%,#f4c9cf 100%)' }}>
        {/* 임계 기준선 33/66 */}
        <div className="absolute top-0 h-full w-px bg-white/70" style={{ left: '33%' }} />
        <div className="absolute top-0 h-full w-px bg-white/70" style={{ left: '66%' }} />
        {/* 환자 마커 */}
        <div className="absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-[#1e2733]" style={{ left: `${pct}%` }} />
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-ink-soft"><span>저 0–33%</span><span>중 33–66%</span><span>고 66–100%</span></div>
    </button>
  )
}

function Skeleton() {
  return (
    <div className="emr-panel m-1.5 mb-0 min-h-[150px] border-l-4 border-l-[#d7dee7] p-2.5">
      <div className="flex items-center gap-3">
        <div className="h-14 w-[88px] shrink-0 animate-pulse rounded-md bg-[#e9eef4]" />
        <div className="flex-1 space-y-2"><div className="h-3 w-28 animate-pulse rounded bg-[#e9eef4]" /><div className="h-5 w-64 animate-pulse rounded bg-[#e3e9f0]" /><div className="h-3 w-40 animate-pulse rounded bg-[#e9eef4]" /></div>
        <div className="h-8 w-24 shrink-0 animate-pulse rounded bg-[#e9eef4]" />
      </div>
      <div className="mt-3 space-y-1.5"><div className="h-3 w-3/4 animate-pulse rounded bg-[#eef2f7]" /><div className="h-3 w-2/3 animate-pulse rounded bg-[#eef2f7]" /></div>
      <p className="mt-3 text-[13px] text-ink-soft">⏳ AI 권고 합성 중…</p>
    </div>
  )
}
