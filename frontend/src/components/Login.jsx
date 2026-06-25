import { useState } from 'react'
import { login } from '../api'

// 로그인 화면 — JWT 토큰을 받아 환자 API 접근을 연다.
export default function Login({ onSuccess }) {
  const [username, setUsername] = useState('doctor')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(username.trim(), password)
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-navy text-ink">
      <form
        onSubmit={submit}
        className="w-80 rounded-lg bg-bg p-6 shadow-xl"
      >
        <div className="mb-5 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-accent text-[12px] font-bold text-white">
            H&amp;N
          </span>
          <div>
            <div className="text-[15px] font-bold">세나RT의원 EMR</div>
            <div className="text-[11px] text-ink-soft">두경부암 RT 클리닉 · CDSS</div>
          </div>
        </div>

        <label className="mb-1 block text-[11px] font-semibold text-ink-soft">아이디</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="emr-input mb-3 w-full"
          autoComplete="username"
        />

        <label className="mb-1 block text-[11px] font-semibold text-ink-soft">비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="emr-input mb-4 w-full"
          autoComplete="current-password"
          autoFocus
        />

        {error && (
          <p className="mb-3 rounded border border-[#f1c4c9] bg-[#fbe6e8] px-2 py-1.5 text-[11px] text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="emr-btn-primary emr-btn w-full justify-center disabled:opacity-60"
        >
          {busy ? '로그인 중…' : '로그인'}
        </button>

        <p className="mt-3 text-center text-[10.5px] text-ink-soft">
          데모 계정 · doctor / cdss1234
        </p>
      </form>
    </div>
  )
}
