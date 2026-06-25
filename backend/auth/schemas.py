"""인증 관련 요청/응답 데이터 형태 (Pydantic)."""
from pydantic import BaseModel


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "doctor"


class UserOut(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        from_attributes = True  # SQLAlchemy 객체 → 응답 변환 허용


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
