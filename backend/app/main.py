from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routes import canvas, google, me, syllabus, summary


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="Syllabus Planner API", docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.get("/api/health")
    async def health() -> dict[str, object]:
        st = get_settings()
        return {
            "ok": not st.missing(),
            "missing": st.missing(),
            "ai": bool(st.gemini_api_key),
            "google": bool(st.google_client_id and st.google_client_secret),
        }

    for r in (me.router, canvas.router, syllabus.router, google.router, summary.router):
        app.include_router(r, prefix="/api")
    return app


app = create_app()
