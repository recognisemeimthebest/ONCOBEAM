// 백엔드(CDSS FastAPI) 연동 클라이언트.
// 환자 데이터는 PostgreSQL DB에서 가져온다. 모든 환자 API는 JWT 로그인이 필요하다.
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'
const TOKEN_KEY = 'cdss_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

// 로그인 — OAuth2 password 폼 형식으로 토큰을 받는다.
export async function login(username, password) {
  const body = new URLSearchParams({ username, password })
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const msg = await res.json().catch(() => null)
    throw new Error(msg?.detail ?? '로그인에 실패했습니다.')
  }
  const data = await res.json()
  setToken(data.access_token)
  return data.access_token
}

// 인증이 필요한 GET 요청 공통 래퍼.
async function authGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (res.status === 401) {
    clearToken()
    throw new Error('세션이 만료되었습니다. 다시 로그인하세요.')
  }
  if (!res.ok) throw new Error(`요청 실패 (${res.status})`)
  return res.json()
}

// 인증이 필요한 POST 요청 공통 래퍼.
async function authPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 401) {
    clearToken()
    throw new Error('세션이 만료되었습니다. 다시 로그인하세요.')
  }
  if (!res.ok) {
    const m = await res.json().catch(() => null)
    throw new Error(m?.detail ?? `요청 실패 (${res.status})`)
  }
  return res.json()
}

// DB의 전체 환자(38컬럼 임상 스키마) 목록.
export const fetchPatients = () => authGet('/api/patients')

// 현재 로그인 사용자 (토큰 유효성 확인용).
export const fetchMe = () => authGet('/api/auth/me')

// AI 권고 수락/기각 결정 기록 (closed-loop, audit_log).
export const recordDecision = (payload) => authPost('/api/cdss/decision', payload)
// 환자의 가장 최근 결정 조회.
export const fetchLatestDecision = (patientId) =>
  authGet(`/api/cdss/decision/${encodeURIComponent(patientId)}`)

// ── 실모델 서비스 (causalforest / xgb / shap) ────────────────────────────────
const MODEL_BASE = import.meta.env.VITE_MODEL_BASE ?? 'http://localhost:8011'

// 영상(라디오믹스)이 배정돼 EMR에 노출할 활성 환자 목록.
export async function fetchActivePatients() {
  const res = await fetch(`${MODEL_BASE}/active_patients`)
  if (!res.ok) throw new Error('활성 환자 조회 실패')
  return res.json() // { patient_ids: [...], items: [{patient_id, image_case}] }
}

// 환자별 실모델 예측 (CATE 4대비 + xgb 위험 + SHAP).
export async function predictPatient(patientId) {
  const res = await fetch(`${MODEL_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id: patientId }),
  })
  if (!res.ok) {
    const m = await res.json().catch(() => null)
    throw new Error(m?.detail ?? `예측 실패 (${res.status})`)
  }
  return res.json()
}
