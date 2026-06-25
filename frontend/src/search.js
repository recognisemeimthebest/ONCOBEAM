// 복합 필터 — 검색 카테고리 정의 + 매칭 로직 (App/TitleBar 공용)
import { TREATMENTS } from './data/mockData'

export const stageText = (p) => `${p.stage.t}${p.stage.n}${p.stage.m}`

// 카테고리 노출 순서
export const FIELD_ORDER = [
  '환자번호', '생년월일', '성별', '부위', '병기', '치료법',
]

// 환자 목록에서 동적 옵션(부위)을 도출해 카테고리 정의 생성
export function fieldDefs(patients) {
  const locations = [...new Set(patients.map((p) => p.location))]
  return {
    환자번호: { type: 'text', ph: '환자번호 (예: QIN-HEADNECK-01-0003)' },
    생년월일: { type: 'text', ph: '생년월 (예: 1937.01)' },
    성별: { type: 'enum', options: [{ v: 'M', t: '남 (M)' }, { v: 'F', t: '여 (F)' }] },
    부위: { type: 'enum', options: locations.map((l) => ({ v: l, t: l.split(' ')[0] })) },
    병기: { type: 'text', ph: '병기 (예: T4aN0)' },
    치료법: { type: 'enum', options: TREATMENTS.map((t) => ({ v: String(t.code), t: t.ko })) },
  }
}

// 단일 필터 매칭
export function matchOne(p, f) {
  const q = String(f.value).toLowerCase()
  switch (f.field) {
    case '환자번호': return p.id.toLowerCase().includes(q)
    case '생년월일': return p.birth.toLowerCase().includes(q)
    case '성별': return p.sex === f.value
    case '부위': return p.location === f.value || p.location.toLowerCase().includes(q)
    case '병기': return stageText(p).toLowerCase().includes(q)
    case '치료법': return String(p.plan.treatment) === String(f.value)
    default: return true
  }
}

// 모든 필터 AND 결합
export function matchAll(p, filters) {
  return filters.every((f) => matchOne(p, f))
}
