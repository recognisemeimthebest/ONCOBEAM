import { useEffect, useState } from 'react'
import { predictPatient } from '../../api'

// 모듈 2 팝업 — 예후 예측 (XGBoost)
//   xgb_model.pkl → 5년 내 재발·사망(event) 위험확률 + 입력 임상/라디오믹스 요약
export default function ResponsePopup({ patient }) {
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
        <span>xgb_model.pkl · 36피처(라디오믹스+임상) 이진분류기 실시간 추론</span>
      </div>
      <XgbRiskPanel prob={pred.xgb.prob_event_5yr} />
    </div>
  )
}

// XGBoost 5년 재발·사망 위험확률 게이지
function XgbRiskPanel({ prob }) {
  const tone = prob >= 0.66
    ? { ring: '#d62839', bg: '#fbe6e8', fg: '#b3303d', label: '고위험' }
    : prob >= 0.33
      ? { ring: '#d98300', bg: '#fdf2e0', fg: '#b8730a', label: '중등도' }
      : { ring: '#1f9d55', bg: '#e6f5ec', fg: '#1f7a44', label: '저위험' }
  const r = 46, c = 2 * Math.PI * r, dash = c * prob

  return (
    <div className="emr-panel">
      <div className="emr-head">
        <span>5년 재발·사망 위험 (XGBoost 예후)</span>
        <span className="ml-auto text-[10px] font-normal text-ink-soft">36피처 · 라디오믹스+임상</span>
      </div>
      <div className="flex flex-col items-center p-4">
        <svg width="160" height="160" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#e4eaf1" strokeWidth="12" />
          <circle cx="60" cy="60" r={r} fill="none" strokeWidth="12" strokeLinecap="round"
            stroke={tone.ring} strokeDasharray={`${dash} ${c}`} transform="rotate(-90 60 60)" />
          <text x="60" y="56" textAnchor="middle" fontSize="26" fontWeight="800" fill="#1e2733" className="tabular">
            {(prob * 100).toFixed(0)}%
          </text>
          <text x="60" y="74" textAnchor="middle" fontSize="9" fill="#7a8593">5yr event risk</text>
        </svg>
        <span className="mt-2 rounded px-4 py-1 text-[14px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
          {tone.label}
        </span>
        <p className="mt-2 text-center text-[11px] leading-relaxed text-ink-soft">
          P(5년 내 재발 또는 사망) = <b className="tabular text-ink">{prob.toFixed(3)}</b><br />
          XGBoost 이진분류기 출력 확률 (1 = event 발생)
        </p>
        <p className="mt-2 flex gap-1 text-[10.5px] leading-relaxed text-ink-soft">
          <span>⚠️</span>
          의사결정 지원용. 라디오믹스 입력은 데모용 자리표시자이며 최종 판단은 의사 평가에 따릅니다.
        </p>
      </div>
    </div>
  )
}
