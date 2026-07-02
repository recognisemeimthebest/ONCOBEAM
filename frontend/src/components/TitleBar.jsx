import { useMemo, useState } from 'react'
import { fieldDefs, FIELD_ORDER } from '../search'

// 상단 타이틀바 — 의원명 + 복합 필터 추가(카테고리+값) + 빠른 선택 드롭다운
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
const nowStr = () => {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} (${WEEKDAY[d.getDay()]}) ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function TitleBar({ onAdd, patients, results, onPick, onLogout, doctor, onAudit }) {
  const [field, setField] = useState('이름')
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)

  // 검색 카테고리 옵션(부위 등)을 실제 로드된 환자 목록에서 도출
  const DEFS = useMemo(() => fieldDefs(patients), [patients])
  const def = DEFS[field]

  const commitText = () => {
    const v = draft.trim()
    if (!v) return
    onAdd({ field, value: v, label: v })
    setDraft('')
  }

  const commitEnum = (v) => {
    if (!v) return
    const opt = def.options.find((o) => o.v === v)
    onAdd({ field, value: v, label: opt ? opt.t : v })
  }

  const pick = (id) => {
    onPick(id)
    setOpen(false)
  }

  return (
    <header className="emr-titlebar flex h-9 items-center gap-3 px-3 text-white">
      {/* 의원명 */}
      <div className="flex items-center gap-2">
        <span className="text-[18px] font-bold">ONCOBEAM</span>
        <span className="text-[15px] text-white/70">| 두경부암 RT 임상의사결정지원(CDSS)</span>
      </div>

      {/* 복합 필터 추가 */}
      <div className="relative mx-auto flex w-[500px] items-stretch gap-1">
        {/* 카테고리 */}
        <select
          value={field}
          onChange={(e) => {
            setField(e.target.value)
            setDraft('')
          }}
          className="h-7 shrink-0 rounded bg-white px-1.5 text-[16px] font-semibold text-accent outline-none"
          title="검색 기준"
        >
          {FIELD_ORDER.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>

        {/* 값 입력 — enum이면 선택 즉시 칩 추가, text면 입력 후 추가 */}
        <div className="flex flex-1 items-center rounded bg-white px-2 shadow-inner">
          <span className="text-ink-soft">🔍</span>
          {def.type === 'enum' ? (
            <select
              value=""
              onChange={(e) => commitEnum(e.target.value)}
              onFocus={() => setOpen(true)}
              className="h-7 w-full bg-transparent px-2 text-[16px] text-ink outline-none"
            >
              <option value="">— {field} 선택 —</option>
              {def.options.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.t}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setOpen(true)
              }}
              onKeyDown={(e) => e.key === 'Enter' && commitText()}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder={def.ph}
              className="h-7 w-full bg-transparent px-2 text-[16px] text-ink outline-none placeholder:text-ink-soft/70"
            />
          )}
        </div>

        {/* 추가 버튼 (text 전용) */}
        {def.type === 'text' && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={commitText}
            className="h-7 shrink-0 rounded bg-white/20 px-2 text-[16px] font-semibold text-white hover:bg-white/30"
            title="필터 추가"
          >
            + 추가
          </button>
        )}

        {/* 빠른 선택 드롭다운 (현재 결과) */}
        {open && (
          <div className="absolute left-0 right-0 top-9 z-40 max-h-72 overflow-auto rounded border border-line bg-panel text-ink shadow-lg">
            <div className="flex items-center justify-between border-b border-line-soft bg-panel-alt px-2 py-1 text-[15px] text-ink-soft">
              <span>현재 조건 결과 · 클릭하여 선택</span>
              <span className="tabular">{results.length}명</span>
            </div>
            {results.length === 0 && (
              <div className="px-3 py-4 text-center text-[15px] text-ink-soft">
                조건에 맞는 환자가 없습니다.
              </div>
            )}
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p.id)}
                className="flex w-full items-center gap-2 border-b border-line-soft px-2 py-1.5 text-left hover:bg-[#eaf2fd]"
              >
                <span className="w-14 shrink-0 font-bold text-ink">{p.name}</span>
                <span className="w-44 shrink-0 font-semibold tabular text-accent">{p.id}</span>
                <span className="w-20 shrink-0 text-[15px] tabular text-ink-soft">{p.birth}</span>
                <span className="w-10 shrink-0 text-[15px] text-ink-soft">
                  {p.sex}/{p.age}
                </span>
                <span className="flex-1 truncate text-[15px] text-ink-soft">
                  {p.location.split(' ')[0]} {p.stage.t}
                  {p.stage.n}
                  {p.stage.m}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 우측 정보 */}
      <div className="flex items-center gap-3 text-[15px]">
        <span className="hidden tabular md:inline">{nowStr()}</span>
        <span className="rounded-sm bg-white/15 px-2 py-0.5">
          진료의 <b className="font-semibold">{doctor ?? '—'}</b>
        </span>
        <div className="flex items-center gap-1.5 text-[18px]">
          <button type="button" onClick={onAudit} title="감사 로그 (결정 이력)"
            className="rounded-sm bg-white/15 px-2 py-0.5 text-[14px] hover:bg-white/25">📋 감사로그</button>
          <button type="button" className="hover:opacity-80" title="알림">🔔</button>
          <button type="button" className="hover:opacity-80" title="설정">⚙️</button>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-sm bg-white/15 px-2 py-0.5 text-[15px] hover:bg-white/25"
            title="로그아웃"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  )
}
