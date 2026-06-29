import { useEffect, useState } from 'react'
import { predictPatient } from '../../api'
import { treatmentByCode } from '../../data/mockData'

// AI 근거 상세 팝업 (통합) — 한 번 추론해서 모듈1·2를 함께 보여준다.
//   모듈1 (HTE):  causalforest CATE(상단 좌) + shap 기여도(하단)
//   모듈2 (예후): xgb 5년 위험(상단 우)
export default function EvidencePopup({ patient }) {
  const [pred, setPred] = useState(null)
  const [error, setError] = useState(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let alive = true
    setPred(null)
    setError(null)
    predictPatient(patient.id)
      .then((d) => alive && setPred(d))
      .catch((e) => alive && setError(e.message))
    return () => { alive = false }
  }, [patient.id, reload])

  if (error) return (
    <div className="emr-panel p-4 text-center">
      <p className="text-[16px] font-semibold text-danger">근거를 불러오지 못했습니다</p>
      <p className="mt-1 text-[14px] text-ink-soft">{error}</p>
      <button type="button" onClick={() => setReload((n) => n + 1)} className="emr-btn-primary emr-btn mt-3">재시도</button>
    </div>
  )
  if (!pred) return <div className="emr-panel p-6 text-center text-[16px] text-ink-soft">실모델 추론 중…</div>

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1 text-[15px] text-ink-soft">
        <span className="rounded-sm bg-headbar px-1.5 py-0.5 font-semibold text-headbar-ink">
          영상: {pred.image_case}
        </span>
        <span>Bonferroni α = {pred.bonferroni_alpha.toFixed(4)} · 실모델(causalforest·xgb·shap) 실시간 추론</span>
      </div>

      {/* 상단: 모듈1 CATE | 모듈2 XGB 위험 */}
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        <CausalForestPanel contrasts={pred.contrasts} />
        <XgbRiskPanel prob={pred.xgb.prob_event_5yr} />
      </div>

      {/* 하단: 모듈1 SHAP */}
      <ShapPanel shap={pred.shap} />
    </div>
  )
}

// ── 모듈1: Causal Forest CATE ────────────────────────────────────────────────
function CausalForestPanel({ contrasts }) {
  const maxAbs = Math.max(
    0.1,
    Math.ceil(Math.max(...contrasts.flatMap((c) => [Math.abs(c.ci_low), Math.abs(c.ci_high)])) * 10) / 10
  )
  const W = 380, labelW = 8, plotW = W - 24, centerX = labelW + plotW / 2, half = plotW / 2
  const rowH = 40, top = 8, chartH = top + contrasts.length * rowH + 24
  const x = (v) => centerX + (v / maxAbs) * half
  const BLUE = '#2b6cb0', MUTED = '#aeb8c4'

  return (
    <div className="emr-panel">
      <div className="emr-head">
        <span>모듈1 · 치료법 쌍별 CATE (Causal Forest)</span>
        <span className="ml-auto text-[14px] font-normal text-ink-soft">4쌍 · 개별환자 CI</span>
      </div>
      <div className="p-2.5">
        <p className="mb-2 text-[15px] text-ink-soft">
          막대 = 조건부 처치효과 · 에러바 = 보정 신뢰구간 · 파랑 = 유의(CI 0 미포함)
        </p>
        <svg viewBox={`0 0 ${W} ${chartH}`} className="w-full" role="img" aria-label="CATE 막대그래프">
          <line x1={centerX} y1={top} x2={centerX} y2={top + contrasts.length * rowH}
            stroke="#c4ccd6" strokeWidth="1" strokeDasharray="3 3" />
          {contrasts.map((c, i) => {
            const a = treatmentByCode(c.a), b = treatmentByCode(c.b)
            const cy = top + i * rowH + rowH / 2
            const bx = x(c.cate), x0 = Math.min(centerX, bx), w = Math.abs(bx - centerX)
            const color = c.significant ? BLUE : MUTED
            return (
              <g key={c.key}>
                <text x={4} y={cy - 6} fontSize="13" fontWeight="600" fill="#283440">
                  {a?.en} → {b?.en} {c.significant && '★'}
                </text>
                <rect x={x0} y={cy - 4} width={Math.max(w, 0.5)} height="8" rx="2" fill={color}
                  opacity={c.significant ? 0.95 : 0.7} />
                <line x1={x(c.ci_low)} y1={cy} x2={x(c.ci_high)} y2={cy} stroke="#5d6b7c" strokeWidth="1.2" />
                <line x1={x(c.ci_low)} y1={cy - 4} x2={x(c.ci_low)} y2={cy + 4} stroke="#5d6b7c" strokeWidth="1.2" />
                <line x1={x(c.ci_high)} y1={cy - 4} x2={x(c.ci_high)} y2={cy + 4} stroke="#5d6b7c" strokeWidth="1.2" />
                <text x={c.cate >= 0 ? x(c.ci_high) + 4 : x(c.ci_low) - 4} y={cy + 3}
                  fontSize="13" fontWeight="700" textAnchor={c.cate >= 0 ? 'start' : 'end'}
                  fill={c.significant ? '#1e2733' : '#8b95a3'}>
                  {c.cate > 0 ? '+' : ''}{c.cate.toFixed(3)}
                </text>
                <text x={labelW} y={cy + 15} fontSize="10" fill="#7a8593">{c.label}</text>
              </g>
            )
          })}
          <text x={labelW} y={chartH - 3} fontSize="12" fill="#7a8593">−{maxAbs} · 앞 우세</text>
          <text x={centerX} y={chartH - 3} fontSize="12" fill="#7a8593" textAnchor="middle">0</text>
          <text x={labelW + plotW} y={chartH - 3} fontSize="12" fill="#7a8593" textAnchor="end">+{maxAbs} · 뒤 우세</text>
        </svg>
      </div>
    </div>
  )
}

