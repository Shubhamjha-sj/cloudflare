"""
Analytics API Routes
"""

from fastapi import APIRouter, Query
from typing import List
from datetime import datetime, timedelta

from app.models.schemas import (
    AnalyticsSummary,
    TrendingTheme,
    ProductBreakdown,
    SourceBreakdown,
    SentimentBreakdown,
    TimeRange,
    ApiResponse,
)
from app.core.database import d1_client

router = APIRouter()


def get_time_filter(time_range: TimeRange) -> str:
    """Get SQL datetime filter based on time range."""
    days = {
        TimeRange.DAY: 1,
        TimeRange.WEEK: 7,
        TimeRange.MONTH: 30,
        TimeRange.QUARTER: 90,
    }
    return f"datetime('now', '-{days[time_range]} days')"


@router.get("/summary", response_model=ApiResponse)
async def get_analytics_summary(time_range: TimeRange = Query(TimeRange.WEEK)):
    """Get summary analytics for the dashboard."""
    time_filter = get_time_filter(time_range)
    
    # Current period stats
    current_sql = f"""
        SELECT 
            COUNT(*) as total_feedback,
            AVG(sentiment) as avg_sentiment,
            COUNT(CASE WHEN urgency >= 8 THEN 1 END) as critical_alerts,
            COUNT(DISTINCT CASE WHEN customer_tier = 'enterprise' THEN customer_id END) as enterprise_affected
        FROM feedback
        WHERE created_at >= {time_filter}
    """
    current_stats = await d1_client.query(current_sql, [])
    
    # Previous period stats for comparison
    days = {"24h": 1, "7d": 7, "30d": 30, "90d": 90}[time_range.value]
    prev_sql = f"""
        SELECT 
            COUNT(*) as total_feedback,
            AVG(sentiment) as avg_sentiment,
            COUNT(CASE WHEN urgency >= 8 THEN 1 END) as critical_alerts
        FROM feedback
        WHERE created_at >= datetime('now', '-{days * 2} days')
        AND created_at < {time_filter}
    """
    prev_stats = await d1_client.query(prev_sql, [])
    
    current = current_stats[0] if current_stats else {}
    prev = prev_stats[0] if prev_stats else {}
    
    # Calculate changes
    def calc_change(current_val, prev_val):
        if not prev_val or prev_val == 0:
            return 0
        return round(((current_val - prev_val) / prev_val) * 100, 1)
    
    summary = AnalyticsSummary(
        total_feedback=current.get("total_feedback", 0),
        total_feedback_change=calc_change(
            current.get("total_feedback", 0),
            prev.get("total_feedback", 0)
        ),
        avg_sentiment=round(current.get("avg_sentiment", 0) or 0, 2),
        sentiment_change=round(
            (current.get("avg_sentiment", 0) or 0) - (prev.get("avg_sentiment", 0) or 0),
            2
        ),
        critical_alerts=current.get("critical_alerts", 0),
        alerts_change=current.get("critical_alerts", 0) - prev.get("critical_alerts", 0),
        avg_response_time="4.2h",  # Would calculate from ticket data
        response_time_change=-18,
        enterprise_affected=current.get("enterprise_affected", 0)
    )
    
    return ApiResponse(data=summary)


@router.get("/themes", response_model=ApiResponse)
async def get_trending_themes(
    time_range: TimeRange = Query(TimeRange.WEEK),
    limit: int = Query(10, ge=1, le=50)
):
    """Get trending themes based on feedback analysis."""
    time_filter = get_time_filter(time_range)
    
    # Get themes from the themes table
    sql = f"""
        SELECT 
            t.*,
            (
                SELECT COUNT(*) 
                FROM feedback f 
                WHERE f.themes LIKE '%' || t.theme || '%'
                AND f.created_at >= {time_filter}
            ) as current_mentions
        FROM themes t
        ORDER BY current_mentions DESC
        LIMIT ?
    """
    themes = await d1_client.query(sql, [limit])
    
    # If no themes exist, aggregate from feedback
    if not themes:
        # Fallback: get unique themes from feedback
        feedback_sql = f"""
            SELECT 
                themes,
                COUNT(*) as mention_count,
                AVG(sentiment) as avg_sentiment,
                GROUP_CONCAT(DISTINCT product) as products
            FROM feedback
            WHERE created_at >= {time_filter}
            GROUP BY themes
            ORDER BY mention_count DESC
            LIMIT ?
        """
        feedback_themes = await d1_client.query(feedback_sql, [limit])
        
        themes = [
            {
                "id": str(i),
                "theme": t.get("themes", "Unknown"),
                "mentions": t.get("mention_count", 0),
                "change": 0,
                "change_direction": "stable",
                "sentiment": "neutral" if (t.get("avg_sentiment") or 0) > -0.3 else "frustrated",
                "products": (t.get("products") or "").split(","),
                "is_new": False,
                "top_sources": [],
                "affected_customers": [],
                "created_at": datetime.utcnow().isoformat()
            }
            for i, t in enumerate(feedback_themes)
        ]
    
    return ApiResponse(data=themes)


