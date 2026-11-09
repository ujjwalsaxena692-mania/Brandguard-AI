"""Configuration tests for the authentication settings (Part 02B step 2). Pure logic, no network."""

import pytest
from pydantic import ValidationError

from app.core.config import SUPABASE_JWT_ALGORITHMS, Settings

URL = "https://abc.supabase.co"
PUBLISHABLE = "sb_publishable_example_value_123"
SERVICE = "sb_secret_example_value_456"


def test_auth_defaults_when_environment_is_empty():
    settings = Settings.from_env({})
    assert settings.supabase_publishable_key is None
    assert settings.supabase_jwt_audience == "authenticated"
    assert settings.supabase_jwt_leeway_seconds == 30
    assert settings.supabase_jwt_issuer is None
    assert not settings.auth_configured
    assert settings.missing_auth_settings() == ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"]


def test_issuer_is_derived_from_the_supabase_url():
    assert Settings.from_env({"SUPABASE_URL": URL}).supabase_jwt_issuer == f"{URL}/auth/v1"
    # Trailing slash is normalised away by the existing URL validator.
    assert Settings.from_env({"SUPABASE_URL": URL + "/"}).supabase_jwt_issuer == f"{URL}/auth/v1"


def test_missing_publishable_key_does_not_break_loading_or_other_integrations():
    settings = Settings.from_env({"SUPABASE_URL": URL, "SUPABASE_SERVICE_ROLE_KEY": SERVICE})
    assert settings.supabase_configured  # existing behaviour unchanged
    assert not settings.auth_configured
    assert settings.missing_auth_settings() == ["SUPABASE_PUBLISHABLE_KEY"]


def test_blank_publishable_key_is_treated_as_unset():
    settings = Settings.from_env({"SUPABASE_URL": URL, "SUPABASE_PUBLISHABLE_KEY": "   "})
    assert settings.supabase_publishable_key is None
    assert not settings.auth_configured


def test_auth_is_configured_with_url_and_publishable_key():
    settings = Settings.from_env({"SUPABASE_URL": URL, "SUPABASE_PUBLISHABLE_KEY": PUBLISHABLE})
    assert settings.auth_configured
    assert settings.missing_auth_settings() == []
    assert settings.supabase_publishable_key.get_secret_value() == PUBLISHABLE


def test_secret_key_is_rejected_in_the_publishable_slot_without_echoing_it():
    with pytest.raises(ValidationError) as caught:
        Settings.from_env({"SUPABASE_PUBLISHABLE_KEY": "sb_secret_do_not_leak_me"})
    assert "do_not_leak_me" not in str(caught.value)


def test_publishable_key_is_not_shown_in_repr():
    settings = Settings.from_env({"SUPABASE_PUBLISHABLE_KEY": PUBLISHABLE})
    assert PUBLISHABLE not in repr(settings)


def test_audience_can_be_overridden_and_must_not_be_blank():
    assert Settings.from_env({"SUPABASE_JWT_AUDIENCE": " custom "}).supabase_jwt_audience == "custom"
    # Blank env values mean "unset", so the safe default applies.
    assert Settings.from_env({"SUPABASE_JWT_AUDIENCE": "  "}).supabase_jwt_audience == "authenticated"
    with pytest.raises(ValidationError):
        Settings(supabase_jwt_audience="   ")


def test_leeway_is_configurable_within_bounds():
    assert Settings.from_env({"SUPABASE_JWT_LEEWAY_SECONDS": "10"}).supabase_jwt_leeway_seconds == 10
    assert Settings.from_env({"SUPABASE_JWT_LEEWAY_SECONDS": "0"}).supabase_jwt_leeway_seconds == 0
    for bad in ("-1", "121", "3600", "abc", "1.5"):
        with pytest.raises(ValidationError):
            Settings.from_env({"SUPABASE_JWT_LEEWAY_SECONDS": bad})


def test_only_es256_is_ever_allowed_and_cannot_be_configured():
    assert SUPABASE_JWT_ALGORITHMS == ("ES256",)
    settings = Settings.from_env(
        {"SUPABASE_JWT_ALGORITHMS": "HS256,none", "SUPABASE_JWT_ALGORITHM": "HS256"}
    )
    assert settings.supabase_jwt_algorithms == ("ES256",)
    assert not {"HS256", "none", "NONE"} & set(settings.supabase_jwt_algorithms)


def test_no_static_jwt_secret_setting_exists():
    assert not [name for name in Settings.model_fields if "jwt_secret" in name or "secret" in name.replace("service_role", "")]
    settings = Settings.from_env({"SUPABASE_JWT_SECRET": "should-be-ignored"})
    assert "should-be-ignored" not in repr(settings)


def test_public_app_starts_without_the_publishable_key():
    pytest.importorskip("fastapi")
    pytest.importorskip("httpx")
    from fastapi.testclient import TestClient

    from app.main import create_app

    client = TestClient(create_app(Settings.from_env({"APP_ENV": "test"})))
    assert client.get("/health").status_code == 200
