"""API 배선 smoke 테스트 — TestClient (DB 변경 없음)."""
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_openapi_has_core_endpoints():
    paths = main.app.openapi()["paths"]
    for p in ["/api/auth/login", "/api/patients", "/api/cdss/hte", "/api/cdss/prognosis"]:
        assert p in paths, f"누락된 엔드포인트: {p}"


def test_protected_endpoint_requires_auth():
    # 토큰 없이 보호된 예측 호출 → 401
    r = client.post("/api/cdss/prognosis", json={"features": {"age": 60}})
    assert r.status_code == 401
