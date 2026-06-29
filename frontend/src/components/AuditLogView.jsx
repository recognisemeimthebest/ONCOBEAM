import { useEffect, useState } from 'react'
import { fetchDecisions } from '../api'

// 감사 로그 — AI 권고 수락/기각 결정 이력 (CDSS 책임 추적).
const fmt = (iso) => {
  if (!iso) return ''
  const d = new Date(iso); const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function AuditLogView({ nameById = {} }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let alive = true
    setItems(null); setError(null)
    fetchDecisions(200)
      .then((d) => alive && setItems(d.items))
      .catch((e) => alive && setError(e.message))
    return () => { alive = false }
  }, [reload])

  if (error) return (
    <div className="p-4 text-center">
      <p className="text-[15px] text-danger">{error}</p>
      <button type="button" onClick={() => setReload((n) => n + 1)} className="emr-btn-primary emr-btn mt-2">재시도</button>
    </div>
  )
  if (!items) return <div className="p-6 text-center text-[15px] text-ink-soft">불러오는 중…</div>

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[13px] text-ink-soft">
        <span>AI 권고에 대한 의료진 결정 기록 (audit_log)</span>
        <span className="ml-auto tabular">{items.length}건</span>
        <button type="button" onClick={() => setReload((n) => n + 1)} className="emr-btn">새로고침</button>
      </div>
      {items.length === 0 ? (
        <p className="emr-panel p-6 text-center text-[15px] text-ink-soft">아직 결정 기록이 없습니다.</p>
      ) : (
        <div className="max-h-[60vh] overflow-auto">
          <table className="emr-table">
            <thead>
              <tr>
                <th className="w-36">시각</th>
                <th className="w-16">사용자</th>
                <th>환자</th>
                <th className="w-20">결정</th>
                <th>권고 → 선택</th>
                <th>사유</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="tabular text-ink-soft">{fmt(it.created_at)}</td>
                  <td>{it.username}</td>
                  <td className="tabular">
                    <b>{nameById[it.patient_id] ?? '—'}</b> <span className="text-ink-soft">{it.patient_id}</span>
                  </td>
                  <td>
                    <span className="rounded-sm px-1.5 py-0.5 text-[13px] font-bold"
                      style={it.action === 'accept' ? { background: '#e6f5ec', color: '#1f7a44' } : { background: '#fdf2e0', color: '#b8730a' }}>
                      {it.action === 'accept' ? '✓ 수락' : '✎ 기각'}
                    </span>
                  </td>
                  <td className="text-ink">
                    <span className="text-ink-soft">{it.recommended_label ?? '—'}</span>
                    {it.action === 'override' && <> → <b>{it.chosen_label ?? '—'}</b></>}
                  </td>
                  <td className="text-ink">{it.reason ?? <span className="text-ink-soft">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
