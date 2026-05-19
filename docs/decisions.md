# Decisions

프로젝트의 주요 결정사항을 기록합니다.
새 결정사항은 위에 추가합니다 (최신순).

---

## 2026-05-19 — CI/CD: GitHub Actions + self-hosted runner

- 공용 Linux PC에 self-hosted runner를 등록하여 빌드/배포를 실행
- Runner 이름: `server1-runner`
- Runner 라벨: `self-hosted, linux, python, docker`
- 워크플로우는 `.github/workflows/*.yml`에 정의
- 첫 워크플로우 `hello.yml`: push/수동 트리거 시 환경 정보를 출력하는 검증용

---

## TBD — 결정 필요

다음 회의에서 결정할 항목들:

- [ ] 프론트엔드 스택 (React / Next.js / Vue / 기타)
- [ ] 백엔드 스택 (FastAPI / Django / Flask / 기타)
- [ ] 데이터베이스 (PostgreSQL / MySQL / SQLite / 기타)
- [ ] 호스팅/배포 환경
- [ ] 팀원 역할 분담
- [ ] 브랜치 전략 (main only / GitHub Flow / Git Flow)
- [ ] 커밋 메시지 규약 (Conventional Commits 채택 여부)
- [ ] PR 리뷰 규칙 (필수 리뷰어 수, 직접 push 허용 여부)
- [ ] 폴더 구조 확정 (monorepo vs 분리)
