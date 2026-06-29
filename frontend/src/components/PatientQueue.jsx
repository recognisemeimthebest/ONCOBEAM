import { stageText } from '../search'

// 좌측 환자 목록 — DB 환자 선택 네비게이션. (대기열 상태/방문구분/시간/메모는 DB에 없어 제외)
export default function PatientQueue({ patients, patientId, onSelect }) {
  return (
    <aside className="flex w-72 shrink-0 flex-col bg-navy text-white/90">
      {/* 헤더 */}
      <div className="flex items-center justify-between bg-navy-2 px-2.5 py-1.5">
        <span className="text-[16px] font-bold text-white">환자 목록</span>
        <span className="rounded-sm bg-white/15 px-1.5 py-0.5 text-[15px] tabular">
          {patients.length}명
        </span>
      </div>

      {/* 목록 */}
      <div className="min-h-0 flex-1 overflow-auto p-1.5">
        {patients.length === 0 && (
          <p className="px-2 py-6 text-center text-[15px] text-white/50">해당 환자가 없습니다.</p>
        )}
        {patients.map((p) => {
          const selected = p.id === patientId
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className={[
                'mb-1.5 block w-full rounded border px-2 py-1.5 text-left transition',
                selected
                  ? 'border-[#4a8fe0] bg-navy-sel/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]'
                  : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.09]',
              ].join(' ')}
            >
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[16px] font-bold text-white tabular">{p.id}</span>
                <span className="ml-auto shrink-0 rounded-sm bg-white/15 px-1 text-[14px] text-white/80 tabular">
                  {p.sex}/{p.age}
                </span>
              </div>
              <div className="mt-0.5 text-[14px] text-white/60 tabular">{p.birth}</div>
              <div className="mt-1 truncate text-[14px] text-white/55">
                {String(p.location).split(' ')[0]} {stageText(p)}
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
