import { useEffect, useState } from 'react'
import { predictPatient } from '../../api'
import { treatmentByCode } from '../../data/mockData'

// 모듈 1 팝업 — HTE(이질적 처치효과) 실모델
//   위 : causalforest_models.pkl  → 4개 대비 CATE + Bonferroni CI
//   아래: shap_explainer_1_vs_2.pkl → 1_vs_2 변수 기여도
//   (xgb_model.pkl 은 모듈2 예후예측 팝업으로 분리)
export default function HtePopup({ patient }) {
  const [pred, setPred] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setPred(null)
    setError(null)
    predictPatient(patient.id)
      .then((d) => alive && setPred(d))
      .catch((e) => alive && setError(e.message))
    return () => { alive = false }
  }, [patient.id])

  if (error) return <div className="emr-panel p-4 text-[12px] text-danger">예측 실패: {error}</div>
  if (!pred) return <div className="emr-panel p-6 text-center text-[12px] text-ink-soft">실모델 추론 중…</div>

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1 text-[11px] text-ink-soft">
        <span className="rounded-sm bg-headbar px-1.5 py-0.5 font-semibold text-headbar-ink">
          영상: {pred.image_case}
        </span>
        <span>Bonferroni α = {pred.bonferroni_alpha.toFixed(4)} · 실모델(causalforest·shap) 실시간 추론</span>
      </div>
      <CausalForestPanel contrasts={pred.contrasts} />
      <ShapPanel shap={pred.shap} />
    </div>
  )
}

// ── 왼쪽: Causal Forest CATE ──────────────────────────────────────────────────
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
        <span>치료법 쌍별 CATE (Causal Forest)</span>
        <span className="ml-auto text-[10px] font-normal text-ink-soft">4쌍 · 개별환자 CI</span>
      </div>
      <div className="p-2.5">
        <p className="mb-2 text-[11px] text-ink-soft">
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
                <text x={4} y={cy - 6} fontSize="10" fontWeight="600" fill="#283440">
                  {a?.en} → {b?.en} {c.significant && '★'}
                </text>
                <rect x={x0} y={cy - 4} width={Math.max(w, 0.5)} height="8" rx="2" fill={color}
                  opacity={c.significant ? 0.95 : 0.7} />
                <line x1={x(c.ci_low)} y1={cy} x2={x(c.ci_high)} y2={cy} stroke="#5d6b7c" strokeWidth="1.2" />
                <line x1={x(c.ci_low)} y1={cy - 4} x2={x(c.ci_low)} y2={cy + 4} stroke="#5d6b7c" strokeWidth="1.2" />
                <line x1={x(c.ci_high)} y1={cy - 4} x2={x(c.ci_high)} y2={cy + 4} stroke="#5d6b7c" strokeWidth="1.2" />
                <text x={c.cate >= 0 ? x(c.ci_high) + 4 : x(c.ci_low) - 4} y={cy + 3}
                  fontSize="10" fontWeight="700" textAnchor={c.cate >= 0 ? 'start' : 'end'}
                  fill={c.significant ? '#1e2733' : '#8b95a3'}>
                  {c.cate > 0 ? '+' : ''}{c.cate.toFixed(3)}
                </text>
                <text x={labelW} y={cy + 15} fontSize="8" fill="#7a8593">{c.label}</text>
              </g>
            )
          })}
          <text x={labelW} y={chartH - 3} fontSize="9" fill="#7a8593">−{maxAbs} · 앞 우세</text>
          <text x={centerX} y={chartH - 3} fontSize="9" fill="#7a8593" textAnchor="middle">0</text>
          <text x={labelW + plotW} y={chartH - 3} fontSize="9" fill="#7a8593" textAnchor="end">+{maxAbs} · 뒤 우세</text>
        </svg>
      </div>
    </div>
  )
}

// ── 아래: SHAP 변수 기여도 ────────────────────────────────────────────────────
function ShapPanel({ shap }) {
  const items = shap.contributions
  const maxAbs = Math.max(...items.map((d) => Math.abs(d.value)), 0.01)
  const POS = '#d62839', NEG = '#2b6cb0'

  return (
    <div className="emr-panel">
      <div className="emr-head">
        <span>SHAP 변수 기여도 — {shap.contrast_label}</span>
        <span className="ml-auto text-[10px] font-normal text-ink-soft">base = {shap.base_value.toFixed(3)}</span>
      </div>
      <div className="p-2.5">
        <p className="mb-2 text-[11px] text-ink-soft">
          빨강 = 처치효과↑ 방향 기여 · 파랑 = 처치효과↓ 방향 기여 (RandomForest TreeSHAP)
        </p>
        <div className="space-y-1">
          {items.map((d) => {
            const pct = (Math.abs(d.value) / maxAbs) * 100
            const pos = d.value >= 0
            return (
              <div key={d.feature} className="flex items-center gap-2 text-[11px]">
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
