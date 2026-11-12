"""API tests. Skipped automatically if FastAPI / httpx are not installed."""

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from uuid import uuid4  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

from app.api.deps import get_current_user  # noqa: E402
from app.core.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.services.auth import AuthenticatedUser  # noqa: E402


def authenticated_client(settings: Settings) -> TestClient:
    """A client whose requests count as signed in (token verification itself is tested in
    test_auth_verification.py)."""
    app = create_app(settings)
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(user_id=uuid4())
    return TestClient(app)


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(Settings.from_env({"APP_ENV": "test"})))


def test_health_reports_ok(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["environment"] == "test"
    assert "timestamp" in body


def test_request_id_header_is_returned(client: TestClient):
    response = client.get("/health")
    assert response.headers.get("x-request-id")


def test_safe_client_request_id_is_echoed(client: TestClient):
    response = client.get("/health", headers={"X-Request-ID": "abc12345-test"})
    assert response.headers["x-request-id"] == "abc12345-test"


def test_unsafe_client_request_id_is_replaced(client: TestClient):
    response = client.get("/health", headers={"X-Request-ID": "bad id with spaces"})
    assert response.headers["x-request-id"] != "bad id with spaces"


def test_integrations_report_not_configured_without_credentials():
    client = authenticated_client(Settings.from_env({"APP_ENV": "test"}))
    response = client.get("/api/v1/system/integrations")
    assert response.status_code == 200
    states = {item["key"]: item["state"] for item in response.json()["integrations"]}
    assert states == {
        "supabase": "not_configured",
        "anthropic": "not_configured",
        "embedding": "not_configured",
    }


def test_integrations_never_return_secret_values():
    settings = Settings.from_env({"ANTHROPIC_API_KEY": "sk-super-secret"})
    response = authenticated_client(settings).get("/api/v1/system/integrations")
    assert "sk-super-secret" not in response.text
    states = {item["key"]: item["state"] for item in response.json()["integrations"]}
    assert states["anthropic"] == "configured"


def test_integrations_requires_authentication(client: TestClient):
    response = client.get("/api/v1/system/integrations")
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_unknown_route_returns_structured_error(client: TestClient):
    response = client.get("/does-not-exist")
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "not_found"
    assert error["request_id"]


def test_cors_allows_configured_origin_only(client: TestClient):
    allowed = client.options(
        "/health",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"
    blocked = client.options(
        "/health",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in blocked.headers
