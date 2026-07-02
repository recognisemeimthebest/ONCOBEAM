import { useEffect, useState } from 'react'
import { recordDecision, fetchLatestDecision } from '../api'
import EvidenceView from './EvidenceView'

// AI 권고 배너 — pred(예측)는 부모(ClinicalNote)가 한 번 받아 내려준다. 결정(수락/기각)만 자체 처리.
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

export default function AiRecommendationBanner({ patient, pred, openModal, onAdopt }) {
  const [decision, setDecision] = useState(null)
  const [mode, setMode] = useState('idle')   // idle | override | busy
  const [reason, setReason] = useState('')

  useEffect(() => {
    let alive = true
    setDecision(null); setMode('idle'); setReason('')
    fetchLatestDecision(patient.id).then((d) => alive && setDecision(d.decision)).catch(() => {})
    return () => { alive = false }
  }, [patient.id])

  const rec = pred?.recommendation
  if (!rec) return null

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
      if (action === 'accept' && rec.suggested_arm) onAdopt?.(rec.suggested_arm)
      const fresh = await fetchLatestDecision(patient.id)
      setDecision(fresh.decision); setMode('idle'); setReason('')
    } catch (e) { setMode('idle') }
  }

  const tone = RISK_TONE[rec.risk_tier] ?? RISK_TONE.중등도
  const diverges = rec.suggested_arm != null && rec.agrees_with_plan === false
  const verdict = rec.suggested_arm == null
    ? { icon: '•', word: '참고', sub: '판정 보류', bg: '#eef2f7', fg: '#3a4658', bd: '#d7dee7' }
    : diverges
      ? { icon: '⚠', word: '재검토 권고', sub: `현재 ${rec.current_arm_label ?? '—'} 와 상이`, bg: '#fdf2e0', fg: '#b8730a', bd: '#f3dcae' }
      : { icon: '✓', word: '계획 적정', sub: '현재 계획과 일치', bg: '#e6f5ec', fg: '#1f7a44', bd: '#bce3cc' }

  const partial = pred.errors?.length > 0

  return (
    <div className="emr-panel m-1.5 mb-0 border-l-4 p-2.5" style={{ borderLeftColor: verdict.fg, background: '#fbfdff' }}>
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
      </div>

      {partial && (
        <p className="mt-1.5 rounded border border-[#f3dcae] bg-[#fdf2e0] px-2 py-1 text-[12px] text-[#b8730a]">
          ⚠ 일부 모델 결과 누락: {pred.errors.join(' · ')} — 표시된 항목만 신뢰하세요.
        </p>
      )}

      {/* 상세 근거 (모듈1 CATE·SHAP / 모듈2 XGB) — 메인 화면 인라인 */}
      <EvidenceView pred={pred} />

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
    </div>
  )
}

