import { useEffect, useState } from 'react'
import { predictPatient } from '../api'
import { treatmentByCode } from '../data/mockData'
import AiRecommendationBanner from './AiRecommendationBanner'

// 중앙-우 진료기록 작성 — AI 의사결정 지원(권고 배너 + 근거 인라인) / 진료기록 / 처방
export default function ClinicalNote({ patient, openModal, onAdoptPlan }) {
  const plan = treatmentByCode(patient.plan.treatment)
  const [pred, setPred] = useState(null)
  const [predErr, setPredErr] = useState(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let alive = true
    setPred(null); setPredErr(null)
    predictPatient(patient.id).then((d) => alive && setPred(d)).catch((e) => alive && setPredErr(e.message))
    return () => { alive = false }
  }, [patient.id, reload])

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-auto bg-bg">
      {/* AI 의사결정 지원 — 권고 배너 + 근거(모듈1·2) 인라인 (한 번 추론해 공유) */}
      {predErr ? (
        <div className="emr-panel m-1.5 mb-0 border-l-4 border-l-[#b3303d] p-3">
          <p className="text-[15px] font-semibold text-danger">AI 권고를 불러오지 못했습니다</p>
          <p className="mt-1 text-[13px] text-ink-soft">{predErr}</p>
          <button type="button" onClick={() => setReload((n) => n + 1)} className="emr-btn-primary emr-btn mt-2">재시도</button>
        </div>
      ) : !pred ? (
        <div className="emr-panel m-1.5 mb-0 min-h-[140px] animate-pulse p-3 text-[14px] text-ink-soft">⏳ AI 권고·근거 합성 중…</div>
      ) : (
        <>
          <AiRecommendationBanner
            patient={patient}
            pred={pred}
            openModal={openModal}
            onAdopt={(arm) => onAdoptPlan?.(patient.id, arm)}
          />
        </>
      )}

      {/* 작성 헤더 */}
      <div className="emr-panel m-1.5 mb-0">
        <div className="emr-head">
          <span>진료 기록 작성</span>
          <span className="ml-2 text-[14px] font-normal text-ink-soft">
            최근 내원 {patient.history[0]?.date}
          </span>
        </div>

        {/* 보험 / 구분 / 주상병 */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line-soft px-2 py-1.5 text-[15px]">
          <Chip>건강보험</Chip>
          <span className="text-ink-soft">주상병</span>
          {patient.diagnoses.map((d) => (
            <span key={d.code} className="rounded-sm bg-headbar px-1.5 py-0.5 text-headbar-ink">
              <b className="tabular">{d.code}</b> {d.name}
            </span>
          ))}
        </div>

        {/* 증상 / 소견 */}
        <div className="px-2 py-2">
          <p className="mb-1 text-[15px] font-semibold text-ink-soft">증상 / 소견 (S/O)</p>
          <textarea
            defaultValue={`${patient.location} ${patient.stage.t}${patient.stage.n}${patient.stage.m}, ${plan.ko}(${plan.en}) 진행 중.\n치료법 적정성·예후 AI 의사결정 지원 검토 시행 (상단 권고 참조).`}
            className="h-20 w-full resize-none rounded border border-line bg-white p-2 text-[16px] leading-relaxed outline-none focus:border-accent focus:ring-2 focus:ring-[rgba(43,108,176,0.15)]"
          />
        </div>
      </div>

      {/* 처방 (P) */}
      <div className="emr-panel m-1.5 mb-0">
        <div className="emr-head">
          <span>처방 (P)</span>
          <span className="ml-auto text-[14px] font-normal text-accent">행 클릭 → 상세</span>
        </div>
        <table className="emr-table">
          <thead>
            <tr>
              <th className="w-12">구분</th>
              <th className="w-16">코드</th>
              <th>명칭</th>
              <th className="w-10 text-right">횟수</th>
              <th className="w-10 text-right">일수</th>
              <th className="w-12 text-right">수가</th>
            </tr>
          </thead>
          <tbody>
            {patient.prescriptions.map((rx, i) => (
              <tr key={i} className="emr-row-click" onClick={() => openModal('rx', rx)}>
                <td>{rx.kind}</td>
                <td className="tabular text-accent">{rx.code}</td>
                <td className="truncate">{rx.name}</td>
                <td className="text-right tabular">{rx.qty}</td>
                <td className="text-right tabular">{rx.days}</td>
                <td className="text-right">
                  <span className={rx.fee === '비급여' ? 'text-danger' : 'text-ink-soft'}>{rx.fee}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Chip({ children }) {
  return (
    <span className="rounded-sm border border-line bg-panel-alt px-1.5 py-0.5 font-semibold text-ink-soft">
      {children}
    </span>
  )
}
