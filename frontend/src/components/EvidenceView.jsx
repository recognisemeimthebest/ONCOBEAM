import { useEffect, useRef, useState } from 'react'
import { treatmentByCode } from '../data/mockData'

// AI 근거 (인라인) — pred를 받아 모듈1(CATE+SHAP)·모듈2(XGB)를 표시. 차오르는 애니메이션.
export default function EvidenceView({ pred }) {
  if (!pred) return null
  const k = pred.patient_id   // 환자 바뀌면 리마운트 → 애니메이션 재생
  return (
    <div className="mt-2">
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        <CausalForestPanel key={`cf-${k}`} contrasts={pred.contrasts} />
        <XgbRiskPanel key={`xgb-${k}`} prob={pred.xgb.prob_event_5yr} />
      </div>
      <div className="mt-2"><ShapPanel key={`shap-${k}`} shap={pred.shap} /></div>
    </div>
  )
}

// 0→target 카운트업 (requestAnimationFrame)
function useCountUp(target, dur = 800) {
  const [v, setV] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    if (target == null || !Number.isFinite(target)) return
    let start
    const tick = (t) => {
      if (start === undefined) start = t
      const p = Math.min(1, (t - start) / dur)
      setV(target * p)
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, dur])
  return v
}

// ── 모듈1: Causal Forest CATE ────────────────────────────────────────────────
function CausalForestPanel({ contrasts }) {
  if (!contrasts?.length) return (
    <div className="emr-panel"><div className="emr-head"><span>모듈1 · 치료법 쌍별 CATE</span></div>
      <p className="p-4 text-center text-[14px] text-danger">⚠ Causal Forest 결과를 산출하지 못했습니다.</p></div>
  )
  const maxAbs = Math.max(0.1, Math.ceil(Math.max(...contrasts.flatMap((c) => [Math.abs(c.ci_low), Math.abs(c.ci_high)])) * 10) / 10)
  const W = 380, pad = 10, plotW = W - 2 * pad, centerX = pad + plotW / 2, half = plotW / 2
  const rowH = 48, top = 6, chartH = top + contrasts.length * rowH + 20
  const clamp = (v) => Math.max(-1, Math.min(1, v / maxAbs))
  const x = (v) => centerX + clamp(v) * half
  const BLUE = '#2b6cb0', MUTED = '#aeb8c4'

  return (
    <div className="emr-panel">
      <div className="emr-head">
        <span>모듈1 · 치료법 쌍별 CATE (Causal Forest)</span>
        <span className="ml-auto text-[13px] font-normal text-ink-soft">4쌍 · 개별환자 CI</span>
      </div>
      <div className="p-2">
        <p className="mb-1.5 text-[13px] text-ink-soft">막대 = 조건부 처치효과 · 에러바 = 보정 신뢰구간 · 파랑 = 유의</p>
        <svg viewBox={`0 0 ${W} ${chartH}`} className="w-full" role="img" aria-label="CATE 막대그래프">
          <line x1={centerX} y1={top} x2={centerX} y2={top + contrasts.length * rowH} stroke="#c4ccd6" strokeWidth="1" strokeDasharray="3 3" />
          {contrasts.map((c, i) => {
            const a = treatmentByCode(c.a), b = treatmentByCode(c.b)
            const rt = top + i * rowH
            const by = rt + 39
            const bx = x(c.cate), x0 = Math.min(centerX, bx), w = Math.max(Math.abs(bx - centerX), 0.5)
            const color = c.significant ? BLUE : MUTED
            return (
              <g key={c.key}>
                <text x={pad} y={rt + 13} fontSize="11.5" fontWeight="700" fill="#283440">{a?.en} → {b?.en}{c.significant ? ' ★' : ''}</text>
                <text x={W - pad} y={rt + 13} fontSize="11.5" fontWeight="700" textAnchor="end" fill={c.significant ? '#1e2733' : '#8b95a3'}>
                  {c.cate > 0 ? '+' : ''}{c.cate.toFixed(3)}
                </text>
                <text x={pad} y={rt + 25} fontSize="9" fill="#7a8593">{c.label}</text>
                <rect x={x0} y={by - 4} width={w} height="8" rx="2" fill={color} opacity={c.significant ? 0.95 : 0.7}>
                  <animate attributeName="x" from={centerX} to={x0} dur="0.6s" fill="freeze" />
                  <animate attributeName="width" from="0" to={w} dur="0.6s" fill="freeze" />
                </rect>
                <line x1={x(c.ci_low)} y1={by} x2={x(c.ci_high)} y2={by} stroke="#5d6b7c" strokeWidth="1.2" opacity="0">
                  <animate attributeName="opacity" from="0" to="1" begin="0.5s" dur="0.3s" fill="freeze" />
                </line>
                <line x1={x(c.ci_low)} y1={by - 4} x2={x(c.ci_low)} y2={by + 4} stroke="#5d6b7c" strokeWidth="1.2" opacity="0">
                  <animate attributeName="opacity" from="0" to="1" begin="0.5s" dur="0.3s" fill="freeze" />
                </line>
                <line x1={x(c.ci_high)} y1={by - 4} x2={x(c.ci_high)} y2={by + 4} stroke="#5d6b7c" strokeWidth="1.2" opacity="0">
                  <animate attributeName="opacity" from="0" to="1" begin="0.5s" dur="0.3s" fill="freeze" />
                </line>
              </g>
            )
          })}
          <text x={pad} y={chartH - 3} fontSize="10" fill="#7a8593">−{maxAbs} · 앞 우세</text>
          <text x={centerX} y={chartH - 3} fontSize="10" fill="#7a8593" textAnchor="middle">0</text>
          <text x={W - pad} y={chartH - 3} fontSize="10" fill="#7a8593" textAnchor="end">+{maxAbs} · 뒤 우세</text>
        </svg>
      </div>
    </div>
  )
}

