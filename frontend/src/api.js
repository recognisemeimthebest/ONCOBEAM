// 백엔드(CDSS FastAPI) + 실모델 서비스 연동 클라이언트.
// 모든 환자 API는 JWT 로그인 필요. 네트워크/타임아웃/HTTP 오류를 구분해 친절히 보고한다.
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'
const MODEL_BASE = import.meta.env.VITE_MODEL_BASE ?? 'http://localhost:8011'
const TOKEN_KEY = 'cdss_token'
const TIMEOUT_MS = 30000

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

// 세션 만료(401) 발생 시 앱이 로그인 화면으로 돌아가도록 알림.
let onAuthExpired = null
export const setAuthExpiredHandler = (fn) => { onAuthExpired = fn }

// 공통 요청 — 타임아웃(AbortController) + 오류 분류.
async function request(base, path, { method = 'GET', body, form, auth = false, label = '서버' } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const headers = {}
  if (auth) headers.Authorization = `Bearer ${getToken()}`
  let payload
  if (form) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; payload = form }
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }

  let res
  try {
    res = await fetch(`${base}${path}`, { method, headers, body: payload, signal: ctrl.signal })
  } catch (e) {
    clearTimeout(timer)
    if (e.name === 'AbortError') throw new Error(`${label} 응답 시간 초과 — 서버 상태를 확인하세요.`)
    throw new Error(`${label}에 연결할 수 없습니다 (${base}). 서비스가 실행 중인지 확인하세요.`)
  }
  clearTimeout(timer)

  if (res.status === 401) {
    clearToken()
    onAuthExpired?.()
    throw new Error('세션이 만료되었습니다. 다시 로그인하세요.')
  }
  if (!res.ok) {
    const m = await res.json().catch(() => null)
    throw new Error(m?.detail ?? `${label} 요청 실패 (${res.status})`)
  }
  return res.json().catch(() => null)
}

// ── 인증 ─────────────────────────────────────────────────────────────────────
export async function login(username, password) {
  const data = await request(API_BASE, '/api/auth/login', {
    method: 'POST', form: new URLSearchParams({ username, password }), label: '로그인 서버',
  })
  setToken(data.access_token)
  return data.access_token
}
export const fetchMe = () => request(API_BASE, '/api/auth/me', { auth: true, label: '백엔드 서버' })

// ── 환자/결정 (백엔드 8000) ──────────────────────────────────────────────────
export const fetchPatients = () => request(API_BASE, '/api/patients', { auth: true, label: '백엔드 서버' })
export const recordDecision = (payload) =>
  request(API_BASE, '/api/cdss/decision', { method: 'POST', body: payload, auth: true, label: '백엔드 서버' })
export const fetchLatestDecision = (patientId) =>
  request(API_BASE, `/api/cdss/decision/${encodeURIComponent(patientId)}`, { auth: true, label: '백엔드 서버' })
// 결정 이력(감사 추적). patientId 주면 해당 환자만.
export const fetchDecisions = (limit = 100, patientId) =>
  request(API_BASE, `/api/cdss/decisions?limit=${limit}${patientId ? `&patient_id=${encodeURIComponent(patientId)}` : ''}`,
    { auth: true, label: '백엔드 서버' })

// ── 실모델 서비스 (8011) ─────────────────────────────────────────────────────
export const fetchActivePatients = () =>
  request(MODEL_BASE, '/active_patients', { label: 'AI 모델 서비스' })
// 목록 트리아지용 경량 일괄 위험·권고 (20명 한 호출).
export const fetchTriageAll = () =>
  request(MODEL_BASE, '/triage_all', { label: 'AI 모델 서비스' })
export const predictPatient = (patientId) =>
  request(MODEL_BASE, '/predict', { method: 'POST', body: { patient_id: patientId }, label: 'AI 모델 서비스' })

// ── CT 뷰어 ──────────────────────────────────────────────────────────────────
export const fetchCtMeta = (patientId) =>
  request(MODEL_BASE, `/ct/${encodeURIComponent(patientId)}/meta`, { label: 'CT 뷰어' })
export const ctSliceUrl = (patientId, idx, { axis = 'axial', w = 350, l = 40 } = {}) =>
  `${MODEL_BASE}/ct/${encodeURIComponent(patientId)}/slice/${idx}?axis=${axis}&w=${w}&l=${l}`
