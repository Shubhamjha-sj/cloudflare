"""Application Configuration"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "Signal API"
    DEBUG: bool = False
    SECRET_KEY: str = "your-secret-key-change-in-production"
    API_V1_PREFIX: str = "/api"
    
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://signal-dashboard.pages.dev",
    ]
    
    # Cloudflare Configuration
    CLOUDFLARE_ACCOUNT_ID: str = ""
    CLOUDFLARE_API_TOKEN: str = ""
    D1_DATABASE_ID: str = ""
    D1_DATABASE_NAME: str = "signal-feedback-db"
    VECTORIZE_INDEX_NAME: str = "signal-embeddings"
    VECTORIZE_DIMENSIONS: int = 768
    AI_SEARCH_INDEX_NAME: str = "signal-knowledge"
    QUEUE_NAME: str = "signal-feedback-queue"
    
    # Workers AI Models
    EMBEDDING_MODEL: str = "@cf/baai/bge-base-en-v1.5"
    SENTIMENT_MODEL: str = "@cf/huggingface/distilbert-sst-2-int8"
    TEXT_GENERATION_MODEL: str = "@cf/meta/llama-3.1-8b-instruct"
    SUMMARIZATION_MODEL: str = "@cf/facebook/bart-large-cnn"
    
    # Local Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./signal.db"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()


class CloudflareEndpoints:
    BASE_URL = "https://api.cloudflare.com/client/v4"
    
    @classmethod
    def d1_query(cls, account_id: str, database_id: str) -> str:
        return f"{cls.BASE_URL}/accounts/{account_id}/d1/database/{database_id}/query"
    
    @classmethod
    def vectorize_query(cls, account_id: str, index_name: str) -> str:
        return f"{cls.BASE_URL}/accounts/{account_id}/vectorize/indexes/{index_name}/query"
    
    @classmethod
    def vectorize_insert(cls, account_id: str, index_name: str) -> str:
        return f"{cls.BASE_URL}/accounts/{account_id}/vectorize/indexes/{index_name}/insert"
    
    @classmethod
    def workers_ai(cls, account_id: str, model: str) -> str:
        return f"{cls.BASE_URL}/accounts/{account_id}/ai/run/{model}"
    
    @classmethod
    def queue_send(cls, account_id: str, queue_name: str) -> str:
        return f"{cls.BASE_URL}/accounts/{account_id}/queues/{queue_name}/messages"
    
    @classmethod
    def ai_search_query(cls, account_id: str, index_name: str) -> str:
        return f"{cls.BASE_URL}/accounts/{account_id}/ai-search/indexes/{index_name}/search"


cf_endpoints = CloudflareEndpoints()
