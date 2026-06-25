// 복합 필터 칩 바 — 활성 조건(AND)을 칩으로 표시, 개별/전체 제거
export default function FilterBar({ filters, onRemove, onClear, count, total }) {
  return (
    <div className="flex min-h-7 flex-wrap items-center gap-1.5 border-b border-line bg-[#eef3fa] px-3 py-1">
      <span className="text-[11px] font-semibold text-ink-soft">필터</span>

      {filters.length === 0 ? (
        <span className="text-[11px] text-ink-soft">전체 환자 (조건 없음) — 상단에서 조건을 추가하세요</span>
      ) : (
        filters.map((f, i) => (
          <span
            key={`${f.field}-${f.value}`}
            className="inline-flex items-center gap-1 rounded-sm border border-[#bcd0ea] bg-white px-1.5 py-0.5 text-[11px]"
          >
            <span className="font-semibold text-accent">{f.field}</span>
            <span className="text-ink-soft">:</span>
            <span className="font-medium text-ink">{f.label}</span>
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-sm text-ink-soft hover:bg-[#fbe6e8] hover:text-danger"
              aria-label="필터 제거"
            >
              ✕
            </button>
          </span>
        ))
      )}

      {filters.length > 1 && (
        <span className="ml-1 rounded-sm bg-[#dde7f3] px-1.5 py-0.5 text-[10px] font-semibold text-accent">
          AND {filters.length}조건
        </span>
      )}

      <div className="ml-auto flex items-center gap-2 text-[11px]">
        <span className="tabular text-ink-soft">
          결과 <b className="text-ink">{count}</b> / {total}명
        </span>
        {filters.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-sm border border-line bg-white px-2 py-0.5 font-semibold text-ink-soft hover:text-danger"
          >
            전체 해제
          </button>
        )}
      </div>
    </div>
  )
}