// ── 모듈2: XGBoost 위험확률 ──────────────────────────────────────────────────
function XgbRiskPanel({ prob }) {
  const known = prob != null && Number.isFinite(prob)
  if (!known) {
    return (
      <div className="emr-panel">
        <div className="emr-head"><span>모듈2 · 5년 재발·사망 위험 (XGBoost 예후)</span></div>
        <p className="p-4 text-center text-[15px] text-danger">⚠ 예후(XGB) 모델 결과를 산출하지 못했습니다.</p>
      </div>
    )
  }
  const tone = prob >= 0.66
    ? { ring: '#d62839', bg: '#fbe6e8', fg: '#b3303d', label: '고위험' }
    : prob >= 0.33
      ? { ring: '#d98300', bg: '#fdf2e0', fg: '#b8730a', label: '중등도' }
      : { ring: '#1f9d55', bg: '#e6f5ec', fg: '#1f7a44', label: '저위험' }
  const r = 46, c = 2 * Math.PI * r, dash = c * prob

  return (
    <div className="emr-panel">
      <div className="emr-head">
        <span>모듈2 · 5년 재발·사망 위험 (XGBoost 예후)</span>
        <span className="ml-auto text-[14px] font-normal text-ink-soft">36피처 · 라디오믹스+임상</span>
      </div>
      <div className="flex flex-col items-center p-3">
        <svg width="150" height="150" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#e4eaf1" strokeWidth="12" />
          <circle cx="60" cy="60" r={r} fill="none" strokeWidth="12" strokeLinecap="round"
            stroke={tone.ring} strokeDasharray={`${dash} ${c}`} transform="rotate(-90 60 60)" />
          <text x="60" y="56" textAnchor="middle" fontSize="34" fontWeight="800" fill="#1e2733" className="tabular">
            {(prob * 100).toFixed(0)}%
          </text>
          <text x="60" y="74" textAnchor="middle" fontSize="12" fill="#7a8593">5yr event risk</text>
        </svg>
        <span className="mt-2 rounded px-4 py-1 text-[19px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
          {tone.label}
        </span>
        <p className="mt-2 text-center text-[15px] leading-relaxed text-ink-soft">
          P(5년 내 재발 또는 사망) = <b className="tabular text-ink">{prob.toFixed(3)}</b><br />
          XGBoost 이진분류기 출력 확률 (1 = event 발생)
        </p>
      </div>
    </div>
  )
}

// ── 모듈1: SHAP 변수 기여도 ──────────────────────────────────────────────────
function ShapPanel({ shap }) {
  const items = shap.contributions
  const maxAbs = Math.max(...items.map((d) => Math.abs(d.value)), 0.01)
  const POS = '#d62839', NEG = '#2b6cb0'

  return (
    <div className="emr-panel">
      <div className="emr-head">
        <span>모듈1 · SHAP 변수 기여도 — {shap.contrast_label}</span>
        <span className="ml-auto text-[14px] font-normal text-ink-soft">base = {shap.base_value.toFixed(3)}</span>
      </div>
      <div className="p-2.5">
        <p className="mb-2 text-[15px] text-ink-soft">
          빨강 = 처치효과↑ 방향 기여 · 파랑 = 처치효과↓ 방향 기여 (RandomForest TreeSHAP)
        </p>
        <div className="space-y-1">
          {items.map((d) => {
            const pct = (Math.abs(d.value) / maxAbs) * 100
            const pos = d.value >= 0
            return (
              <div key={d.feature} className="flex items-center gap-2 text-[15px]">
                <span className="w-40 shrink-0 truncate text-right text-ink" title={d.feature}>{d.feature_ko}</span>
                <div className="relative flex-1">
                  <div className="absolute left-1/2 top-1/2 h-3 -translate-y-1/2 rounded-sm"
                    style={{
                      width: `${pct / 2}%`,
                      background: pos ? POS : NEG,
                      [pos ? 'left' : 'right']: '50%',
                      [pos ? 'right' : 'left']: 'auto',
                    }} />
                  <div className="absolute left-1/2 top-0 h-full w-px bg-line" />
                  <div className="h-4" />
                </div>
                <span className="w-16 shrink-0 text-right tabular font-semibold"
                  style={{ color: pos ? POS : NEG }}>
                  {pos ? '+' : ''}{d.value.toFixed(3)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