// ── 모듈2: XGBoost 위험확률 (게이지·숫자 카운트업) ────────────────────────────
function XgbRiskPanel({ prob }) {
  const known = prob != null && Number.isFinite(prob)
  const v = useCountUp(known ? prob : 0)
  if (!known) return (
    <div className="emr-panel flex h-full flex-col"><div className="emr-head"><span>모듈2 · 5년 재발·사망 위험 (XGBoost 예후)</span></div>
      <p className="flex flex-1 items-center justify-center p-4 text-center text-[14px] text-danger">⚠ 예후(XGB) 모델 결과를 산출하지 못했습니다.</p></div>
  )
  const tone = prob >= 0.66
    ? { ring: '#d62839', bg: '#fbe6e8', fg: '#b3303d', label: '고위험' }
    : prob >= 0.33
      ? { ring: '#d98300', bg: '#fdf2e0', fg: '#b8730a', label: '중등도' }
      : { ring: '#1f9d55', bg: '#e6f5ec', fg: '#1f7a44', label: '저위험' }
  const r = 52, c = 2 * Math.PI * r, dash = c * v   // viewBox 내 더 굵고 큰 링
  return (
    <div className="emr-panel flex h-full flex-col">
      <div className="emr-head">
        <span>모듈2 · 5년 재발·사망 위험 (XGBoost 예후)</span>
        <span className="ml-auto text-[13px] font-normal text-ink-soft">36피처 · 라디오믹스+임상</span>
      </div>
      {/* 세로 가운데 정렬로 패널을 꽉 채움 */}
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-3">
        <svg viewBox="0 0 130 130" className="h-auto w-[68%] max-w-[260px]">
          <circle cx="65" cy="65" r={r} fill="none" stroke="#e4eaf1" strokeWidth="13" />
          <circle cx="65" cy="65" r={r} fill="none" strokeWidth="13" strokeLinecap="round" stroke={tone.ring}
            strokeDasharray={`${dash} ${c}`} transform="rotate(-90 65 65)" />
          <text x="65" y="62" textAnchor="middle" fontSize="30" fontWeight="800" fill="#1e2733" className="tabular">{(v * 100).toFixed(0)}%</text>
          <text x="65" y="80" textAnchor="middle" fontSize="10" fill="#7a8593">5yr event risk</text>
        </svg>
        <span className="rounded px-4 py-1 text-[20px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>
        <p className="text-center text-[14px] leading-relaxed text-ink-soft">
          P(5년 내 재발·사망) = <b className="tabular text-ink">{prob.toFixed(3)}</b><br />XGBoost 이진분류기 출력 확률
        </p>
      </div>
    </div>
  )
}

// ── 모듈1: SHAP 변수 기여도 (막대 자라기) ────────────────────────────────────
function ShapPanel({ shap }) {
  const items = shap?.contributions ?? []
  const maxAbs = Math.max(...items.map((d) => Math.abs(d.value)), 0.01)
  const POS = '#d62839', NEG = '#2b6cb0'
  const [on, setOn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setOn(true), 40); return () => clearTimeout(t) }, [])

  return (
    <div className="emr-panel">
      <div className="emr-head">
        <span>모듈1 · SHAP 변수 기여도 — {shap?.contrast_label}</span>
        <span className="ml-auto text-[13px] font-normal text-ink-soft">base = {shap?.base_value?.toFixed(3)}</span>
      </div>
      <div className="p-2">
        <p className="mb-1.5 text-[13px] text-ink-soft">빨강 = 처치효과↑ 기여 · 파랑 = 처치효과↓ 기여 (RandomForest TreeSHAP)</p>
        <div className="space-y-0.5">
          {items.map((d) => {
            const pct = (Math.abs(d.value) / maxAbs) * 100
            const pos = d.value >= 0
            return (
              <div key={d.feature} className="flex items-center gap-2 text-[13px]">
                <span className="w-44 shrink-0 truncate text-right text-ink" title={d.feature}>{d.feature_ko}</span>
                <div className="relative flex-1">
                  <div className="absolute left-1/2 top-1/2 h-3 -translate-y-1/2 rounded-sm"
                    style={{
                      width: on ? `${pct / 2}%` : '0%',
                      transition: 'width 0.6s ease',
                      background: pos ? POS : NEG,
                      [pos ? 'left' : 'right']: '50%',
                      [pos ? 'right' : 'left']: 'auto',
                    }} />
                  <div className="absolute left-1/2 top-0 h-full w-px bg-line" />
                  <div className="h-4" />
                </div>
                <span className="w-14 shrink-0 text-right tabular font-semibold" style={{ color: pos ? POS : NEG }}>
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
