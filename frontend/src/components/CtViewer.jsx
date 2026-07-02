import { useEffect, useState } from 'react'
import { fetchCtMeta, ctSliceUrl, ctSegUrl } from '../api'

// CT 뷰어 — 환자 배정 SegRap CT(.mha). 3면(횡/관상/시상) + 윈도우 프리셋.
const WINDOWS = [
  { key: '연부조직', w: 350, l: 40 },
  { key: '골', w: 2000, l: 400 },
  { key: '광역', w: 1500, l: 0 },
]
const AXES = [
  { key: 'axial', ko: '횡면' },
  { key: 'coronal', ko: '관상면' },
  { key: 'sagittal', ko: '시상면' },
]

export default function CtViewer({ patient }) {
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState(null)
  const [reload, setReload] = useState(0)
  const [axis, setAxis] = useState('axial')
  const [idx, setIdx] = useState(0)
  const [win, setWin] = useState(WINDOWS[0])
  const [firstLoad, setFirstLoad] = useState(true)
  const [seg, setSeg] = useState(true)   // 종양 오버레이 표시

  useEffect(() => {
    let alive = true
    setMeta(null); setError(null); setFirstLoad(true)
    fetchCtMeta(patient.id)
      .then((m) => { if (!alive) return; setMeta(m); setAxis('axial'); setIdx(m.default.axial); setSeg(!!m.has_seg) })
      .catch((e) => alive && setError(e.message))
    return () => { alive = false }
  }, [patient.id, reload])

  const nSlices = meta ? meta.n_slices[axis] : 0
  const changeAxis = (a) => { setAxis(a); setIdx(meta.default[a]) }

  useEffect(() => {
    if (!meta) return
    const onKey = (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') setIdx((i) => Math.min(nSlices - 1, i + 1))
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [meta, nSlices])

  if (error) return (
    <div className="emr-panel p-4 text-center">
      <p className="text-[16px] font-semibold text-danger">CT를 불러오지 못했습니다</p>
      <p className="mt-1 text-[14px] text-ink-soft">{error}</p>
      <button type="button" onClick={() => setReload((n) => n + 1)} className="emr-btn-primary emr-btn mt-3">재시도</button>
    </div>
  )
  if (!meta) return <div className="emr-panel p-8 text-center text-[16px] text-ink-soft">CT 불러오는 중…</div>

  return (
    <div className="space-y-2">
      {/* 상단: 케이스 + 축 + 윈도우 */}
      <div className="flex flex-wrap items-center gap-2 text-[14px]">
        <span className="rounded-sm bg-headbar px-2 py-0.5 font-semibold text-headbar-ink">영상: {meta.case}</span>
        <span className="text-ink-soft">조영증강 CT</span>
        <span className="ml-2 flex items-center gap-1">
          {AXES.map((a) => (
            <button key={a.key} type="button" onClick={() => changeAxis(a.key)}
              className={['rounded-sm border px-2 py-0.5 text-[13px]',
                axis === a.key ? 'border-accent bg-[#eaf2fd] font-bold text-accent' : 'border-line text-ink-soft'].join(' ')}>
              {a.ko}
            </button>
          ))}
        </span>
        <span className="flex items-center gap-1">
          {WINDOWS.map((p) => (
            <button key={p.key} type="button" onClick={() => setWin(p)}
              className={['rounded-sm border px-2 py-0.5 text-[13px]',
                win.key === p.key ? 'border-accent bg-[#eaf2fd] font-bold text-accent' : 'border-line text-ink-soft'].join(' ')}>
              {p.key}
            </button>
          ))}
        </span>
        {/* 종양 오버레이 토글 */}
        <button type="button" disabled={!meta.has_seg} onClick={() => setSeg((s) => !s)}
          title={meta.has_seg ? '종양(GTVp/GTVnd) 오버레이' : '세그멘테이션 없음'}
          className={['ml-auto rounded-sm border px-2 py-0.5 text-[13px] font-semibold',
            !meta.has_seg ? 'border-line text-ink-soft opacity-50'
              : seg ? 'border-[#d62839] bg-[#fbe6e8] text-[#b3303d]' : 'border-line text-ink-soft'].join(' ')}>
          🎯 종양 오버레이 {meta.has_seg ? (seg ? 'ON' : 'OFF') : '없음'}
        </button>
      </div>

      {/* 영상 — CT + 종양 마스크 오버레이(정합) */}
      <div className="relative flex h-[58vh] items-center justify-center overflow-hidden rounded bg-black">
        {firstLoad && <span className="absolute text-[14px] text-white/60">로딩…</span>}
        <div className="relative inline-flex">
          <img
            src={ctSliceUrl(patient.id, idx, { axis, w: win.w, l: win.l })}
            alt={`CT ${axis} ${idx}`}
            className="max-h-[56vh] max-w-full select-none"
            onLoad={() => setFirstLoad(false)}
            draggable={false}
          />
          {seg && meta.has_seg && (
            <img
              src={ctSegUrl(patient.id, idx, { axis })}
              alt="tumor overlay"
              className="pointer-events-none absolute inset-0 h-full w-full"
              draggable={false}
            />
          )}
        </div>
        <span className="absolute bottom-1 right-2 text-[12px] text-white/70 tabular">
          {AXES.find((a) => a.key === axis).ko} {idx + 1} / {nSlices} · W{win.w} L{win.l}
        </span>
        {seg && meta.has_seg && (
          <span className="absolute bottom-1 left-2 flex items-center gap-2 text-[12px] text-white/85">
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: '#d62839' }} />GTVp(원발)</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: '#2b6cb0' }} />GTVnd(림프절)</span>
          </span>
        )}
      </div>

      {/* 슬라이스 컨트롤 */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setIdx((i) => Math.max(0, i - 1))} className="emr-btn">◀</button>
        <input type="range" min={0} max={Math.max(0, nSlices - 1)} value={idx}
          onChange={(e) => setIdx(Number(e.target.value))} className="flex-1 accent-[#2b6cb0]" />
        <button type="button" onClick={() => setIdx((i) => Math.min(nSlices - 1, i + 1))} className="emr-btn">▶</button>
        <span className="w-24 text-right text-[14px] tabular text-ink-soft">{idx + 1} / {nSlices}</span>
      </div>
      <p className="text-[12px] text-ink-soft">↑/↓ 키 또는 슬라이더로 탐색 · 종양 오버레이 = STU-Net GTVp/GTVnd 자동 세그멘테이션 · SegRap2023 검증셋(데모) · 진단용 아님</p>
    </div>
  )
}
