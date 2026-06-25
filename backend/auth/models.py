"""사용자(User) 테이블 정의."""
from sqlalchemy import Column, Integer, String

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)  # 비밀번호는 해시해서만 저장
    # 권한 구분 (예: doctor, nurse, admin) — CDSS는 역할별 접근 제어가 중요
    role = Column(String, default="doctor")
