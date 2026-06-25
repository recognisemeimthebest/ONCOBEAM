"""데이터베이스 연결 및 세션 관리 (SQLAlchemy)."""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from config import settings

# SQLite는 같은 스레드에서만 쓰도록 기본 제한이 있어 옵션을 푼다.
connect_args = (
    {"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {}
)

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 모든 테이블(모델)이 상속할 기본 클래스
Base = declarative_base()


def get_db():
    """요청마다 DB 세션을 열고, 끝나면 닫는 FastAPI 의존성."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
