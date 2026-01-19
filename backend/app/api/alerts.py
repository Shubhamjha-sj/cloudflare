"""
Alerts API Routes
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
import uuid
from datetime import datetime

from app.models.schemas import (
    AlertCreate,
    AlertResponse,
    AlertType,
    ApiResponse,
)
from app.core.database import d1_client

router = APIRouter()


@router.get("", response_model=ApiResponse)
async def list_alerts(
    limit: int = Query(10, ge=1, le=100),
    alert_type: Optional[AlertType] = Query(None),
    acknowledged: Optional[bool] = Query(None),
    product: Optional[str] = Query(None),
):
    """List alerts with filters."""
    conditions = []
    params = []
    
    if alert_type:
        conditions.append("type = ?")
        params.append(alert_type.value)
    
    if acknowledged is not None:
        conditions.append("acknowledged = ?")
        params.append(1 if acknowledged else 0)
    
    if product:
        conditions.append("product = ?")
        params.append(product)
    
    where_clause = " AND ".join(conditions) if conditions else "1=1"
    
    sql = f"""
        SELECT * FROM alerts
        WHERE {where_clause}
        ORDER BY 
            CASE type 
                WHEN 'critical' THEN 1 
                WHEN 'warning' THEN 2 
                ELSE 3 
            END,
            created_at DESC
        LIMIT ?
    """
    params.append(limit)
    
    results = await d1_client.query(sql, params)
    
    return ApiResponse(data=results)


@router.get("/unacknowledged/count")
async def get_unacknowledged_count():
    """Get count of unacknowledged alerts by type."""
    sql = """
        SELECT 
            type,
            COUNT(*) as count
        FROM alerts
        WHERE acknowledged = 0
        GROUP BY type
    """
    results = await d1_client.query(sql, [])
    
    counts = {r["type"]: r["count"] for r in results}
    
    return {
        "total": sum(counts.values()),
        "critical": counts.get("critical", 0),
        "warning": counts.get("warning", 0),
        "info": counts.get("info", 0)
    }


@router.get("/{alert_id}", response_model=ApiResponse)
async def get_alert(alert_id: str):
    """Get a single alert by ID."""
    sql = "SELECT * FROM alerts WHERE id = ?"
    results = await d1_client.query(sql, [alert_id])
    
    if not results:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return ApiResponse(data=results[0])


@router.post("", response_model=ApiResponse)
async def create_alert(alert: AlertCreate):
    """Create a new alert."""
    alert_id = str(uuid.uuid4())
    
    data = {
        "id": alert_id,
        "type": alert.type.value,
        "message": alert.message,
        "product": alert.product,
        "acknowledged": 0,
        "feedback_ids": alert.feedback_ids or [],
        "created_at": datetime.utcnow().isoformat(),
    }
    
    await d1_client.insert("alerts", data)
    
    return ApiResponse(data=data)


@router.post("/{alert_id}/acknowledge", response_model=ApiResponse)
async def acknowledge_alert(alert_id: str):
    """Acknowledge an alert."""
    sql = "SELECT * FROM alerts WHERE id = ?"
    results = await d1_client.query(sql, [alert_id])
    
    if not results:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    await d1_client.update("alerts", alert_id, {"acknowledged": 1})
    
    # Get updated record
    results = await d1_client.query(sql, [alert_id])
    
    return ApiResponse(data=results[0])


@router.post("/acknowledge-all")
async def acknowledge_all_alerts(
    alert_type: Optional[AlertType] = Query(None),
    product: Optional[str] = Query(None),
):
    """Acknowledge multiple alerts."""
    conditions = ["acknowledged = 0"]
    params = []
    
    if alert_type:
        conditions.append("type = ?")
        params.append(alert_type.value)
    
    if product:
        conditions.append("product = ?")
        params.append(product)
    
    where_clause = " AND ".join(conditions)
    
    sql = f"UPDATE alerts SET acknowledged = 1 WHERE {where_clause}"
    await d1_client.execute(sql, params)
    
    return {"status": "acknowledged"}


@router.delete("/{alert_id}")
async def delete_alert(alert_id: str):
    """Delete an alert."""
    sql = "SELECT * FROM alerts WHERE id = ?"
    results = await d1_client.query(sql, [alert_id])
    
    if not results:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    await d1_client.delete("alerts", alert_id)
    
    return {"status": "deleted"}


@router.post("/auto-detect")
async def auto_detect_alerts():
    """Automatically detect and create alerts based on feedback patterns."""
    alerts_created = []
    
    # Detect critical issues (high urgency from enterprise customers)
    critical_sql = """
        SELECT 
            f.product,
            f.customer_name,
            f.customer_arr,
            f.content,
            COUNT(*) as count
        FROM feedback f
        WHERE f.urgency >= 9
        AND f.created_at >= datetime('now', '-24 hours')
        AND f.customer_tier = 'enterprise'
        AND NOT EXISTS (
            SELECT 1 FROM alerts a 
            WHERE a.product = f.product 
            AND a.type = 'critical'
            AND a.acknowledged = 0
            AND a.created_at >= datetime('now', '-24 hours')
        )
        GROUP BY f.product, f.customer_name
    """
    critical_issues = await d1_client.query(critical_sql, [])
    
    for issue in critical_issues:
        alert_id = str(uuid.uuid4())
        alert = {
            "id": alert_id,
            "type": "critical",
            "message": f"Critical issue from {issue['customer_name']} (${issue['customer_arr']:,} ARR) - {issue['product']}: {issue['content'][:100]}...",
            "product": issue["product"],
            "acknowledged": 0,
            "feedback_ids": [],
            "created_at": datetime.utcnow().isoformat(),
        }
        await d1_client.insert("alerts", alert)
        alerts_created.append(alert)
    
    # Detect trending negative themes (spike in negative feedback)
    spike_sql = """
        SELECT 
            product,
            COUNT(*) as count,
            AVG(sentiment) as avg_sentiment
        FROM feedback
        WHERE created_at >= datetime('now', '-24 hours')
        AND sentiment < -0.5
        GROUP BY product
        HAVING count >= 5
    """
    spikes = await d1_client.query(spike_sql, [])
    
    for spike in spikes:
        # Check if alert already exists
        existing_sql = """
            SELECT 1 FROM alerts 
            WHERE product = ? 
            AND type = 'warning'
            AND acknowledged = 0
            AND created_at >= datetime('now', '-24 hours')
        """
        existing = await d1_client.query(existing_sql, [spike["product"]])
        
        if not existing:
            alert_id = str(uuid.uuid4())
            alert = {
                "id": alert_id,
                "type": "warning",
                "message": f"Spike in negative feedback for {spike['product']}: {spike['count']} complaints in last 24h (avg sentiment: {spike['avg_sentiment']:.2f})",
                "product": spike["product"],
                "acknowledged": 0,
                "feedback_ids": [],
                "created_at": datetime.utcnow().isoformat(),
            }
            await d1_client.insert("alerts", alert)
            alerts_created.append(alert)
    
    # Detect new feature request clusters
    feature_sql = """
        SELECT 
            product,
            themes,
            COUNT(*) as count
        FROM feedback
        WHERE themes LIKE '%feature-request%'
        AND created_at >= datetime('now', '-7 days')
        GROUP BY product, themes
        HAVING count >= 10
    """
    features = await d1_client.query(feature_sql, [])
    
    for feature in features:
        existing_sql = """
            SELECT 1 FROM alerts 
            WHERE product = ? 
            AND type = 'info'
            AND message LIKE '%feature request%'
            AND created_at >= datetime('now', '-7 days')
        """
        existing = await d1_client.query(existing_sql, [feature["product"]])
        
        if not existing:
            alert_id = str(uuid.uuid4())
            alert = {
                "id": alert_id,
                "type": "info",
                "message": f"New feature request cluster detected for {feature['product']}: {feature['count']} requests in the last 7 days",
                "product": feature["product"],
                "acknowledged": 0,
                "feedback_ids": [],
                "created_at": datetime.utcnow().isoformat(),
            }
            await d1_client.insert("alerts", alert)
            alerts_created.append(alert)
    
    return {
        "alerts_created": len(alerts_created),
        "alerts": alerts_created
    }
