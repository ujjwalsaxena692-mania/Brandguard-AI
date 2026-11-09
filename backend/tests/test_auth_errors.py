"""AuthenticationError and error-response tests. Skipped if FastAPI / httpx are not installed."""

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.errors import (  # noqa: E402
    AppError,
    AuthenticationError,
    ConflictError,
    DatabaseError,
    ForbiddenError,
    IntegrationNotConfiguredError,
    InvalidDataError,
    register_exception_handlers,
)


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/unauthenticated")
    def _unauthenticated():
        raise AuthenticationError()

    @app.get("/forbidden")
    def _forbidden():
        raise ForbiddenError()

    @app.get("/conflict")
    def _conflict():
        raise ConflictError("That record already exists.")

    @app.get("/invalid")
    def _invalid():
        raise InvalidDataError("The data violates a database rule.")

    @app.get("/database")
    def _database():
        raise DatabaseError()

    @app.get("/integration")
    def _integration():
        raise IntegrationNotConfiguredError("Supabase")

    @app.get("/custom")
    def _custom():
        raise AppError("Teapot.", status_code=418, code="teapot", headers={"X-Test": "1"})

    @app.get("/http401")
    def _http401():
        raise HTTPException(status_code=401, detail="nope", headers={"WWW-Authenticate": "Bearer"})

    return TestClient(app, raise_server_exceptions=False)


def test_authentication_error_returns_401(client):
    assert client.get("/unauthenticated").status_code == 401


def test_authentication_error_uses_the_structured_error_format(client):
    body = client.get("/unauthenticated").json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == "unauthorized"
    assert body["error"]["message"] == "Authentication required."
    assert "request_id" in body["error"]
    assert "details" not in body["error"]


def test_authentication_error_sends_www_authenticate_bearer(client):
    assert client.get("/unauthenticated").headers["www-authenticate"] == "Bearer"


def test_authentication_error_message_is_fixed_and_cannot_carry_details():
    assert AuthenticationError().message == "Authentication required."
    with pytest.raises(TypeError):
        AuthenticationError("token expired, kid=abc")  # type: ignore[call-arg]
    assert isinstance(AuthenticationError(), AppError)


def test_authentication_error_headers_are_not_shared_between_instances():
    first = AuthenticationError()
    first.headers["X-Leak"] = "1"
    assert "X-Leak" not in AuthenticationError().headers


def test_existing_errors_keep_their_status_code_and_do_not_send_www_authenticate(client):
    expected = {
        "/forbidden": (403, "forbidden"),
        "/conflict": (409, "conflict"),
        "/invalid": (422, "invalid_data"),
        "/database": (500, "database_error"),
        "/integration": (503, "integration_not_configured"),
    }
    for path, (status, code) in expected.items():
        response = client.get(path)
        assert response.status_code == status, path
        assert response.json()["error"]["code"] == code, path
        assert "www-authenticate" not in response.headers, path


def test_database_error_message_stays_generic(client):
    assert client.get("/database").json()["error"]["message"] == "A database error occurred."


def test_app_error_without_headers_is_unchanged_and_custom_headers_are_supported(client):
    assert AppError("x").headers is None
    response = client.get("/custom")
    assert response.status_code == 418
    assert response.json()["error"]["code"] == "teapot"
    assert response.headers["x-test"] == "1"


def test_plain_http_401_still_maps_to_unauthorized_and_keeps_its_headers(client):
    response = client.get("/http401")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"
    assert response.headers["www-authenticate"] == "Bearer"
