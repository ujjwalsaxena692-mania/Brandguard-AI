import pytest
from pydantic import ValidationError

from app.core.config import Environment, Settings


def test_defaults_when_environment_is_empty():
    settings = Settings.from_env({})
    assert settings.environment is Environment.DEVELOPMENT
    assert settings.log_level == "INFO"
    assert "http://localhost:5173" in settings.allowed_origins
    assert not settings.supabase_configured
    assert not settings.anthropic_configured
    assert not settings.embedding_configured


def test_blank_values_are_treated_as_unset():
    settings = Settings.from_env({"SUPABASE_URL": "  ", "ANTHROPIC_API_KEY": ""})
    assert settings.supabase_url is None
    assert not settings.anthropic_configured


def test_origins_are_split_and_normalised():
    settings = Settings.from_env({"ALLOWED_ORIGINS": "https://a.example/, https://b.example"})
    assert settings.allowed_origins == ("https://a.example", "https://b.example")


def test_wildcard_origin_is_rejected():
    with pytest.raises(ValidationError):
        Settings.from_env({"ALLOWED_ORIGINS": "*"})


def test_supabase_needs_both_url_and_key():
    only_url = Settings.from_env({"SUPABASE_URL": "https://x.supabase.co"})
    assert not only_url.supabase_configured
    both = Settings.from_env(
        {"SUPABASE_URL": "https://x.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "secret-value"}
    )
    assert both.supabase_configured


def test_embedding_needs_provider_and_key():
    assert not Settings.from_env({"EMBEDDING_PROVIDER": "acme"}).embedding_configured
    assert Settings.from_env(
        {"EMBEDDING_PROVIDER": "acme", "EMBEDDING_API_KEY": "k"}
    ).embedding_configured


def test_secrets_are_not_exposed_in_repr():
    settings = Settings.from_env(
        {"ANTHROPIC_API_KEY": "sk-super-secret", "SUPABASE_SERVICE_ROLE_KEY": "role-secret"}
    )
    text = repr(settings) + str(settings)
    assert "sk-super-secret" not in text
    assert "role-secret" not in text


def test_invalid_log_level_is_rejected():
    with pytest.raises(ValidationError):
        Settings.from_env({"LOG_LEVEL": "LOUD"})


def test_invalid_supabase_url_is_rejected():
    with pytest.raises(ValidationError):
        Settings.from_env({"SUPABASE_URL": "not-a-url"})


def test_settings_are_immutable():
    settings = Settings.from_env({})
    with pytest.raises(ValidationError):
        settings.log_level = "DEBUG"  # type: ignore[misc]
