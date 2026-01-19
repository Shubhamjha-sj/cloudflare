"""Pydantic Models for API Request/Response Validation"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class FeedbackSource(str, Enum):
    GITHUB = "github"
    DISCORD = "discord"
    TWITTER = "twitter"
    SUPPORT = "support"
    FORUM = "forum"
    EMAIL = "email"


class SentimentLabel(str, Enum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    FRUSTRATED = "frustrated"
    CONCERNED = "concerned"
    ANNOYED = "annoyed"


class CustomerTier(str, Enum):
    ENTERPRISE = "enterprise"
    PRO = "pro"
    FREE = "free"
    UNKNOWN = "unknown"


class FeedbackStatus(str, Enum):
    NEW = "new"
    IN_REVIEW = "in_review"
    ACKNOWLEDGED = "acknowledged"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class AlertType(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class TimeRange(str, Enum):
    DAY = "24h"
    WEEK = "7d"
    MONTH = "30d"
    QUARTER = "90d"


class FeedbackBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)
    source: FeedbackSource
    product: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_tier: Optional[CustomerTier] = None
    customer_arr: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class FeedbackCreate(FeedbackBase):
    pass


class FeedbackUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=1, max_length=10000)
    status: Optional[FeedbackStatus] = None
    assigned_to: Optional[str] = None
    product: Optional[str] = None
    urgency: Optional[int] = Field(None, ge=1, le=10)


class FeedbackResponse(FeedbackBase):
    id: str
    sentiment: float
    sentiment_label: SentimentLabel
    urgency: int
    themes: List[str]
    status: FeedbackStatus
    assigned_to: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CustomerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    tier: CustomerTier = CustomerTier.FREE
    arr: int = 0
    products: List[str] = []


class CustomerCreate(CustomerBase):
    pass


class CustomerResponse(CustomerBase):
    id: str
    health_score: float
    open_issues: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AnalyticsSummary(BaseModel):
    total_feedback: int
    total_feedback_change: float
    avg_sentiment: float
    sentiment_change: float
    critical_alerts: int
    alerts_change: int
    avg_response_time: str
    response_time_change: float
    enterprise_affected: int


class TrendingTheme(BaseModel):
    id: str
    theme: str
    mentions: int
    change: float
    change_direction: str
    sentiment: SentimentLabel
    products: List[str]
    is_new: bool
    summary: Optional[str] = None
    top_sources: List[str]
    affected_customers: List[str]
    suggested_action: Optional[str] = None
    created_at: datetime


class ProductBreakdown(BaseModel):
    product: str
    count: int
    percentage: float
    sentiment: float
    top_issue: Optional[str] = None


class SourceBreakdown(BaseModel):
    source: FeedbackSource
    count: int
    percentage: float


class SentimentBreakdown(BaseModel):
    positive: float
    neutral: float
    negative: float


class AlertBase(BaseModel):
    type: AlertType
    message: str
    product: Optional[str] = None


class AlertCreate(AlertBase):
    feedback_ids: Optional[List[str]] = None


class AlertResponse(AlertBase):
    id: str
    acknowledged: bool
    feedback_ids: List[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSource(BaseModel):
    type: str
    id: str
    title: str
    relevance: float


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    message: str
    sources: List[ChatSource]
    conversation_id: str


class SemanticSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    limit: int = Field(10, ge=1, le=50)
    filters: Optional[Dict[str, Any]] = None


class GitHubWebhook(BaseModel):
    action: str
    issue: Optional[Dict[str, Any]] = None
    comment: Optional[Dict[str, Any]] = None
    repository: Dict[str, Any]
    sender: Dict[str, Any]


class DiscordWebhook(BaseModel):
    content: str
    author: Dict[str, Any]
    channel_id: str
    guild_id: Optional[str] = None


class ZendeskWebhook(BaseModel):
    ticket_id: str
    subject: str
    description: str
    requester: Dict[str, Any]
    priority: Optional[str] = None
    tags: Optional[List[str]] = None


class ApiResponse(BaseModel):
    success: bool = True
    data: Any = None
    error: Optional[str] = None


class PaginatedResponse(BaseModel):
    data: List[Any]
    total: int
    page: int
    page_size: int
    has_more: bool