@router.get("/products", response_model=ApiResponse)
async def get_product_breakdown(time_range: TimeRange = Query(TimeRange.WEEK)):
    """Get feedback breakdown by product."""
    time_filter = get_time_filter(time_range)
    
    sql = f"""
        SELECT 
            product,
            COUNT(*) as count,
            AVG(sentiment) as sentiment,
            (
                SELECT content 
                FROM feedback f2 
                WHERE f2.product = feedback.product 
                AND f2.urgency >= 7
                ORDER BY f2.created_at DESC 
                LIMIT 1
            ) as top_issue
        FROM feedback
        WHERE created_at >= {time_filter}
        AND product IS NOT NULL
        GROUP BY product
        ORDER BY count DESC
    """
    results = await d1_client.query(sql, [])
    
    # Calculate percentages
    total = sum(r.get("count", 0) for r in results)
    
    products = [
        ProductBreakdown(
            product=r.get("product", "Unknown"),
            count=r.get("count", 0),
            percentage=round((r.get("count", 0) / total * 100) if total > 0 else 0, 1),
            sentiment=round(r.get("sentiment", 0) or 0, 2),
            top_issue=r.get("top_issue")
        )
        for r in results
    ]
    
    return ApiResponse(data=products)


@router.get("/sources", response_model=ApiResponse)
async def get_source_breakdown(time_range: TimeRange = Query(TimeRange.WEEK)):
    """Get feedback breakdown by source."""
    time_filter = get_time_filter(time_range)
    
    sql = f"""
        SELECT 
            source,
            COUNT(*) as count
        FROM feedback
        WHERE created_at >= {time_filter}
        GROUP BY source
        ORDER BY count DESC
    """
    results = await d1_client.query(sql, [])
    
    # Calculate percentages
    total = sum(r.get("count", 0) for r in results)
    
    sources = [
        SourceBreakdown(
            source=r.get("source", "unknown"),
            count=r.get("count", 0),
            percentage=round((r.get("count", 0) / total * 100) if total > 0 else 0, 1)
        )
        for r in results
    ]
    
    return ApiResponse(data=sources)


@router.get("/sentiment", response_model=ApiResponse)
async def get_sentiment_breakdown(time_range: TimeRange = Query(TimeRange.WEEK)):
    """Get sentiment distribution."""
    time_filter = get_time_filter(time_range)
    
    sql = f"""
        SELECT 
            COUNT(CASE WHEN sentiment > 0.3 THEN 1 END) as positive,
            COUNT(CASE WHEN sentiment BETWEEN -0.3 AND 0.3 THEN 1 END) as neutral,
            COUNT(CASE WHEN sentiment < -0.3 THEN 1 END) as negative,
            COUNT(*) as total
        FROM feedback
        WHERE created_at >= {time_filter}
    """
    results = await d1_client.query(sql, [])
    
    if results:
        r = results[0]
        total = r.get("total", 0) or 1
        breakdown = SentimentBreakdown(
            positive=round(r.get("positive", 0) / total * 100, 1),
            neutral=round(r.get("neutral", 0) / total * 100, 1),
            negative=round(r.get("negative", 0) / total * 100, 1)
        )
    else:
        breakdown = SentimentBreakdown(positive=0, neutral=0, negative=0)
    
    return ApiResponse(data=breakdown)


@router.get("/trends")
async def get_trend_data(
    time_range: TimeRange = Query(TimeRange.WEEK),
    metric: str = Query("feedback_count", regex="^(feedback_count|sentiment|urgency)$")
):
    """Get time-series trend data for charts."""
    days = {"24h": 1, "7d": 7, "30d": 30, "90d": 90}[time_range.value]
    
    # Group by appropriate interval
    if days <= 1:
        interval = "hour"
        format_str = "%Y-%m-%d %H:00"
    elif days <= 7:
        interval = "day"
        format_str = "%Y-%m-%d"
    else:
        interval = "day"
        format_str = "%Y-%m-%d"
    
    time_filter = get_time_filter(time_range)
    
    if metric == "feedback_count":
        sql = f"""
            SELECT 
                strftime('{format_str}', created_at) as period,
                COUNT(*) as value
            FROM feedback
            WHERE created_at >= {time_filter}
            GROUP BY period
            ORDER BY period ASC
        """
    elif metric == "sentiment":
        sql = f"""
            SELECT 
                strftime('{format_str}', created_at) as period,
                AVG(sentiment) as value
            FROM feedback
            WHERE created_at >= {time_filter}
            GROUP BY period
            ORDER BY period ASC
        """
    else:  # urgency
        sql = f"""
            SELECT 
                strftime('{format_str}', created_at) as period,
                AVG(urgency) as value
            FROM feedback
            WHERE created_at >= {time_filter}
            GROUP BY period
            ORDER BY period ASC
        """
    
    results = await d1_client.query(sql, [])
    
    return ApiResponse(data={
        "metric": metric,
        "time_range": time_range.value,
        "data": [
            {"period": r.get("period"), "value": round(r.get("value", 0), 2)}
            for r in results
        ]
    })
