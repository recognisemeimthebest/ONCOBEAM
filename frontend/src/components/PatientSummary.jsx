// 중앙-좌 환자 요약 — 헤더(위험 미니칩) / 진단 / 신체계측 / 동반질환 / 진료기록 / 처방
const RISK_TONE = {
  고위험: { bg: '#fbe6e8', fg: '#b3303d' },
  중등도: { bg: '#fdf2e0', fg: '#b8730a' },
  저위험: { bg: '#e6f5ec', fg: '#1f7a44' },
}

export default function PatientSummary({ patient, openModal, triage }) {
  const v = patient.vitals
  const c = patient.comorbidity
  const rt = triage ? RISK_TONE[triage.risk_tier] : null

  return (
    <section className="flex w-[400px] shrink-0 flex-col overflow-auto border-r border-line bg-bg">
      {/* 환자 헤더 */}
      <div className="emr-panel m-1.5 mb-0">
        <div className="flex items-center gap-2 px-2.5 py-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-headbar text-[20px]">
            {patient.sex === 'M' ? '👨' : '👩'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[20px] font-bold tabular">{patient.id}</span>
              <span className="text-[15px] text-ink-soft tabular">{patient.sex}/{patient.age}</span>
            </div>
            <div className="text-[15px] text-ink-soft tabular">{patient.birth}</div>
          </div>
          <button type="button" onClick={() => openModal('ct')}
            className="shrink-0 self-start rounded border border-line bg-panel px-2 py-1 text-[14px] font-semibold text-accent hover:bg-[#eaf2fd]">
            🩻 CT 보기
          </button>
        </div>
        {/* 위험·권고 미니 요약 (트리아지 연계) */}
        {triage && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-line-soft px-2.5 py-1.5 text-[13px]">
            <span className="rounded-sm px-1.5 py-0.5 font-bold" style={{ background: rt.bg, color: rt.fg }}>
              5년 위험 {(triage.risk_prob * 100).toFixed(0)}% · {triage.risk_tier}
            </span>
            <span className="text-ink-soft">권고</span>
            <b className="text-ink">{triage.suggested ?? '—'}</b>
            {triage.diverges && (
              <span className="rounded-sm bg-[#fdf2e0] px-1.5 py-0.5 font-bold text-[#b8730a]">⚠ 재검토</span>
            )}
          </div>
        )}
      </div>

      {/* 진단 (주상병) */}
      <Panel title="진단 (주상병)">
        <table className="emr-table">
          <tbody>
            {patient.diagnoses.map((d) => (
              <tr key={d.code}>
                <td className="w-20 tabular font-semibold text-accent">{d.code}</td>
                <td>{d.name}</td>
                <td className="w-12 text-right">
                  {d.main ? <span className="emr-badge">주</span> : <span className="text-ink-soft">부</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* 신체계측 */}
      <Panel title="신체계측">
        <table className="emr-table">
          <tbody>
            <tr>
              <th className="w-14">신장</th><td className="tabular">{v.height} cm</td>
              <th className="w-14">체중</th><td className="tabular">{v.weight} kg</td>
            </tr>
            <tr><th>BMI</th><td className="tabular" colSpan={3}>{v.bmi}</td></tr>
          </tbody>
        </table>
      </Panel>

      {/* 동반질환 / 위험인자 (DB) */}
      <Panel title="동반질환 / 위험인자">
        <table className="emr-table">
          <tbody>
            <tr>
              <th className="w-14">흡연</th><td>{c.smoking}</td>
              <th className="w-14">당뇨</th><td>{c.bs}</td>
            </tr>
            <tr>
              <th>고혈압</th><td>{c.bp}</td>
              <th>가족력</th><td>{c.familyHistory}</td>
            </tr>
          </tbody>
        </table>
      </Panel>

      {/* 진료기록 */}
      <Panel title="진료기록" hint="행 클릭 → 상세">
        <table className="emr-table">
          <thead><tr><th className="w-24">진료일</th><th>요약</th></tr></thead>
          <tbody>
            {patient.history.map((h) => (
              <tr key={h.date} className="emr-row-click" onClick={() => openModal('history', h)}>
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
            <tr><th className="w-12">구분</th><th className="w-14">코드</th><th>명칭</th><th className="w-10 text-right">일수</th></tr>
          </thead>
          <tbody>
            {patient.prescriptions.map((rx, i) => (
              <tr key={i} className="emr-row-click" onClick={() => openModal('rx', rx)}>
                <td><span className="emr-badge" style={rx.kind === '약품' ? { background: '#fbe6e8', color: '#b3303d' } : undefined}>{rx.kind}</span></td>
                <td className="tabular text-accent">{rx.code}</td>
                <td className="truncate">{rx.name}</td>
                <td className="text-right tabular">{rx.days}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
