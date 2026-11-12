"""Supabase JWT verification tests. No network: signing keys come from an in-memory fake JWKS.

Tokens are signed with a freshly generated P-256 key, so these tests exercise the real
signature, expiry, audience and issuer checks, not mocks of them.
"""

from __future__ import annotations

import logging
import time
from uuid import UUID, uuid4

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")
pytest.importorskip("jwt")
pytest.importorskip("cryptography")

import jwt  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import ec  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from jwt.exceptions import PyJWKClientConnectionError  # noqa: E402

from app.api.deps import CurrentUser  # noqa: E402
from app.core.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.services.auth import TokenVerifier  # noqa: E402

URL = "https://abc.supabase.co"
ISSUER = f"{URL}/auth/v1"
USER_ID = "7d6b7f0e-3c1a-4b8e-9f52-0a1b2c3d4e5f"
KID = "key-1"
SERVICE_KEY = "sb_secret_do_not_leak_me"


def _make_key() -> ec.EllipticCurvePrivateKey:
    return ec.generate_private_key(ec.SECP256R1())


def _jwk(private_key: ec.EllipticCurvePrivateKey, kid: str) -> jwt.PyJWK:
    data = jwt.algorithms.ECAlgorithm.to_jwk(private_key.public_key(), as_dict=True)
    data.update({"kid": kid, "use": "sig", "alg": "ES256"})
    return jwt.PyJWK.from_dict(data)


class FakeJwks:
    """Stands in for ``jwt.PyJWKClient``: a cached key set, plus what a refresh would return."""

    def __init__(self, keys, after_refresh=None, error=None):
        self.cached = keys
        self.after_refresh = keys if after_refresh is None else after_refresh
        self.error = error
        self.refresh_calls = 0

    def get_signing_keys(self, refresh: bool = False):
        if self.error is not None:
            raise self.error
        if refresh:
            self.refresh_calls += 1
            self.cached = self.after_refresh
        return self.cached


def make_token(private_key, *, kid: str | None = KID, algorithm: str = "ES256", **overrides) -> str:
    now = int(time.time())
    claims = {
        "sub": USER_ID,
        "aud": "authenticated",
        "iss": ISSUER,
        "iat": now,
        "exp": now + 3600,
        "email": "member@example.com",
    }
    claims.update(overrides)
    claims = {name: value for name, value in claims.items() if value is not None}
    headers = {"kid": kid} if kid else {}
    return jwt.encode(claims, private_key, algorithm=algorithm, headers=headers)


def build_client(jwks: FakeJwks, **env: str) -> TestClient:
    settings = Settings.from_env({"APP_ENV": "test", "SUPABASE_URL": URL, **env})
    app = create_app(settings)
    app.state.token_verifier = TokenVerifier(settings, jwks)

    @app.post("/test/whoami")
    def whoami(body: dict, user: CurrentUser):
        # The body may claim any identity; only the verified token decides who the caller is.
        return {"user_id": str(user.user_id), "email": user.email, "claimed": body.get("user_id")}

    return TestClient(app)


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def signing_key():
    return _make_key()


@pytest.fixture
def jwks(signing_key) -> FakeJwks:
    return FakeJwks([_jwk(signing_key, KID)])


@pytest.fixture
def client(jwks) -> TestClient:
    return build_client(jwks)


def assert_401(response):
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    error = response.json()["error"]
    assert error["code"] == "unauthorized"
    assert error["message"] == "Authentication required."  # fixed: never says WHY it failed
    assert "details" not in error


# --- valid token -----------------------------------------------------------------------------


def test_valid_token_returns_the_user_from_the_sub_claim(client, signing_key):
    response = client.get("/api/v1/system/integrations", headers=bearer(make_token(signing_key)))
    assert response.status_code == 200


def test_get_current_user_exposes_verified_user_id_and_email(client, signing_key):
    response = client.post("/test/whoami", json={}, headers=bearer(make_token(signing_key)))
    assert response.status_code == 200
    assert response.json()["user_id"] == str(UUID(USER_ID))
    assert response.json()["email"] == "member@example.com"


def test_user_id_in_request_body_is_never_trusted(client, signing_key):
    other = str(uuid4())
    response = client.post(
        "/test/whoami", json={"user_id": other}, headers=bearer(make_token(signing_key))
    )
    assert response.json()["user_id"] == USER_ID
    assert response.json()["claimed"] == other  # echoed only to prove it was ignored
    # And a body claiming an identity cannot stand in for a token.
    assert_401(client.post("/test/whoami", json={"user_id": other}))


def test_token_slightly_past_expiry_is_accepted_within_leeway(client, signing_key):
    token = make_token(signing_key, exp=int(time.time()) - 5)
    assert client.get("/api/v1/system/integrations", headers=bearer(token)).status_code == 200


# --- missing / malformed credentials ---------------------------------------------------------


def test_missing_authorization_header_is_401(client):
    assert_401(client.get("/api/v1/system/integrations"))


@pytest.mark.parametrize("header", ["Bearer", "Bearer ", "Basic dXNlcjpwYXNz", "token abc", ""])
def test_malformed_authorization_header_is_401(client, header):
    assert_401(client.get("/api/v1/system/integrations", headers={"Authorization": header}))


@pytest.mark.parametrize("token", ["not-a-jwt", "a.b.c", "....", "x" * 500])
def test_garbage_token_is_401(client, token):
    assert_401(client.get("/api/v1/system/integrations", headers=bearer(token)))


# --- invalid tokens --------------------------------------------------------------------------


