import { VERDICTS, treatmentByCode } from '../data/mockData'

const TONE = {
  good: { bg: '#e6f5ec', fg: '#1f7a44', bd: '#bce3cc' },
  warn: { bg: '#fdf2e0', fg: '#b8730a', bd: '#f3dcae' },
  bad: { bg: '#fbe6e8', fg: '#b3303d', bd: '#f1c4c9' },
}

// 중앙-우 진료기록 작성 — 보험/주상병 / 증상·소견 / AI 의사결정 지원 / 처방 / 완료
export default function ClinicalNote({ patient, openModal }) {
  const plan = treatmentByCode(patient.plan.treatment)
  const verdict = VERDICTS[patient.verdict]
  const vt = TONE[verdict.tone]

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-auto bg-bg">
      {/* 작성 헤더 */}
      <div className="emr-panel m-1.5 mb-0">
        <div className="emr-head">
          <span>진료 기록 작성</span>
          <span className="ml-2 text-[10px] font-normal text-ink-soft">
            {patient.history[0]?.date}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {['↶', '↷', 'B', 'I', 'U', '⛶', '🖼️', '템플릿'].map((t, i) => (
              <button
                key={i}
                type="button"
                className="flex h-5 items-center justify-center rounded-sm border border-line bg-panel px-1.5 text-[10.5px] hover:bg-[#eaf2fd]"
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* 보험 / 구분 / 주상병 */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line-soft px-2 py-1.5 text-[11px]">
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
          <p className="mb-1 text-[11px] font-semibold text-ink-soft">증상 / 소견 (S/O)</p>
          <textarea
            defaultValue={`${patient.location} ${patient.stage.t}${patient.stage.n}${patient.stage.m}, ${plan.ko}(${plan.en}) 진행 중.\nCBCT 반응 평가 및 치료법 적정성 AI 검토 시행.`}
            className="h-20 w-full resize-none rounded border border-line bg-white p-2 text-[12px] leading-relaxed outline-none focus:border-accent focus:ring-2 focus:ring-[rgba(43,108,176,0.15)]"
          />
        </div>
      </div>

      {/* AI 의사결정 지원 — 클릭하여 팝업 */}
      <div className="emr-panel m-1.5 mb-0">
        <div className="emr-head">
          <span>AI 의사결정 지원</span>
          <span className="ml-auto text-[10px] font-normal text-accent">카드 클릭 → 상세 팝업</span>
        </div>
        <div className="grid grid-cols-2 gap-2 p-2">
          {/* 모듈 1: HTE */}
          <button
            type="button"
            onClick={() => openModal('hte')}
            className="rounded border border-line bg-panel p-2.5 text-left hover:border-accent hover:bg-[#f5f9ff]"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-accent">모듈 1</span>
              <span className="text-[12px] font-bold">치료법 비교 (HTE)</span>
            </div>
            <p className="mt-1 text-[11px] text-ink-soft">
              4개 치료법 · 6쌍 CATE · Bonferroni 보정 + SHAP 근거
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[11px] text-ink-soft">현재 계획</span>
              <b className="text-[11.5px]">{plan.ko}</b>
              <span
                className="rounded-sm border px-1.5 py-0.5 text-[10.5px] font-bold"
                style={{ background: vt.bg, color: vt.fg, borderColor: vt.bd }}
              >
                {verdict.ko}
              </span>
              <span className="ml-auto text-[11px] font-semibold text-accent">비교 보기 ▸</span>
            </div>
          </button>

          {/* 모듈 2: XGBoost 예후 예측 */}
          <button
            type="button"
            onClick={() => openModal('response')}
            className="rounded border border-line bg-panel p-2.5 text-left hover:border-accent hover:bg-[#f5f9ff]"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-accent">모듈 2</span>
              <span className="text-[12px] font-bold">예후 예측 (XGBoost)</span>
            </div>
            <p className="mt-1 text-[11px] text-ink-soft">
              36피처(라디오믹스+임상) · 5년 재발·사망 위험확률
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[11px] text-ink-soft">xgb_model.pkl 실시간 추론</span>
              <span className="ml-auto text-[11px] font-semibold text-accent">위험도 보기 ▸</span>
            </div>
          </button>
        </div>
      </div>

      {/* 처방 (P) */}
      <div className="emr-panel m-1.5 mb-0">
        <div className="emr-head">
          <span>처방 (P)</span>
          <span className="ml-auto text-[10px] font-normal text-accent">행 클릭 → 상세</span>
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

      {/* 푸터 */}
      <div className="sticky bottom-0 mt-auto flex items-center gap-2 border-t border-line bg-panel px-2 py-1.5">
        <input
          placeholder="처방 코드/명 입력 (예: C-02, Cisplatin) …"
          className="emr-input flex-1"
        />
        <button type="button" className="emr-btn">사전점검</button>
        <button type="button" className="emr-btn">작성취소</button>
        <button type="button" className="emr-btn-primary emr-btn">진료완료(F8)</button>
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
