"""
Signal - Customer Feedback Intelligence Platform
Main FastAPI Application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import structlog

from app.api import feedback, analytics, chat, customers, alerts, webhooks, search
from app.core.config import settings
from app.core.database import init_db, close_db

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown."""
    logger.info("Starting Signal API server")
    await init_db()
    logger.info("Database initialized")
    
    yield
    
    logger.info("Shutting down Signal API server")
    await close_db()


app = FastAPI(
    title="Signal API",
    description="Customer Feedback Intelligence Platform API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(feedback.router, prefix="/api/feedback", tags=["Feedback"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(chat.router, prefix="/api/chat", tags=["AI Chat"])
app.include_router(customers.router, prefix="/api/customers", tags=["Customers"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks"])
app.include_router(search.router, prefix="/api/search", tags=["Search"])


@app.get("/")
async def root():
    return {"name": "Signal API", "version": "1.0.0", "status": "healthy", "docs": "/api/docs"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
