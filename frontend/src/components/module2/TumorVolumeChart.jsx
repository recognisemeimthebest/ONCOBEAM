import { analyzeVolume } from '../../data/mockData'

// 시계열 종양 부피 변화 그래프 (순수 SVG, 라이트)
// 실측(파랑 실선/면적) + 예측(회색 점선) + 기준선 + 누적 변화율 주석
export default function TumorVolumeChart({ patient }) {
  const series = patient.cbct.volume
  const a = analyzeVolume(series)

  const W = 440
  const H = 220
  const pad = { l: 46, r: 16, t: 16, b: 28 }
  const plotW = W - pad.l - pad.r
  const plotH = H - pad.t - pad.b

  const minW = series[0].week
  const maxW = series[series.length - 1].week
  const yMax = Math.max(...series.map((p) => p.volume)) * 1.12

  const xs = (w) => pad.l + ((w - minW) / (maxW - minW)) * plotW
  const ys = (v) => pad.t + (1 - v / yMax) * plotH

  const actual = series.filter((p) => !p.predicted)
  const predicted = series.filter((p) => p.predicted)
  const predictedPath = actual.length ? [actual[actual.length - 1], ...predicted] : predicted

  const line = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${xs(p.week)},${ys(p.volume)}`).join(' ')
  const areaPath =
    line(actual) +
    ` L${xs(actual[actual.length - 1].week)},${ys(0)} L${xs(actual[0].week)},${ys(0)} Z`

  const yTicks = [0, 0.33, 0.66, 1].map((f) => Math.round((yMax / 1.12) * f))

  const BLUE = '#2b6cb0'
  const MUTED = '#9aa6b4'

  return (
    <div className="emr-panel">
      <div className="emr-head">
        <span>시계열 종양 부피 변화</span>
        <span className="ml-auto text-[10px] font-normal text-ink-soft">CBCT 주차별 · px²</span>
      </div>
      <div className="p-2.5">
        <p className="mb-1.5 text-[11px] text-ink-soft">실선 = 실측 · 점선 = 예측 · 점선 가로 = 기준(1주차)</p>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="시계열 종양 부피 변화 그래프">
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={pad.l} y1={ys(t)} x2={W - pad.r} y2={ys(t)} stroke="#eef2f7" strokeWidth="1" />
              <text x={pad.l - 6} y={ys(t) + 3} fontSize="9" fill="#7a8593" textAnchor="end">
                {t.toLocaleString()}
              </text>
            </g>
          ))}

          <line x1={pad.l} y1={ys(a.baseline)} x2={W - pad.r} y2={ys(a.baseline)}
            stroke="#c4ccd6" strokeWidth="1" strokeDasharray="4 3" />

          <path d={areaPath} fill={BLUE} opacity="0.1" />
          <path d={line(actual)} fill="none" stroke={BLUE} strokeWidth="2.2"
            strokeLinejoin="round" strokeLinecap="round" />
          {predicted.length > 0 && (
            <path d={line(predictedPath)} fill="none" stroke={MUTED} strokeWidth="2"
              strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
          )}

          {series.map((p) => (
            <g key={p.week}>
              <circle cx={xs(p.week)} cy={ys(p.volume)} r={p.current ? 5 : 3.5}
                fill={p.predicted ? '#ffffff' : BLUE} stroke={p.predicted ? MUTED : BLUE} strokeWidth="1.5" />
              <text x={xs(p.week)} y={H - 10} fontSize="9" fill="#7a8593" textAnchor="middle">
                {p.week}주
              </text>
            </g>
          ))}

          <text x={xs(a.current.week)} y={ys(a.current.volume) - 10} fontSize="10" fontWeight="700"
            fill={BLUE} textAnchor="middle">
            현재 {a.cumulative.toFixed(1)}%
          </text>
        </svg>

        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
          <Stat label="주차별 평균" value={`${a.weeklyRate.toFixed(1)}%/주`} />
          <Stat label="현재 누적" value={`${a.cumulative.toFixed(1)}%`} highlight />
          <Stat label={`예측 ${a.finalWeek}주차`} value={`${a.predictedFinal.toFixed(1)}%`} muted />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, highlight, muted }) {
  return (
    <div
      className="rounded border p-1.5"
      style={
        highlight
          ? { borderColor: '#bcd6f5', background: '#eef5fd' }
          : { borderColor: '#dbe2ea', background: '#f4f7fb' }
      }
    >
      <p className="text-[10px] text-ink-soft">{label}</p>
      <p
        className="text-[13px] font-bold tabular"
        style={{ color: highlight ? '#2b6cb0' : muted ? '#7a8593' : '#1e2733' }}
      >
        {value}
      </p>
    </div>
  )
}
