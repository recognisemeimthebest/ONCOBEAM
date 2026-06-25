import { treatmentByCode } from '../../data/mockData'

// 치료법 쌍별 CATE 비교 바 차트 (순수 SVG, 라이트)
// CATE(a,b) = 재발률(a) − 재발률(b). 양수 → b가 재발을 낮춤(b 우세).
// 색: 유의(CI 0 미포함) = 파랑 / 불확실 = 회색. 방향은 0 기준 좌우 위치.
export default function CateBarChart({ patient }) {
  const pairs = patient.cate

  const maxAbs = Math.max(
    5,
    Math.ceil(Math.max(...pairs.flatMap((p) => [Math.abs(p.ciLow), Math.abs(p.ciHigh)])) / 5) * 5
  )

  const W = 380
  const labelW = 96
  const plotX = labelW
  const plotW = W - labelW - 16
  const centerX = plotX + plotW / 2
  const half = plotW / 2
  const rowH = 34
  const top = 8
  const chartH = top + pairs.length * rowH + 28

  const x = (v) => centerX + (v / maxAbs) * half

  const BLUE = '#2b6cb0'
  const MUTED = '#aeb8c4'

  return (
    <div className="emr-panel">
      <div className="emr-head">
        <span>치료법 쌍별 CATE 비교</span>
        <span className="ml-auto text-[10px] font-normal text-ink-soft">6쌍 · Bonferroni 99.17% CI</span>
      </div>
      <div className="p-2.5">
        <p className="mb-2 text-[11px] text-ink-soft">
          막대 = 조건부 평균 처치효과(%p) · 에러바 = 보정 신뢰구간 · 파랑 = 유의(CI 0 미포함)
        </p>

        <svg viewBox={`0 0 ${W} ${chartH}`} className="w-full" role="img"
          aria-label="치료법 쌍별 CATE 비교 막대 그래프">
          <line x1={centerX} y1={top} x2={centerX} y2={top + pairs.length * rowH}
            stroke="#c4ccd6" strokeWidth="1" strokeDasharray="3 3" />

          {pairs.map((p, i) => {
            const a = treatmentByCode(p.a)
            const b = treatmentByCode(p.b)
            const cy = top + i * rowH + rowH / 2
            const bx = x(p.value)
            const x0 = Math.min(centerX, bx)
            const w = Math.abs(bx - centerX)
            const color = p.significant ? BLUE : MUTED

            return (
              <g key={`${p.a}-${p.b}`}>
                <text x={4} y={cy - 3} fontSize="10" fontWeight="600" fill="#283440">
                  {a.en} → {b.en}
                </text>
                <text x={4} y={cy + 8} fontSize="8" fill="#7a8593">
                  {a.ko} vs {b.ko}
                </text>

                <rect x={x0} y={cy - 5} width={Math.max(w, 0.5)} height="10" rx="2" fill={color}
                  opacity={p.significant ? 0.95 : 0.7} />

                <line x1={x(p.ciLow)} y1={cy} x2={x(p.ciHigh)} y2={cy} stroke="#5d6b7c" strokeWidth="1.2" />
                <line x1={x(p.ciLow)} y1={cy - 4} x2={x(p.ciLow)} y2={cy + 4} stroke="#5d6b7c" strokeWidth="1.2" />
                <line x1={x(p.ciHigh)} y1={cy - 4} x2={x(p.ciHigh)} y2={cy + 4} stroke="#5d6b7c" strokeWidth="1.2" />

                <text x={p.value >= 0 ? x(p.ciHigh) + 4 : x(p.ciLow) - 4} y={cy + 3}
                  fontSize="10" fontWeight="700" textAnchor={p.value >= 0 ? 'start' : 'end'}
                  fill={p.significant ? '#1e2733' : '#8b95a3'}>
                  {p.value > 0 ? '+' : ''}{p.value.toFixed(1)}
                </text>
              </g>
            )
          })}

          <g>
            <line x1={plotX} y1={top + pairs.length * rowH + 6} x2={plotX + plotW}
              y2={top + pairs.length * rowH + 6} stroke="#d7dee7" strokeWidth="1" />
            <text x={plotX} y={chartH - 4} fontSize="9" fill="#7a8593" textAnchor="start">−{maxAbs}%p · 앞 우세</text>
            <text x={centerX} y={chartH - 4} fontSize="9" fill="#7a8593" textAnchor="middle">0</text>
            <text x={plotX + plotW} y={chartH - 4} fontSize="9" fill="#7a8593" textAnchor="end">+{maxAbs}%p · 뒤 우세</text>
          </g>
        </svg>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-ink-soft">
          <Legend color={BLUE} label="유의 (CI 0 미포함)" />
          <Legend color={MUTED} label="불확실 (CI 0 포함)" />
        </div>
      </div>
    </div>
  )
}

function Legend({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  )
}
