"""
Search API Routes
Semantic search using Cloudflare Vectorize
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any

from app.models.schemas import (
    SemanticSearchRequest,
    SemanticSearchResult,
    ApiResponse,
)
from app.services.cloudflare import workers_ai, vectorize, ai_search
from app.core.database import d1_client

router = APIRouter()


@router.post("/semantic", response_model=ApiResponse)
async def semantic_search(request: SemanticSearchRequest):
    """Perform semantic search across feedback using vector similarity."""
    
    # Generate embedding for the query
    query_embedding = await workers_ai.generate_embedding(request.query)
    
    # Build filter if provided
    vector_filter = None
    if request.filters:
        vector_filter = {}
        if "product" in request.filters:
            vector_filter["product"] = {"$eq": request.filters["product"]}
        if "source" in request.filters:
            vector_filter["source"] = {"$eq": request.filters["source"]}
        if "customer_tier" in request.filters:
            vector_filter["customer_tier"] = {"$eq": request.filters["customer_tier"]}
        if "min_sentiment" in request.filters:
            vector_filter["sentiment"] = {"$gte": request.filters["min_sentiment"]}
        if "max_sentiment" in request.filters:
            if "sentiment" in vector_filter:
                vector_filter["sentiment"]["$lte"] = request.filters["max_sentiment"]
            else:
                vector_filter["sentiment"] = {"$lte": request.filters["max_sentiment"]}
    
    # Query Vectorize
    vector_results = await vectorize.query(
        query_embedding,
        top_k=request.limit,
        filter=vector_filter
    )
    
    if not vector_results:
        return ApiResponse(data=[])
    
    # Get full feedback details from D1
    feedback_ids = [r["id"] for r in vector_results]
    placeholders = ",".join(["?" for _ in feedback_ids])
    sql = f"SELECT * FROM feedback WHERE id IN ({placeholders})"
    feedback_items = await d1_client.query(sql, feedback_ids)
    
    # Create a map for quick lookup
    feedback_map = {f["id"]: f for f in feedback_items}
    
    # Combine with scores
    results = []
    for vr in vector_results:
        feedback = feedback_map.get(vr["id"])
        if feedback:
            results.append({
                "id": vr["id"],
                "score": vr.get("score", 0),
                "content": feedback.get("content"),
                "source": feedback.get("source"),
                "product": feedback.get("product"),
                "sentiment": feedback.get("sentiment"),
                "urgency": feedback.get("urgency"),
                "customer_name": feedback.get("customer_name"),
                "customer_tier": feedback.get("customer_tier"),
                "created_at": feedback.get("created_at"),
            })
    
    return ApiResponse(data=results)


@router.get("/similar/{feedback_id}", response_model=ApiResponse)
async def find_similar(
    feedback_id: str,
    limit: int = Query(5, ge=1, le=20)
):
    """Find feedback similar to a given item."""
    
    # Get the original feedback
    sql = "SELECT * FROM feedback WHERE id = ?"
    results = await d1_client.query(sql, [feedback_id])
    
    if not results:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    original = results[0]
    
    # Generate embedding
    embedding = await workers_ai.generate_embedding(original["content"])
    
    # Query for similar (excluding the original)
    vector_results = await vectorize.query(embedding, top_k=limit + 1)
    
    # Filter out the original
    similar_ids = [r["id"] for r in vector_results if r["id"] != feedback_id][:limit]
    
    if not similar_ids:
        return ApiResponse(data=[])
    
    # Get feedback details
    placeholders = ",".join(["?" for _ in similar_ids])
    sql = f"SELECT * FROM feedback WHERE id IN ({placeholders})"
    similar_feedback = await d1_client.query(sql, similar_ids)
    
    return ApiResponse(data=similar_feedback)


@router.get("/keywords")
async def keyword_search(
    q: str = Query(..., min_length=1, max_length=200),
    product: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100)
):
    """Traditional keyword search across feedback."""
    
    conditions = ["content LIKE ?"]
    params = [f"%{q}%"]
    
    if product:
        conditions.append("product = ?")
        params.append(product)
    
    if source:
        conditions.append("source = ?")
        params.append(source)
    
    where_clause = " AND ".join(conditions)
    
    sql = f"""
        SELECT * FROM feedback
        WHERE {where_clause}
        ORDER BY urgency DESC, created_at DESC
        LIMIT ?
    """
    params.append(limit)
    
    results = await d1_client.query(sql, params)
    
    return ApiResponse(data=results)


@router.get("/themes")
async def search_by_theme(
    theme: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100)
):
    """Search feedback by theme."""
    
    sql = """
        SELECT * FROM feedback
        WHERE themes LIKE ?
        ORDER BY urgency DESC, created_at DESC
        LIMIT ?
    """
    results = await d1_client.query(sql, [f"%{theme}%", limit])
    
    return ApiResponse(data=results)


@router.post("/ai-search")
async def ai_powered_search(
    query: str,
    limit: int = Query(10, ge=1, le=50)
):
    """Search using Cloudflare AI Search (managed RAG)."""
    
    try:
        # Use AI Search for RAG-powered search
        results = await ai_search.search(query, limit=limit)
        
        return ApiResponse(data={
            "query": query,
            "results": results,
            "count": len(results)
        })
    except Exception as e:
        # Fall back to semantic search if AI Search is not configured
        request = SemanticSearchRequest(query=query, limit=limit)
        return await semantic_search(request)


@router.get("/suggestions")
async def get_search_suggestions(
    q: str = Query(..., min_length=1, max_length=100)
):
    """Get search suggestions based on existing feedback."""
    
    # Get product suggestions
    product_sql = """
        SELECT DISTINCT product 
        FROM feedback 
        WHERE product LIKE ? 
        LIMIT 5
    """
    products = await d1_client.query(product_sql, [f"%{q}%"])
    
    # Get theme suggestions
    theme_sql = """
        SELECT DISTINCT theme 
        FROM themes 
        WHERE theme LIKE ? 
        LIMIT 5
    """
    themes = await d1_client.query(theme_sql, [f"%{q}%"])
    
    # Get customer suggestions
    customer_sql = """
        SELECT DISTINCT customer_name 
        FROM feedback 
        WHERE customer_name LIKE ? 
        AND customer_name IS NOT NULL
        LIMIT 5
    """
    customers = await d1_client.query(customer_sql, [f"%{q}%"])
    
    return {
        "products": [p["product"] for p in products],
        "themes": [t["theme"] for t in themes],
        "customers": [c["customer_name"] for c in customers]
    }


@router.post("/cluster-analysis")
async def analyze_clusters(feedback_ids: List[str]):
    """Analyze a cluster of feedback items to identify common themes."""
    
    if not feedback_ids:
        raise HTTPException(status_code=400, detail="No feedback IDs provided")
    
    # Get feedback items
    placeholders = ",".join(["?" for _ in feedback_ids])
    sql = f"SELECT * FROM feedback WHERE id IN ({placeholders})"
    feedback_items = await d1_client.query(sql, feedback_ids)
    
    if not feedback_items:
        raise HTTPException(status_code=404, detail="No feedback found")
    
    # Combine content for analysis
    combined_content = "\n\n".join([
        f"- [{item.get('source', 'unknown')}] {item.get('content', '')}"
        for item in feedback_items
    ])
    
    # Use Workers AI to analyze
    system_prompt = """Analyze this cluster of customer feedback and provide:
    1. Common themes (list of 3-5 themes)
    2. Overall sentiment (positive/neutral/negative with confidence)
    3. Key pain points
    4. Suggested actions
    5. Products affected
    
    Return as JSON with keys: themes, sentiment, pain_points, suggested_actions, products"""
    
    analysis = await workers_ai.generate_text(
        f"Analyze this feedback cluster:\n\n{combined_content}",
        system_prompt=system_prompt,
        max_tokens=800
    )
    
    # Calculate aggregate metrics
    avg_sentiment = sum(f.get("sentiment", 0) for f in feedback_items) / len(feedback_items)
    avg_urgency = sum(f.get("urgency", 5) for f in feedback_items) / len(feedback_items)
    
    sources = {}
    products = {}
    for f in feedback_items:
        src = f.get("source", "unknown")
        sources[src] = sources.get(src, 0) + 1
        
        prod = f.get("product", "unknown")
        products[prod] = products.get(prod, 0) + 1
    
    return {
        "cluster_size": len(feedback_items),
        "analysis": analysis,
        "metrics": {
            "avg_sentiment": round(avg_sentiment, 2),
            "avg_urgency": round(avg_urgency, 1),
        },
        "distribution": {
            "sources": sources,
            "products": products
        },
        "feedback_ids": feedback_ids
    }