def test_expired_token_is_401(client, signing_key):
    token = make_token(signing_key, exp=int(time.time()) - 3600)
    assert_401(client.get("/api/v1/system/integrations", headers=bearer(token)))


def test_token_signed_by_a_different_key_is_401(client):
    attacker = _make_key()
    token = make_token(attacker)  # same kid, wrong private key
    assert_401(client.get("/api/v1/system/integrations", headers=bearer(token)))


def test_tampered_payload_is_401(client, signing_key):
    header, _payload, signature = make_token(signing_key).split(".")
    forged = make_token(signing_key, sub=str(uuid4())).split(".")[1]
    token = ".".join([header, forged, signature])
    assert_401(client.get("/api/v1/system/integrations", headers=bearer(token)))


def test_wrong_audience_is_401(client, signing_key):
    token = make_token(signing_key, aud="anon")
    assert_401(client.get("/api/v1/system/integrations", headers=bearer(token)))


def test_wrong_issuer_is_401(client, signing_key):
    token = make_token(signing_key, iss="https://evil.example/auth/v1")
    assert_401(client.get("/api/v1/system/integrations", headers=bearer(token)))


@pytest.mark.parametrize("missing", ["sub", "exp", "aud", "iss"])
def test_token_missing_a_required_claim_is_401(client, signing_key, missing):
    token = make_token(signing_key, **{missing: None})
    assert_401(client.get("/api/v1/system/integrations", headers=bearer(token)))


def test_subject_that_is_not_a_uuid_is_401(client, signing_key):
    token = make_token(signing_key, sub="not-a-uuid")
    assert_401(client.get("/api/v1/system/integrations", headers=bearer(token)))


def test_hs256_token_is_rejected_algorithm_confusion(client):
    token = jwt.encode(
        {"sub": USER_ID, "aud": "authenticated", "iss": ISSUER, "exp": int(time.time()) + 3600},
        "a-shared-secret-of-sufficient-length-1234",
        algorithm="HS256",
        headers={"kid": KID},
    )
    assert_401(client.get("/api/v1/system/integrations", headers=bearer(token)))


def test_unsigned_alg_none_token_is_rejected(client):
    token = jwt.encode(
        {"sub": USER_ID, "aud": "authenticated", "iss": ISSUER, "exp": int(time.time()) + 3600},
        None,
        algorithm="none",
        headers={"kid": KID},
    )
    assert_401(client.get("/api/v1/system/integrations", headers=bearer(token)))


def test_token_without_a_key_id_is_401(client, signing_key):
    assert_401(
        client.get("/api/v1/system/integrations", headers=bearer(make_token(signing_key, kid=None)))
    )


# --- key rotation and key-set failures -------------------------------------------------------


def test_unknown_key_id_refreshes_the_key_set_once_and_accepts_a_rotated_key(signing_key):
    new_key = _make_key()
    jwks = FakeJwks([_jwk(signing_key, KID)], after_refresh=[_jwk(new_key, "key-2")])
    client = build_client(jwks)
    token = make_token(new_key, kid="key-2")
    assert client.get("/api/v1/system/integrations", headers=bearer(token)).status_code == 200
    assert jwks.refresh_calls == 1


def test_unknown_key_ids_cannot_force_repeated_key_set_refreshes(client, jwks, signing_key):
    for attempt in range(5):
        token = make_token(signing_key, kid=f"unknown-{attempt}")
        assert_401(client.get("/api/v1/system/integrations", headers=bearer(token)))
    assert jwks.refresh_calls == 1  # rate-limited, not one Supabase call per bad token


def test_unreachable_key_set_is_503_not_401(signing_key):
    jwks = FakeJwks([], error=PyJWKClientConnectionError("down"))
    client = build_client(jwks)
    response = client.get("/api/v1/system/integrations", headers=bearer(make_token(signing_key)))
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "auth_unavailable"


def test_auth_not_configured_fails_closed_with_503(signing_key):
    settings = Settings.from_env({"APP_ENV": "test"})  # no SUPABASE_URL
    client = TestClient(create_app(settings))
    # No token is still a plain 401; a token we cannot verify is never accepted.
    assert_401(client.get("/api/v1/system/integrations"))
    response = client.get("/api/v1/system/integrations", headers=bearer(make_token(signing_key)))
    assert response.status_code == 503


# --- route protection ------------------------------------------------------------------------


def test_health_stays_public(client):
    assert client.get("/health").status_code == 200


def test_integrations_is_no_longer_public(client):
    assert_401(client.get("/api/v1/system/integrations"))


def test_service_role_key_is_never_in_responses_or_logs(signing_key, caplog):
    jwks = FakeJwks([_jwk(signing_key, KID)])
    client = build_client(jwks, SUPABASE_SERVICE_ROLE_KEY=SERVICE_KEY)
    good = make_token(signing_key)
    bad = make_token(_make_key())
    with caplog.at_level(logging.DEBUG):
        ok = client.get("/api/v1/system/integrations", headers=bearer(good))
        rejected = client.get("/api/v1/system/integrations", headers=bearer(bad))
    assert ok.status_code == 200 and rejected.status_code == 401
    assert SERVICE_KEY not in ok.text + rejected.text + caplog.text


def test_tokens_are_never_logged_or_returned(client, signing_key, caplog):
    token = make_token(signing_key, exp=int(time.time()) - 3600)
    with caplog.at_level(logging.DEBUG):
        response = client.get("/api/v1/system/integrations", headers=bearer(token))
    assert response.status_code == 401
    assert token not in response.text
    assert token not in caplog.text
    assert token.split(".")[1] not in caplog.text
