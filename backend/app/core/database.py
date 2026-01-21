"""Database Module - SQLite (dev) and Cloudflare D1 (prod)"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import Column, String, Float, Integer, DateTime, Text, Boolean, JSON
from datetime import datetime
import httpx
from typing import Optional, List, Dict, Any

from app.core.config import settings, cf_endpoints

Base = declarative_base()

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class FeedbackModel(Base):
    __tablename__ = "feedback"
    id = Column(String(36), primary_key=True)
    content = Column(Text, nullable=False)
    source = Column(String(50), nullable=False)
    sentiment = Column(Float, default=0.0)
    sentiment_label = Column(String(50))
    urgency = Column(Integer, default=5)
    product = Column(String(100))
    themes = Column(JSON, default=list)
    customer_id = Column(String(36))
    customer_name = Column(String(255))
    customer_tier = Column(String(50))
    customer_arr = Column(Integer)
    status = Column(String(50), default="new")
    assigned_to = Column(String(255))
    extra_data = Column(JSON, default=dict)  # renamed from metadata (reserved in SQLAlchemy)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CustomerModel(Base):
    __tablename__ = "customers"
    id = Column(String(36), primary_key=True)
    name = Column(String(255), nullable=False)
    tier = Column(String(50), default="free")
    arr = Column(Integer, default=0)
    products = Column(JSON, default=list)
    health_score = Column(Float, default=0.5)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AlertModel(Base):
    __tablename__ = "alerts"
    id = Column(String(36), primary_key=True)
    type = Column(String(50), nullable=False)
    message = Column(Text, nullable=False)
    product = Column(String(100))
    acknowledged = Column(Boolean, default=False)
    feedback_ids = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)


class ThemeModel(Base):
    __tablename__ = "themes"
    id = Column(String(36), primary_key=True)
    theme = Column(String(255), nullable=False)
    mentions = Column(Integer, default=0)
    sentiment = Column(String(50))
    products = Column(JSON, default=list)
    is_new = Column(Boolean, default=True)
    summary = Column(Text)
    suggested_action = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    await engine.dispose()


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session


class D1Client:
    def __init__(self):
        self.account_id = settings.CLOUDFLARE_ACCOUNT_ID
        self.database_id = settings.D1_DATABASE_ID
        self.api_token = settings.CLOUDFLARE_API_TOKEN
        self.headers = {"Authorization": f"Bearer {self.api_token}", "Content-Type": "application/json"}
    
    async def execute(self, sql: str, params: Optional[List[Any]] = None) -> Dict[str, Any]:
        url = cf_endpoints.d1_query(self.account_id, self.database_id)
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=self.headers, json={"sql": sql, "params": params or []})
            response.raise_for_status()
            return response.json()
    
    async def query(self, sql: str, params: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
        result = await self.execute(sql, params)
        if result.get("success") and result.get("result"):
            return result["result"][0].get("results", [])
        return []
    
    async def insert(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        columns = ", ".join(data.keys())
        placeholders = ", ".join(["?" for _ in data])
        sql = f"INSERT INTO {table} ({columns}) VALUES ({placeholders})"
        return await self.execute(sql, list(data.values()))
    
    async def update(self, table: str, id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        set_clause = ", ".join([f"{k} = ?" for k in data.keys()])
        sql = f"UPDATE {table} SET {set_clause} WHERE id = ?"
        return await self.execute(sql, list(data.values()) + [id])
    
    async def delete(self, table: str, id: str) -> Dict[str, Any]:
        return await self.execute(f"DELETE FROM {table} WHERE id = ?", [id])


d1_client = D1Client()
