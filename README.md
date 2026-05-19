# ONCOBEAM

웹서비스 프로젝트.

## Status

초기 세팅 단계입니다. 기술 스택과 팀 규약은 아직 결정되지 않았습니다.
결정사항은 [docs/decisions.md](docs/decisions.md)를 참고하세요.

## 개발 환경

- CI/CD: GitHub Actions + self-hosted runner (`server1-runner`)
- 워크플로우 정의: [.github/workflows/](.github/workflows/)

## 시작하기

```bash
git clone https://github.com/recognisemeimthebest/ONCOBEAM.git
cd ONCOBEAM
```

기술 스택이 결정되면 이 섹션에 의존성 설치 / 개발 서버 실행 방법이 추가됩니다.

## 폴더 구조

```
ONCOBEAM/
├── .github/workflows/   # GitHub Actions 워크플로우
├── docs/                # 회의록, 의사결정 기록
└── README.md
```

향후 추가 예정:
- `frontend/` — UI (스택 미정)
- `backend/` — 서버 (스택 미정)
- `design/` — Figma 시안, 와이어프레임 (필요 시)

## 협업 규칙

팀 결정 후 채워집니다.

- 브랜치 전략: TBD
- 커밋 메시지 규약: TBD
- PR 리뷰 규칙: TBD
