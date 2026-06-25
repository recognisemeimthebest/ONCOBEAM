import { EFFECT_CLASSES } from '../../data/mockData'

// 라이트 임상 톤
const TONE = {
  good: { ring: '#1f9d55', badge: { bg: '#e6f5ec', fg: '#1f7a44' }, icon: '✓' },
  warn: { ring: '#d98300', badge: { bg: '#fdf2e0', fg: '#b8730a' }, icon: '⚠' },
  bad: { ring: '#d62839', badge: { bg: '#fbe6e8', fg: '#b3303d' }, icon: '✕' },
}

// 효과 분류 결과 카드 (라이트) — 라벨 + efficacy_score 게이지 + 근거 + 권고 + 면책
export default function EffectCard({ patient }) {
  const e = patient.cbct.effect
  const cls = EFFECT_CLASSES[e.label]
  const tone = TONE[cls.tone]

  const r = 30
  const c = 2 * Math.PI * r
  const dash = c * e.score

  return (
    <div className="emr-panel">
      <div className="emr-head">
        <span>효과 분류 결과</span>
      </div>
      <div className="p-2.5">
        <div className="flex items-center gap-3">
          <svg width="72" height="72" viewBox="0 0 80 80" className="shrink-0">
            <circle cx="40" cy="40" r={r} fill="none" stroke="#e4eaf1" strokeWidth="8" />
            <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
              stroke={tone.ring} strokeDasharray={`${dash} ${c}`} transform="rotate(-90 40 40)" />
            <text x="40" y="38" textAnchor="middle" fontSize="16" fontWeight="800" fill="#1e2733" className="tabular">
              {e.score.toFixed(2)}
            </text>
            <text x="40" y="52" textAnchor="middle" fontSize="8" fill="#7a8593">score</text>
          </svg>

          <div>
            <span
              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[13px] font-bold"
              style={{ background: tone.badge.bg, color: tone.badge.fg }}
            >
              <span>{tone.icon}</span>
              {cls.ko} <span className="font-medium opacity-70">/ {cls.en}</span>
            </span>
            <p className="mt-1.5 text-[11px] text-ink-soft tabular">
              efficacy_score = {e.score.toFixed(2)} (0~1, 1에 가까울수록 효과적)
            </p>
          </div>
        </div>

        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold text-ink-soft">주요 근거</p>
          <ul className="space-y-1">
            {e.reasons.map((r) => (
              <li key={r} className="flex gap-1.5 text-[11.5px] text-ink">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-soft" />
                {r}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-2.5 rounded border border-[#cfe0f5] bg-[#eef5fd] px-2.5 py-1.5">
          <p className="text-[11px] font-semibold text-accent">권고 (Recommendation)</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink">{e.recommendation}</p>
        </div>

        <p className="mt-2.5 flex gap-1 text-[10.5px] leading-relaxed text-ink-soft">
          <span>⚠️</span>
          본 결과는 의사결정 지원용이며, 최종 판단은 의사 평가에 따릅니다. (SaMD 데모)
        </p>
      </div>
    </div>
  )
}
