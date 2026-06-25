// 자동 BBox 검출 결과 패널 (YOLOv8, 라이트)
export default function BBoxPanel({ patient }) {
  const logs = patient.cbct.bbox
  const maxArea = Math.max(...logs.map((l) => l.avgArea))

  return (
    <div className="emr-panel">
      <div className="emr-head">
        <span>자동 BBox 검출 결과</span>
        <span className="ml-auto text-[10px] font-normal text-ink-soft">YOLOv8 · 최대 면적 1개 추적</span>
      </div>
      <div className="p-2.5">
        <p className="mb-2 text-[11px] text-ink-soft">
          CBCT 슬라이스에서 종양 경계상자 자동 검출 · 주차별 평균 면적·신뢰도
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {logs.map((l) => {
            const size = 40 + (l.avgArea / maxArea) * 52
            return (
              <div key={l.week} className="rounded border border-line bg-panel-alt p-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-bold tabular">{l.week}주차</span>
                  <span className="text-[10px] text-ink-soft tabular">{l.detected}/{l.total}</span>
                </div>
                {/* CBCT 슬라이스 + BBox 모식도 */}
                <div className="relative mb-1.5 aspect-square w-full overflow-hidden rounded-sm bg-black">
                  <div
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-[#34d058]"
                    style={{ width: `${size}%`, height: `${size}%` }}
                  >
                    <span className="absolute -top-3 left-0 rounded-sm bg-[#34d058] px-1 text-[8px] font-bold text-black tabular">
                      {l.avgConf.toFixed(2)}
                    </span>
                  </div>
                </div>
                <dl className="space-y-0.5 text-[10.5px]">
                  <Row k="면적" v={`${l.avgArea.toLocaleString()} px²`} />
                  <Row k="신뢰도" v={l.avgConf.toFixed(2)} />
                </dl>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-soft">{k}</dt>
      <dd className="font-medium tabular text-ink">{v}</dd>
    </div>
  )
}
