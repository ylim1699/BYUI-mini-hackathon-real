from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All backend configuration. Values come from environment variables
    (Vercel project settings) or a local .env file. Never expose these to the browser."""

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # Where the app is served (used for OAuth redirects), e.g. https://your-app.vercel.app
    app_url: str = "http://localhost:5173"

    # Google Calendar connection (not sign-in)
    google_client_id: str = ""
    google_client_secret: str = ""

    # Outlook connection (Microsoft Entra app registration)
    microsoft_client_id: str = ""
    microsoft_client_secret: str = ""

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    # Backups, in order, if the main model is busy, out of free quota, or not available to this key
    gemini_fallback_models: str = "gemini-3.6-flash,gemini-3.5-flash-lite"

    @property
    def gemini_models(self) -> list[str]:
        out = [self.gemini_model] + [m.strip() for m in self.gemini_fallback_models.split(",")]
        return list(dict.fromkeys(m for m in out if m))  # keep order, drop blanks and repeats
    ai_daily_limit: int = 20          # per browser session per day
    ai_global_daily_limit: int = 300  # whole site per day (protects the free quota)

    encryption_key: str = ""
    canvas_base_url: str = "https://byui.instructure.com"
    allowed_origins: str = "http://localhost:5173"

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def base_url(self) -> str:
        return self.app_url.rstrip("/")

    def missing(self) -> list[str]:
        required = {
            "SUPABASE_URL": self.supabase_url,
            "SUPABASE_ANON_KEY": self.supabase_anon_key,
            "SUPABASE_SERVICE_ROLE_KEY": self.supabase_service_role_key,
            "ENCRYPTION_KEY": self.encryption_key,
        }
        out = [k for k, v in required.items() if not v]
        if self.encryption_key:
            try:
                from cryptography.fernet import Fernet
                Fernet(self.encryption_key.encode())
            except Exception:
                out.append("ENCRYPTION_KEY (not a valid key: generate one with the command in .env.example)")
        return out


@lru_cache
def get_settings() -> Settings:
    return Settings()
