"""FastAPI 앱 시작점 (모놀리식 백엔드).

실행: backend/ 폴더에서
    uvicorn main:app --reload
문서: http://localhost:8000/docs  (Swagger에서 바로 API 테스트 가능)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings

from auth.router import router as auth_router
from patients.router import router as patients_router
from cdss.router import router as cdss_router

# 스키마는 Alembic 마이그레이션이 단일 소스로 관리한다 (create_all 제거).
#   테이블 생성/변경:  cd backend && alembic upgrade head
#   모델 수정 후 마이그레이션 생성:  alembic revision --autogenerate -m "설명"

app = FastAPI(title="CDSS API", version="0.1.0")

# React 개발 서버에서 호출할 수 있도록 CORS 허용.
# vite 가 5173 이 점유되면 5174/5175 등으로 옮겨가므로 localhost 임의 포트를 허용한다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 각 도메인 모듈의 라우터를 등록
app.include_router(auth_router)
app.include_router(patients_router)
app.include_router(cdss_router)


@app.get("/api/health")
def health():
    """서버가 살아있는지 확인하는 헬스체크."""
    return {"status": "ok"}
