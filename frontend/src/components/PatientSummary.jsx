// 중앙-좌 환자 요약 — 헤더 / 바이탈 / 진단 / 진료기록 / 처방내역
// 진료기록·처방 행 클릭 → 팝업
const ACTIONS = ['📋', '💊', '🧪', '📷', '📝', '📂', '🖨️', '⭐']

export default function PatientSummary({ patient, openModal }) {
  const v = patient.vitals

  return (
    <section className="flex w-[400px] shrink-0 flex-col overflow-auto border-r border-line bg-bg">
      {/* 환자 헤더 */}
      <div className="emr-panel m-1.5 mb-0">
        <div className="flex items-center gap-2 border-b border-line-soft px-2.5 py-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-headbar text-[20px]">
            {patient.sex === 'M' ? '👨' : '👩'}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[20px] font-bold tabular">{patient.id}</span>
              <span className="text-[15px] text-ink-soft tabular">
                {patient.sex}/{patient.age}
              </span>
            </div>
            <div className="text-[15px] text-ink-soft tabular">{patient.birth}</div>
          </div>
        </div>
        {/* 액션 아이콘 줄 */}
        <div className="flex flex-wrap items-center gap-1 px-2 py-1.5">
          {ACTIONS.map((a, i) => (
            <button
              key={i}
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded border border-line bg-panel text-[16px] hover:bg-[#eaf2fd]"
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* 진단 (주상병) */}
      <Panel title="진단 (주상병)">
        <table className="emr-table">
          <tbody>
            {patient.diagnoses.map((d) => (
              <tr key={d.code}>
                <td className="w-16 tabular font-semibold text-accent">{d.code}</td>
                <td>{d.name}</td>
                <td className="w-12 text-right">
                  {d.main ? <span className="emr-badge">주</span> : <span className="text-ink-soft">부</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* 신체계측 (DB: 신장·체중·BMI) */}
      <Panel title="신체계측">
        <table className="emr-table">
          <tbody>
            <tr>
              <th className="w-14">신장</th>
              <td className="tabular">{v.height} cm</td>
              <th className="w-14">체중</th>
              <td className="tabular">{v.weight} kg</td>
            </tr>
            <tr>
              <th>BMI</th>
              <td className="tabular" colSpan={3}>{v.bmi}</td>
            </tr>
          </tbody>
        </table>
      </Panel>

      {/* 진료기록 (history) */}
      <Panel title="진료기록" hint="행 클릭 → 상세">
        <table className="emr-table">
          <thead>
            <tr>
              <th className="w-24">진료일</th>
              <th>요약</th>
            </tr>
          </thead>
          <tbody>
            {patient.history.map((h) => (
              <tr
                key={h.date}
                className="emr-row-click"
                onClick={() => openModal('history', h)}
              >
                <td className="tabular text-accent">{h.date}</td>
                <td className="truncate">{h.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* 처방내역 */}
      <Panel title="처방내역" hint="행 클릭 → 상세">
        <table className="emr-table">
          <thead>
            <tr>
              <th className="w-12">구분</th>
              <th className="w-14">코드</th>
              <th>명칭</th>
              <th className="w-10 text-right">일수</th>
            </tr>
          </thead>
          <tbody>
            {patient.prescriptions.map((rx, i) => (
              <tr key={i} className="emr-row-click" onClick={() => openModal('rx', rx)}>
                <td>
                  <span
                    className="emr-badge"
                    style={
                      rx.kind === '약품'
                        ? { background: '#fbe6e8', color: '#b3303d' }
                        : undefined
                    }
                  >
                    {rx.kind}
                  </span>
                </td>
                <td className="tabular text-accent">{rx.code}</td>
                <td className="truncate">{rx.name}</td>
                <td className="text-right tabular">{rx.days}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-end gap-4 border-t border-line-soft px-2 py-1.5 text-[15px]">
          <span className="text-ink-soft">
            청구액 <b className="tabular text-ink">14,610</b>
          </span>
          <span className="text-ink-soft">
            수납액 <b className="tabular text-danger">4,300</b>
          </span>
        </div>
      </Panel>
    </section>
  )
}

function Panel({ title, hint, children }) {
  return (
    <div className="emr-panel m-1.5 mb-0">
      <div className="emr-head">
        <span>{title}</span>
        {hint && <span className="ml-auto text-[14px] font-normal text-accent">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
