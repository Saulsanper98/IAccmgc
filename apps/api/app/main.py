from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.admin_ingest import router as admin_ingest_router
from app.api.routes.admin_validated_qa import router as admin_validated_qa_router
from app.api.routes.auth_ldap import router as auth_ldap_router
from app.api.routes.chat import router as chat_router
from app.api.routes.chat_instructions import router as chat_instructions_router
from app.api.routes.document_health import router as document_health_router
from app.api.routes.health import router as health_router
from app.api.routes.runbooks import router as runbooks_router
from app.config import get_settings
from app.logging_config import setup_logging
from app.services.ollama import OllamaClient, close_http_client
from app.services.query_cache import close_redis_client


async def _warm_ollama_models() -> None:
    settings = get_settings()
    client = OllamaClient(settings)
    try:
        await client.embed_text("precalentamiento")
        async for _token in client.chat_stream(
            [{"role": "user", "content": "ok"}],
            "Responde solo: listo",
        ):
            break
    except Exception:
        import logging

        logging.getLogger(__name__).warning("Ollama warm-up failed", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    setup_logging(settings.debug)
    await _warm_ollama_models()
    yield
    await close_http_client()
    await close_redis_client()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router, prefix=settings.api_prefix)
    app.include_router(admin_ingest_router, prefix=settings.api_prefix)
    app.include_router(admin_validated_qa_router, prefix=settings.api_prefix)
    app.include_router(chat_router, prefix=settings.api_prefix)
    app.include_router(chat_instructions_router, prefix=settings.api_prefix)
    app.include_router(document_health_router, prefix=settings.api_prefix)
    app.include_router(runbooks_router, prefix=settings.api_prefix)
    app.include_router(auth_ldap_router, prefix=settings.api_prefix)

    return app


app = create_app()
