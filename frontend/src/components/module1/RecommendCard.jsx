import { TREATMENTS, treatmentByCode } from '../../data/mockData'

// 대안 치료 권고 (라이트) — 자연어 권고 + 치료법별 예측 재발률 랭킹
export default function RecommendCard({ patient }) {
  const ranked = TREATMENTS.map((t) => ({ ...t, rec: patient.recurrence[t.code] })).sort(
    (a, b) => a.rec - b.rec
  )
  const best = ranked[0]
  const chosen = treatmentByCode(patient.plan.treatment)
  const minRec = ranked[0].rec
  const maxRec = ranked[ranked.length - 1].rec

  return (
    <div className="emr-panel">
      <div className="emr-head">
        <span>대안 치료 권고 (Recommendation)</span>
      </div>
      <div className="p-2.5">
        <div className="rounded border border-[#cfe0f5] bg-[#eef5fd] p-2.5 text-[12px] leading-relaxed text-ink">
          {patient.recommendation}
        </div>

        <div className="mt-2.5 flex items-center gap-2 text-[11.5px]">
          <span className="text-ink-soft">최저 예측 재발률</span>
          <b className="text-accent">
            {best.ko} ({best.en}) · {(best.rec * 100).toFixed(0)}%
          </b>
          {best.code === chosen.code && (
            <span className="emr-badge" style={{ background: '#e6f5ec', color: '#1f7a44' }}>
              현재 계획과 일치
            </span>
          )}
        </div>

        <p className="mb-1.5 mt-3 text-[11px] font-semibold text-ink-soft">
          치료법별 예측 재발률 (Predicted recurrence)
        </p>
        <ul className="space-y-1.5">
          {ranked.map((t) => {
            const pct = t.rec * 100
            const w = ((t.rec - minRec) / (maxRec - minRec || 1)) * 70 + 30
            const isChosen = t.code === chosen.code
            return (
              <li key={t.code} className="flex items-center gap-2 text-[11.5px]">
                <span className={`w-28 shrink-0 truncate ${isChosen ? 'font-bold text-ink' : 'text-ink-soft'}`}>
                  {t.ko}
                </span>
                <div className="h-2.5 flex-1 rounded-sm bg-[#e4eaf1]">
                  <div
                    className="h-2.5 rounded-sm"
                    style={{ width: `${w}%`, background: isChosen ? '#2b6cb0' : '#9fb1c4' }}
                  />
                </div>
                <span className="w-9 text-right font-semibold tabular text-ink">{pct.toFixed(0)}%</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
