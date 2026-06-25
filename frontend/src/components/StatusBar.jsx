// 하단 상태바
export default function StatusBar({ patient, count }) {
  return (
    <footer className="flex h-6 items-center gap-4 border-t border-line bg-panel px-3 text-[11px] text-ink-soft">
      <span>
        선택 환자 <b className="font-semibold text-ink tabular">{patient.id}</b>
      </span>
      <span className="tabular">목록 {count}명</span>
      <span className="ml-auto flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-success" />
        AI 모델 연결됨 · v4.0
      </span>
      <span className="tabular">서버 응답 42ms</span>
    </footer>
  )
}
