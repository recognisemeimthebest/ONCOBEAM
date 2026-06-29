import { useEffect } from 'react'

// 공통 팝업 모달 셸 — 오버레이 + 타이틀바 + 닫기(X/ESC/바깥클릭)
export default function Modal({ title, subtitle, width = 760, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      onMouseDown={onClose}
    >
      <div
        className="emr-panel flex max-h-[90vh] w-full flex-col shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 타이틀바 */}
        <div className="emr-titlebar flex items-center gap-2 px-3 py-1.5 text-white">
          <span className="text-[18px] font-bold">{title}</span>
          {subtitle && <span className="text-[15px] text-white/80">{subtitle}</span>}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex h-5 w-5 items-center justify-center rounded-sm text-white/90 hover:bg-white/20"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 본문 */}
        <div className="overflow-auto bg-bg p-3">{children}</div>

        {/* 푸터 */}
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-panel px-3 py-2">
            {footer}
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-panel px-3 py-2">
            <button type="button" className="emr-btn" onClick={onClose}>
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
