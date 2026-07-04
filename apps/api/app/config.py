from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Application
    app_name: str = "WikiBridge API"
    debug: bool = False
    api_prefix: str = "/api"
    internal_service_token: str = "wikibridge-internal-dev-token"

    # Database
    database_url: str = "postgresql+asyncpg://wikibridge:wikibridge@postgres:5432/wikibridge"

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # Ollama — tuned for CPU-only workstations (low RAM)
    ollama_base_url: str = "http://host.docker.internal:11434"
    chat_model: str = "qwen2.5:3b-instruct"
    embedding_model: str = "bge-m3"
    embedding_dim: int = 1024
    ollama_num_ctx: int = 4096
    ollama_num_predict: int = 1500
    ollama_num_predict_short: int = 700
    ollama_max_continue_rounds: int = 2
    ollama_num_thread: int = 0
    ollama_keep_alive: str = "5m"
    ollama_max_concurrency: int = 1

    # Wiki.js
    wikijs_url: str = "http://wikijs.local"
    wikijs_api_key: str = ""
    wikijs_ssl_verify: bool = False
    wikijs_locale: str = "es"

    # Auth (API-side validation in later phases)
    auth_mode: str = "local"  # local | ldap

    # Ingest
    chunk_min_tokens: int = 300
    chunk_max_tokens: int = 600
    chunk_overlap_tokens: int = 50
    nightly_sync_cron_hour: int = 2
    ingest_job_timeout_seconds: int = 7200

    # RAG / Chat
    rag_search_top_k: int = 10
    rag_final_chunks: int = 4
    rag_summary_final_chunks: int = 8
    rag_chunk_max_chars: int = 900
    rag_diary_max_chars: int = 6000
    rrf_k: int = 60
    query_embedding_cache_ttl_seconds: int = 300
    rag_validated_qa_enabled: bool = True
    rag_validated_qa_similarity_threshold: float = 0.80
    rag_validated_qa_max_results: int = 2

    # Staleness / health (Phase 3+)
    staleness_procedure_days: int = 180
    staleness_reference_days: int = 365
    internal_host_whitelist: str = ""
    contradiction_similarity_threshold: float = 0.85
    contradiction_max_pairs: int = 5
    health_scan_after_ingest: bool = True

    # LDAP (Phase 6)
    ldap_url: str = ""
    ldap_base_dn: str = ""
    ldap_bind_dn: str = ""
    ldap_bind_password: str = ""
    ldap_user_filter: str = "(sAMAccountName={username})"
    ldap_admin_group: str = ""
    ldap_editor_group: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
