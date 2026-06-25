import { treatmentByCode } from '../../data/mockData'

// SHAP 근거 패널 (라이트) — 양수(빨강) 재발 위험 ↑, 음수(초록) 위험 ↓
export default function ShapPanel({ patient }) {
  const plan = treatmentByCode(patient.plan.treatment)
  const rows = [...patient.shap].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.value)))

  return (
    <div className="emr-panel">
      <div className="emr-head">
        <span>SHAP 근거 분석</span>
        <span className="ml-auto text-[10px] font-normal text-ink-soft">{plan.ko} 재발 예측 기여도</span>
      </div>
      <div className="p-2.5">
        <p className="mb-2 text-[11px] text-ink-soft">
          피처가 재발 위험 예측을 얼마나 끌어올리거나 낮추는지 (단위: %p)
        </p>

        <ul className="space-y-1.5">
          {rows.map((r) => {
            const pos = r.value >= 0
            const w = (Math.abs(r.value) / maxAbs) * 50
            return (
              <li key={r.feature} className="grid grid-cols-[1fr_auto] items-center gap-2">
                <span className="truncate text-[11px] text-ink">{r.ko}</span>
                <div className="flex items-center">
                  <div className="relative h-3.5 w-36">
                    <span className="absolute left-1/2 top-0 h-3.5 w-px bg-[#c4ccd6]" />
                    <span
                      className="absolute top-0.5 h-2.5 rounded-sm"
                      style={
                        pos
                          ? { left: '50%', width: `${w}%`, background: '#d62839' }
                          : { right: '50%', width: `${w}%`, background: '#1f9d55' }
                      }
                    />
                  </div>
                  <span
                    className="ml-2 w-10 text-right text-[11px] font-semibold tabular"
                    style={{ color: pos ? '#b3303d' : '#1f7a44' }}
                  >
                    {pos ? '+' : ''}
                    {r.value.toFixed(1)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="mt-2 flex gap-3 text-[10.5px] text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#d62839' }} /> 위험 ↑
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#1f9d55' }} /> 위험 ↓
          </span>
        </div>
      </div>
    </div>
  )
}
