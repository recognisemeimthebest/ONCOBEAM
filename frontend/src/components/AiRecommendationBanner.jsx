import { useEffect, useState } from 'react'
import { predictPatient, recordDecision, fetchLatestDecision } from '../api'

// 진료화면 상단 상시 노출 AI 권고 배너 (point-of-care) + 수락/기각 closed-loop.
// 식약처: CDSS는 보조도구 → 최종 결정·책임은 의료인. EMR 인증: 사용자·일시·수행·사유 감사기록.
const RISK_TONE = {
  고위험: { bg: '#fbe6e8', fg: '#b3303d', bd: '#f1c4c9', dot: '#d62839' },
  중등도: { bg: '#fdf2e0', fg: '#b8730a', bd: '#f3dcae', dot: '#d98300' },
  저위험: { bg: '#e6f5ec', fg: '#1f7a44', bd: '#bce3cc', dot: '#1f9d55' },
}
const ACTION_KO = { accept: '권고 수락', override: '기각 (다르게 결정)' }

const fmtTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function AiRecommendationBanner({ patient, openModal }) {
  const [rec, setRec] = useState(null)
  const [error, setError] = useState(null)
  const [decision, setDecision] = useState(null)   // 기록된 최근 결정
  const [mode, setMode] = useState('idle')         // idle | override | busy
  const [reason, setReason] = useState('')

  useEffect(() => {
    let alive = true
    setRec(null); setError(null); setDecision(null); setMode('idle'); setReason('')
    predictPatient(patient.id)
      .then((d) => alive && setRec(d.recommendation))
      .catch((e) => alive && setError(e.message))
    fetchLatestDecision(patient.id)
      .then((d) => alive && setDecision(d.decision))
      .catch(() => {})
    return () => { alive = false }
  }, [patient.id])

  const submit = async (action) => {
    if (action === 'override' && !reason.trim()) return
    setMode('busy')
    try {
      const payload = {
        patient_id: patient.id,
        action,
        recommended_arm: rec.suggested_arm,
        recommended_label: rec.suggested_arm_label,
        chosen_arm: action === 'accept' ? rec.suggested_arm : rec.current_arm,
        chosen_label: action === 'accept' ? rec.suggested_arm_label : rec.current_arm_label,
        reason: action === 'override' ? reason.trim() : null,
        risk_tier: rec.risk_tier,
        risk_prob: rec.risk_prob,
        headline: rec.headline,
      }
      await recordDecision(payload)
      const fresh = await fetchLatestDecision(patient.id)
      setDecision(fresh.decision)
      setMode('idle'); setReason('')
    } catch (e) {
      setError(e.message); setMode('idle')
    }
  }

  if (error) {
    return (
      <div className="emr-panel m-1.5 mb-0 border-l-4 border-l-[#b3303d] p-2 text-[15px] text-danger">
        AI 권고 처리 실패: {error}
      </div>
    )
  }
  if (!rec) {
    return (
      <div className="emr-panel m-1.5 mb-0 p-2.5 text-[16px] text-ink-soft">⏳ AI 권고 합성 중…</div>
    )
  }

  const tone = RISK_TONE[rec.risk_tier] ?? RISK_TONE.중등도
  const diverges = rec.suggested_arm != null && rec.agrees_with_plan === false

  return (
    <div className="emr-panel m-1.5 mb-0 border-l-4 p-2.5" style={{ borderLeftColor: tone.dot, background: '#fbfdff' }}>
      {/* 헤드라인 */}
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-5 shrink-0 items-center gap-1 rounded px-1.5 text-[14px] font-bold"
          style={{ background: tone.bg, color: tone.fg }}>
          <span className="h-2 w-2 rounded-full" style={{ background: tone.dot }} />
          AI 의사결정 지원
        </span>
        <span className="text-[18px] font-bold leading-tight text-ink">{rec.headline}</span>
        <button type="button" onClick={() => openModal('evidence')}
          className="ml-auto shrink-0 text-[15px] font-semibold text-accent hover:underline">
          근거 상세 ▸
        </button>
      </div>

      {/* 칩 줄 */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[14px]">
        <Chip label="현재 계획" value={rec.current_arm_label ?? '—'} />
        {rec.suggested_arm != null && (
          <Chip label="AI 권고" value={rec.suggested_arm_label} tone={diverges ? 'warn' : 'good'} />
        )}
        {diverges && (
          <span className="rounded-sm bg-[#fdf2e0] px-1.5 py-0.5 font-bold text-[#b8730a]">⚠ 현재 계획과 상이 — 재검토 권고</span>
        )}
        {rec.agrees_with_plan && (
          <span className="rounded-sm bg-[#e6f5ec] px-1.5 py-0.5 font-bold text-[#1f7a44]">✓ 현재 계획과 일치</span>
        )}
        <span className="rounded-sm border border-line px-1.5 py-0.5 text-ink-soft">신뢰도 {rec.confidence} · 유의대비 {rec.n_significant}/4</span>
        <button type="button" onClick={() => openModal('evidence')}
          className="rounded-sm border px-1.5 py-0.5 font-semibold"
          style={{ background: tone.bg, color: tone.fg, borderColor: tone.bd }}>
          5년 위험 {(rec.risk_prob * 100).toFixed(0)}% ({rec.risk_tier}) ▸
        </button>
      </div>

      {/* 근거 */}
      {rec.rationale?.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {rec.rationale.slice(0, 3).map((r, i) => (
            <li key={i} className="flex gap-1.5 text-[15px] text-ink">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-soft" />{r}
            </li>
          ))}
        </ul>
      )}

      {/* 면책 */}
      {rec.caveats?.length > 0 && (
        <p className="mt-1.5 flex gap-1 text-[14px] leading-relaxed text-ink-soft">
          <span>⚠️</span><span>{rec.caveats.join(' · ')}</span>
        </p>
      )}

      {/* ── 의사 결정 (closed-loop) ─────────────────────────────── */}
      <div className="mt-2 border-t border-line-soft pt-2">
        {decision ? (
          <div className="flex flex-wrap items-center gap-2 text-[15px]">
            <span className="rounded-sm px-1.5 py-0.5 font-bold"
              style={decision.action === 'accept'
                ? { background: '#e6f5ec', color: '#1f7a44' }
                : { background: '#fdf2e0', color: '#b8730a' }}>
              {decision.action === 'accept' ? '✓ 수락됨' : '✎ 기각됨'}
            </span>
            <span className="text-ink-soft">
              {decision.username} · {fmtTime(decision.created_at)}
              {decision.action === 'override' && decision.chosen_label && (
                <> · 선택: <b className="text-ink">{decision.chosen_label}</b></>
              )}
            </span>
            {decision.reason && <span className="text-ink">사유: {decision.reason}</span>}
            <button type="button" onClick={() => { setDecision(null); setMode('idle') }}
              className="ml-auto text-[14px] text-accent hover:underline">다시 결정</button>
          </div>
        ) : mode === 'override' ? (
          <div className="space-y-1.5">
            <p className="text-[15px] font-semibold text-ink-soft">기각 사유 (필수)</p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="예: T3N1, 전신상태 양호 → 표준 CCRT 유지"
              className="h-12 w-full resize-none rounded border border-line bg-white p-1.5 text-[16px] outline-none focus:border-accent" />
            <div className="flex items-center gap-1.5">
              <button type="button" disabled={!reason.trim()} onClick={() => submit('override')}
                className="emr-btn-primary emr-btn disabled:opacity-50">기각 기록</button>
              <button type="button" onClick={() => { setMode('idle'); setReason('') }} className="emr-btn">취소</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] text-ink-soft">
              본 권고는 의료인의 판단을 보조하며, 최종 결정·책임은 의료인에게 있습니다.
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <button type="button" disabled={mode === 'busy' || rec.suggested_arm == null}
                onClick={() => submit('accept')}
                className="emr-btn rounded border border-[#bce3cc] bg-[#e6f5ec] font-semibold text-[#1f7a44] disabled:opacity-50">
                ✓ 권고 수락
              </button>
              <button type="button" disabled={mode === 'busy'} onClick={() => setMode('override')}
                className="emr-btn rounded border border-[#f3dcae] bg-[#fdf2e0] font-semibold text-[#b8730a]">
                ✎ 기각 / 다르게 결정
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Chip({ label, value, tone }) {
  const c = tone === 'good'
    ? { bg: '#e6f5ec', fg: '#1f7a44' }
    : tone === 'warn'
      ? { bg: '#fdf2e0', fg: '#b8730a' }
      : { bg: '#eef2f7', fg: '#3a4658' }
  return (
    <span className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5" style={{ background: c.bg, color: c.fg }}>
      <span className="opacity-70">{label}</span><b>{value}</b>
    </span>
  )
}
