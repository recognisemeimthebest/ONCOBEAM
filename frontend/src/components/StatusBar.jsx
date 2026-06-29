// 하단 상태바
export default function StatusBar({ patient, count }) {
  return (
    <footer className="flex h-6 items-center gap-4 border-t border-line bg-panel px-3 text-[15px] text-ink-soft">
      <span>선택 환자 <b className="font-semibold text-ink">{patient.name}</b> <span className="tabular text-ink-soft">({patient.id})</span></span>
      <span className="tabular">노출 {count}명 (영상 배정 환자)</span>
      <span className="ml-auto flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-success" />
        실모델 연결됨 · causalforest · xgb · shap
      </span>
      <span>ONCOBEAM CDSS</span>
    </footer>
  )
}
