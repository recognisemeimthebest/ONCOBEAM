// 상단 탭 — 오늘의 현황 / 진료실 / 나의 오더
const TABS = ['오늘의 현황', '진료실', '나의 오더']

export default function TabStrip({ tab, onTab }) {
  return (
    <nav className="flex items-end gap-0.5 border-b border-line bg-panel px-2 pt-1">
      {TABS.map((t) => {
        const active = t === tab
        return (
          <button
            key={t}
            type="button"
            onClick={() => onTab(t)}
            className={[
              'relative -mb-px border px-4 py-1.5 text-[16px]',
              active
                ? 'border-line border-b-panel bg-panel font-bold text-accent'
                : 'border-transparent bg-panel-alt text-ink-soft hover:text-ink',
            ].join(' ')}
            style={{ borderTopLeftRadius: 4, borderTopRightRadius: 4 }}
          >
            {t}
          </button>
        )
      })}
      <div className="ml-auto flex items-center gap-2 pb-1 pr-1 text-[15px] text-ink-soft">
        <span className="emr-badge" style={{ background: '#e3f3e7', color: '#1f7a44' }}>
          AI 의사결정 지원 활성
        </span>
      </div>
    </nav>
  )
}
