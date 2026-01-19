"""
Customers API Routes
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import uuid
from datetime import datetime

from app.models.schemas import (
    CustomerCreate,
    CustomerResponse,
    CustomerTier,
    PaginatedResponse,
    ApiResponse,
)
from app.core.database import d1_client

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    tier: Optional[CustomerTier] = Query(None),
    search: Optional[str] = Query(None),
):
    """List customers with filters and pagination."""
    conditions = []
    params = []
    
    if tier:
        conditions.append("tier = ?")
        params.append(tier.value)
    
    if search:
        conditions.append("name LIKE ?")
        params.append(f"%{search}%")
    
    where_clause = " AND ".join(conditions) if conditions else "1=1"
    
    # Count total
    count_sql = f"SELECT COUNT(*) as total FROM customers WHERE {where_clause}"
    count_result = await d1_client.query(count_sql, params)
    total = count_result[0]["total"] if count_result else 0
    
    # Get paginated results with open issues count
    offset = (page - 1) * page_size
    sql = f"""
        SELECT 
            c.*,
            (
                SELECT COUNT(*) 
                FROM feedback f 
                WHERE f.customer_id = c.id 
                AND f.status NOT IN ('resolved', 'closed')
            ) as open_issues
        FROM customers c
        WHERE {where_clause}
        ORDER BY c.arr DESC, c.name ASC
        LIMIT ? OFFSET ?
    """
    params.extend([page_size, offset])
    
    results = await d1_client.query(sql, params)
    
    return PaginatedResponse(
        data=results,
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page * page_size) < total
    )


@router.get("/at-risk", response_model=ApiResponse)
async def get_at_risk_customers(limit: int = Query(10, ge=1, le=50)):
    """Get customers at risk based on sentiment and open issues."""
    sql = """
        SELECT 
            c.*,
            COUNT(f.id) as open_issues,
            AVG(f.sentiment) as avg_sentiment,
            MAX(f.urgency) as max_urgency
        FROM customers c
        LEFT JOIN feedback f ON f.customer_id = c.id 
            AND f.status NOT IN ('resolved', 'closed')
        WHERE c.tier IN ('enterprise', 'pro')
        GROUP BY c.id
        HAVING avg_sentiment < -0.3 OR open_issues >= 3 OR max_urgency >= 8
        ORDER BY c.arr DESC, avg_sentiment ASC
        LIMIT ?
    """
    results = await d1_client.query(sql, [limit])
    
    return ApiResponse(data=results)


@router.get("/{customer_id}", response_model=ApiResponse)
async def get_customer(customer_id: str):
    """Get a single customer by ID."""
    sql = """
        SELECT 
            c.*,
            (
                SELECT COUNT(*) 
                FROM feedback f 
                WHERE f.customer_id = c.id 
                AND f.status NOT IN ('resolved', 'closed')
            ) as open_issues
        FROM customers c
        WHERE c.id = ?
    """
    results = await d1_client.query(sql, [customer_id])
    
    if not results:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return ApiResponse(data=results[0])


@router.post("", response_model=ApiResponse)
async def create_customer(customer: CustomerCreate):
    """Create a new customer."""
    customer_id = str(uuid.uuid4())
    
    data = {
        "id": customer_id,
        "name": customer.name,
        "tier": customer.tier.value,
        "arr": customer.arr,
        "products": customer.products,
        "health_score": 0.5,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    await d1_client.insert("customers", data)
    
    return ApiResponse(data={**data, "open_issues": 0})


@router.put("/{customer_id}", response_model=ApiResponse)
async def update_customer(customer_id: str, updates: CustomerCreate):
    """Update a customer."""
    # Check if exists
    sql = "SELECT * FROM customers WHERE id = ?"
    results = await d1_client.query(sql, [customer_id])
    
    if not results:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    update_data = {
        "name": updates.name,
        "tier": updates.tier.value,
        "arr": updates.arr,
        "products": updates.products,
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    await d1_client.update("customers", customer_id, update_data)
    
    # Get updated record
    results = await d1_client.query(sql, [customer_id])
    
    return ApiResponse(data=results[0])


@router.delete("/{customer_id}")
async def delete_customer(customer_id: str):
    """Delete a customer."""
    sql = "SELECT * FROM customers WHERE id = ?"
    results = await d1_client.query(sql, [customer_id])
    
    if not results:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    await d1_client.delete("customers", customer_id)
    
    return {"status": "deleted"}


@router.get("/{customer_id}/feedback", response_model=ApiResponse)
async def get_customer_feedback(
    customer_id: str,
    limit: int = Query(20, ge=1, le=100)
):
    """Get feedback for a specific customer."""
    # Verify customer exists
    customer_sql = "SELECT * FROM customers WHERE id = ?"
    customer = await d1_client.query(customer_sql, [customer_id])
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    sql = """
        SELECT * FROM feedback
        WHERE customer_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    """
    results = await d1_client.query(sql, [customer_id, limit])
    
    return ApiResponse(data=results)


@router.get("/{customer_id}/health", response_model=ApiResponse)
async def get_customer_health(customer_id: str):
    """Calculate health score for a customer."""
    # Get customer
    customer_sql = "SELECT * FROM customers WHERE id = ?"
    customer = await d1_client.query(customer_sql, [customer_id])
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get feedback metrics
    metrics_sql = """
        SELECT 
            COUNT(*) as total_feedback,
            AVG(sentiment) as avg_sentiment,
            COUNT(CASE WHEN urgency >= 8 THEN 1 END) as critical_count,
            COUNT(CASE WHEN status NOT IN ('resolved', 'closed') THEN 1 END) as open_count,
            AVG(urgency) as avg_urgency
        FROM feedback
        WHERE customer_id = ?
        AND created_at >= datetime('now', '-30 days')
    """
    metrics = await d1_client.query(metrics_sql, [customer_id])
    
    m = metrics[0] if metrics else {}
    
    # Calculate health score (0-100)
    # Higher is better
    sentiment_score = ((m.get("avg_sentiment", 0) or 0) + 1) / 2 * 40  # Max 40 points
    urgency_penalty = min((m.get("avg_urgency", 5) or 5) * 3, 30)  # Max -30 points
    critical_penalty = min((m.get("critical_count", 0) or 0) * 10, 20)  # Max -20 points
    open_penalty = min((m.get("open_count", 0) or 0) * 5, 20)  # Max -20 points
    
    health_score = max(0, min(100, 
        70 + sentiment_score - urgency_penalty - critical_penalty - open_penalty
    ))
    
    # Update customer health score
    await d1_client.update("customers", customer_id, {
        "health_score": round(health_score / 100, 2),
        "updated_at": datetime.utcnow().isoformat()
    })
    
    return ApiResponse(data={
        "customer_id": customer_id,
        "health_score": round(health_score, 1),
        "metrics": {
            "total_feedback_30d": m.get("total_feedback", 0),
            "avg_sentiment": round(m.get("avg_sentiment", 0) or 0, 2),
            "critical_issues": m.get("critical_count", 0),
            "open_issues": m.get("open_count", 0),
            "avg_urgency": round(m.get("avg_urgency", 5) or 5, 1)
        },
        "factors": {
            "sentiment_contribution": round(sentiment_score, 1),
            "urgency_penalty": round(urgency_penalty, 1),
            "critical_penalty": round(critical_penalty, 1),
            "open_issues_penalty": round(open_penalty, 1)
        }
    })
