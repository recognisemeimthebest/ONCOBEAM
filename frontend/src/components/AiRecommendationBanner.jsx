import { useEffect, useState } from 'react'
import { predictPatient } from '../api'

// 진료화면 상단 상시 노출 AI 권고 배너 (point-of-care).
// model_service /predict 의 recommendation(CATE 4대비 + XGB위험 합성)을 한눈에.
const RISK_TONE = {
  고위험: { bg: '#fbe6e8', fg: '#b3303d', bd: '#f1c4c9', dot: '#d62839' },
  중등도: { bg: '#fdf2e0', fg: '#b8730a', bd: '#f3dcae', dot: '#d98300' },
  저위험: { bg: '#e6f5ec', fg: '#1f7a44', bd: '#bce3cc', dot: '#1f9d55' },
}

export default function AiRecommendationBanner({ patient, openModal }) {
  const [rec, setRec] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setRec(null)
    setError(null)
    predictPatient(patient.id)
      .then((d) => alive && setRec(d.recommendation))
      .catch((e) => alive && setError(e.message))
    return () => { alive = false }
  }, [patient.id])

  if (error) {
    return (
      <div className="emr-panel m-1.5 mb-0 border-l-4 border-l-[#b3303d] p-2 text-[11px] text-danger">
        AI 권고 불러오기 실패: {error}
      </div>
    )
  }
  if (!rec) {
    return (
      <div className="emr-panel m-1.5 mb-0 p-2.5 text-[11.5px] text-ink-soft">
        ⏳ AI 권고 합성 중…
      </div>
    )
  }

  const tone = RISK_TONE[rec.risk_tier] ?? RISK_TONE.중등도
  const diverges = rec.suggested_arm != null && rec.agrees_with_plan === false

  return (
    <div
      className="emr-panel m-1.5 mb-0 border-l-4 p-2.5"
      style={{ borderLeftColor: tone.dot, background: '#fbfdff' }}
    >
      {/* 헤드라인 */}
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 inline-flex h-5 shrink-0 items-center gap-1 rounded px-1.5 text-[10.5px] font-bold"
          style={{ background: tone.bg, color: tone.fg }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: tone.dot }} />
          AI 의사결정 지원
        </span>
        <span className="text-[13px] font-bold leading-tight text-ink">{rec.headline}</span>
        <button
          type="button"
          onClick={() => openModal('evidence')}
          className="ml-auto shrink-0 text-[11px] font-semibold text-accent hover:underline"
        >
          근거 상세 ▸
        </button>
      </div>

      {/* 칩 줄: 현재계획 vs 권고 · 신뢰도 · 위험 */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10.5px]">
        <Chip label="현재 계획" value={rec.current_arm_label ?? '—'} />
        {rec.suggested_arm != null && (
          <Chip
            label="AI 권고"
            value={rec.suggested_arm_label}
            tone={diverges ? 'warn' : 'good'}
          />
        )}
        {diverges && (
          <span className="rounded-sm bg-[#fdf2e0] px-1.5 py-0.5 font-bold text-[#b8730a]">
            ⚠ 현재 계획과 상이 — 재검토 권고
          </span>
        )}
        {rec.agrees_with_plan && (
          <span className="rounded-sm bg-[#e6f5ec] px-1.5 py-0.5 font-bold text-[#1f7a44]">
            ✓ 현재 계획과 일치
          </span>
        )}
        <span className="rounded-sm border border-line px-1.5 py-0.5 text-ink-soft">
          신뢰도 {rec.confidence} · 유의대비 {rec.n_significant}/4
        </span>
        <button
          type="button"
          onClick={() => openModal('evidence')}
          className="rounded-sm border px-1.5 py-0.5 font-semibold"
          style={{ background: tone.bg, color: tone.fg, borderColor: tone.bd }}
        >
          5년 위험 {(rec.risk_prob * 100).toFixed(0)}% ({rec.risk_tier}) ▸
        </button>
      </div>

      {/* 근거 */}
      {rec.rationale?.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {rec.rationale.slice(0, 3).map((r, i) => (
            <li key={i} className="flex gap-1.5 text-[11px] text-ink">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-soft" />
              {r}
            </li>
          ))}
        </ul>
      )}

      {/* 면책/데이터품질 */}
      {rec.caveats?.length > 0 && (
        <p className="mt-1.5 flex gap-1 text-[10px] leading-relaxed text-ink-soft">
          <span>⚠️</span>
          <span>{rec.caveats.join(' · ')}</span>
        </p>
      )}
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
      <span className="opacity-70">{label}</span>
      <b>{value}</b>
    </span>
  )
}
