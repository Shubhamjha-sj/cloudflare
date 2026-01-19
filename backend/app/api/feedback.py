"""Feedback API Routes"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime
import uuid

from app.models.schemas import FeedbackCreate, FeedbackUpdate, FeedbackSource, FeedbackStatus, CustomerTier, PaginatedResponse, ApiResponse
from app.services.cloudflare import workers_ai, vectorize, queue
from app.core.database import d1_client

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_feedback(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source: Optional[List[FeedbackSource]] = Query(None),
    product: Optional[List[str]] = Query(None),
    status: Optional[List[FeedbackStatus]] = Query(None),
    customer_tier: Optional[List[CustomerTier]] = Query(None),
    urgency_min: Optional[int] = Query(None, ge=1, le=10),
    urgency_max: Optional[int] = Query(None, ge=1, le=10),
    search: Optional[str] = Query(None),
):
    conditions, params = [], []
    
    if source:
        conditions.append(f"source IN ({','.join(['?' for _ in source])})")
        params.extend([s.value for s in source])
    if product:
        conditions.append(f"product IN ({','.join(['?' for _ in product])})")
        params.extend(product)
    if status:
        conditions.append(f"status IN ({','.join(['?' for _ in status])})")
        params.extend([s.value for s in status])
    if customer_tier:
        conditions.append(f"customer_tier IN ({','.join(['?' for _ in customer_tier])})")
        params.extend([t.value for t in customer_tier])
    if urgency_min:
        conditions.append("urgency >= ?")
        params.append(urgency_min)
    if urgency_max:
        conditions.append("urgency <= ?")
        params.append(urgency_max)
    if search:
        conditions.append("content LIKE ?")
        params.append(f"%{search}%")
    
    where = " AND ".join(conditions) if conditions else "1=1"
    
    count_result = await d1_client.query(f"SELECT COUNT(*) as total FROM feedback WHERE {where}", params)
    total = count_result[0]["total"] if count_result else 0
    
    offset = (page - 1) * page_size
    results = await d1_client.query(f"SELECT * FROM feedback WHERE {where} ORDER BY created_at DESC LIMIT ? OFFSET ?", params + [page_size, offset])
    
    return PaginatedResponse(data=results, total=total, page=page, page_size=page_size, has_more=(page * page_size) < total)


@router.get("/{feedback_id}", response_model=ApiResponse)
async def get_feedback(feedback_id: str):
    results = await d1_client.query("SELECT * FROM feedback WHERE id = ?", [feedback_id])
    if not results:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return ApiResponse(data=results[0])


@router.post("", response_model=ApiResponse)
async def create_feedback(feedback: FeedbackCreate):
    feedback_id = str(uuid.uuid4())
    
    await queue.send_message({"type": "process_feedback", "feedback_id": feedback_id, "content": feedback.content, "source": feedback.source.value, "product": feedback.product, "customer_id": feedback.customer_id, "customer_name": feedback.customer_name, "customer_tier": feedback.customer_tier.value if feedback.customer_tier else None, "customer_arr": feedback.customer_arr, "metadata": feedback.metadata})
    
    sentiment_result = await workers_ai.analyze_sentiment(feedback.content)
    themes = await workers_ai.classify_themes(feedback.content)
    urgency = await workers_ai.calculate_urgency(feedback.content, feedback.customer_tier.value if feedback.customer_tier else "free", feedback.customer_arr or 0)
    embedding = await workers_ai.generate_embedding(feedback.content)
    
    data = {"id": feedback_id, "content": feedback.content, "source": feedback.source.value, "sentiment": sentiment_result["score"], "sentiment_label": sentiment_result["label"], "urgency": urgency, "product": feedback.product, "themes": themes, "customer_id": feedback.customer_id, "customer_name": feedback.customer_name, "customer_tier": feedback.customer_tier.value if feedback.customer_tier else None, "customer_arr": feedback.customer_arr, "status": FeedbackStatus.NEW.value, "metadata": feedback.metadata or {}, "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()}
    
    await d1_client.insert("feedback", data)
    await vectorize.insert(feedback_id, embedding, {"source": feedback.source.value, "product": feedback.product, "sentiment": sentiment_result["score"], "urgency": urgency, "customer_tier": feedback.customer_tier.value if feedback.customer_tier else None})
    
    return ApiResponse(data={**data, "themes": themes})


@router.put("/{feedback_id}", response_model=ApiResponse)
async def update_feedback(feedback_id: str, updates: FeedbackUpdate):
    results = await d1_client.query("SELECT * FROM feedback WHERE id = ?", [feedback_id])
    if not results:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()
    if updates.status:
        update_data["status"] = updates.status.value
    
    await d1_client.update("feedback", feedback_id, update_data)
    results = await d1_client.query("SELECT * FROM feedback WHERE id = ?", [feedback_id])
    return ApiResponse(data=results[0])


@router.delete("/{feedback_id}")
async def delete_feedback(feedback_id: str):
    results = await d1_client.query("SELECT * FROM feedback WHERE id = ?", [feedback_id])
    if not results:
        raise HTTPException(status_code=404, detail="Feedback not found")
    await d1_client.delete("feedback", feedback_id)
    await vectorize.delete([feedback_id])
    return {"status": "deleted"}


@router.get("/{feedback_id}/similar", response_model=ApiResponse)
async def get_similar_feedback(feedback_id: str, limit: int = Query(5, ge=1, le=20)):
    results = await d1_client.query("SELECT * FROM feedback WHERE id = ?", [feedback_id])
    if not results:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    embedding = await workers_ai.generate_embedding(results[0]["content"])
    similar = await vectorize.query(embedding, top_k=limit + 1)
    similar_ids = [s["id"] for s in similar if s["id"] != feedback_id][:limit]
    
    if not similar_ids:
        return ApiResponse(data=[])
    
    similar_feedback = await d1_client.query(f"SELECT * FROM feedback WHERE id IN ({','.join(['?' for _ in similar_ids])})", similar_ids)
    return ApiResponse(data=similar_feedback)
