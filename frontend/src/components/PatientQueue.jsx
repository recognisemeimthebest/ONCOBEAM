import { stageText } from '../search'

// 좌측 환자 목록 — DB 환자 네비게이션 + 트리아지(위험 뱃지 + 위험순 정렬).
const RISK_DOT = { 고위험: '#e06070', 중등도: '#e0a64a', 저위험: '#54c08a' }
const RISK_RANK = { 고위험: 0, 중등도: 1, 저위험: 2 }

export default function PatientQueue({ patients, patientId, onSelect, triage = {} }) {
  // 위험순(고→중→저) 정렬, 트리아지 미도착은 뒤로
  const sorted = [...patients].sort((a, b) => {
    const ra = RISK_RANK[triage[a.id]?.risk_tier] ?? 9
    const rb = RISK_RANK[triage[b.id]?.risk_tier] ?? 9
    if (ra !== rb) return ra - rb
    return a.id < b.id ? -1 : 1
  })
  const highCount = patients.filter((p) => triage[p.id]?.risk_tier === '고위험').length
  const divCount = patients.filter((p) => triage[p.id]?.diverges).length

  return (
    <aside className="flex w-72 shrink-0 flex-col bg-navy text-white/90">
      <div className="flex items-center justify-between bg-navy-2 px-2.5 py-1.5">
        <span className="text-[16px] font-bold text-white">환자 목록</span>
        <span className="rounded-sm bg-white/15 px-1.5 py-0.5 text-[15px] tabular">{patients.length}명</span>
      </div>
      {/* 트리아지 요약 */}
      <div className="flex items-center gap-1.5 border-b border-white/10 bg-navy-2/60 px-2 py-1 text-[12px]">
        <span className="rounded-sm bg-[#e06070]/25 px-1.5 py-0.5 font-semibold text-[#ffb3bd]">고위험 {highCount}</span>
        <span className="rounded-sm bg-[#e0a64a]/25 px-1.5 py-0.5 font-semibold text-[#ffd699]">⚠ 재검토 {divCount}</span>
        <span className="ml-auto text-white/45">위험순</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-1.5">
        {sorted.length === 0 && <p className="px-2 py-6 text-center text-[15px] text-white/50">해당 환자가 없습니다.</p>}
        {sorted.map((p) => {
          const selected = p.id === patientId
          const t = triage[p.id]
          return (
            <button key={p.id} type="button" onClick={() => onSelect(p.id)}
              className={[
                'mb-1.5 block w-full rounded border px-2 py-1.5 text-left transition',
                selected
                  ? 'border-[#4a8fe0] bg-navy-sel/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]'
                  : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.09]',
              ].join(' ')}>
              <div className="flex items-center gap-1.5">
                {/* 위험 점 */}
                <span className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: t ? RISK_DOT[t.risk_tier] : '#5a6b80' }}
                  title={t ? `위험 ${(t.risk_prob * 100).toFixed(0)}% · ${t.risk_tier}` : '분석 중'} />
                <span className="text-[16px] font-bold text-white">{p.name}</span>
                <span className="ml-auto shrink-0 rounded-sm bg-white/15 px-1 text-[14px] text-white/80 tabular">{p.sex}/{p.age}</span>
              </div>
              <div className="mt-0.5 truncate text-[13px] text-white/55 tabular">{p.id}</div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="truncate text-[14px] text-white/55">{String(p.location).split(' ')[0]} {stageText(p)}</span>
                {t?.diverges && (
                  <span className="ml-auto shrink-0 rounded-sm bg-[#e0a64a]/25 px-1 text-[12px] font-bold text-[#ffd699]">⚠ 재검토</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
