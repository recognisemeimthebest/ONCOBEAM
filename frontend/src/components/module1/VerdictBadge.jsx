import { VERDICTS, treatmentByCode } from '../../data/mockData'

// 라이트 임상 톤 — 의미색 틴트 박스
const TONE = {
  good: { box: 'border-[#bce3cc] bg-[#e6f5ec]', dot: '#1f9d55', text: 'text-[#1f7a44]', icon: '✓' },
  warn: { box: 'border-[#f3dcae] bg-[#fdf2e0]', dot: '#d98300', text: 'text-[#b8730a]', icon: '!' },
  bad: { box: 'border-[#f1c4c9] bg-[#fbe6e8]', dot: '#d62839', text: 'text-[#b3303d]', icon: '✕' },
}

// 현재 치료 계획의 3단계 판정 배지
export default function VerdictBadge({ patient }) {
  const v = VERDICTS[patient.verdict]
  const tone = TONE[v.tone]
  const plan = treatmentByCode(patient.plan.treatment)

  return (
    <div className={`flex items-center gap-3 rounded border p-3 ${tone.box}`}>
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
        style={{ background: tone.dot }}
      >
        {tone.icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-ink-soft">
          현재 계획 판정 · {plan.ko} ({plan.en})
        </p>
        <p className={`text-[16px] font-bold ${tone.text}`}>
          {v.ko} <span className="text-[12px] font-medium opacity-70">/ {v.en}</span>
        </p>
      </div>
      <div className="ml-auto hidden text-right text-[11px] text-ink-soft sm:block">
        <p>3단계 판정</p>
        <p>효과적 · 불확실 · 비효과적</p>
      </div>
    </div>
  )
}
