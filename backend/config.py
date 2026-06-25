"""앱 전역 설정. .env 파일이나 환경변수에서 값을 읽어온다."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # 데이터베이스 주소. PostgreSQL 사용. (.env 의 database_url 로 덮어쓸 수 있음)
    # 형식: postgresql+psycopg2://user:password@host:port/dbname
    database_url: str = "postgresql+psycopg2://cdss:cdss@localhost:5432/cdss"

    # JWT 토큰 서명용 비밀키. 실제라면 .env에 따로 두고 절대 공개 금지.
    secret_key: str = "CHANGE_ME_dev_secret_key"
    access_token_expire_minutes: int = 60

    # React 개발 서버 주소 (CORS 허용용)
    frontend_origin: str = "http://localhost:5173"


settings = Settings()
