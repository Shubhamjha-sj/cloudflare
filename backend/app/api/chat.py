"""AI Chat API Routes - RAG-powered chatbot using Cloudflare AI Search and Workers AI"""

from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import uuid
import json

from app.models.schemas import ChatRequest, ChatResponse, ChatSource
from app.services.cloudflare import workers_ai, vectorize, ai_search
from app.core.database import d1_client

router = APIRouter()
conversations: Dict[str, List[Dict[str, Any]]] = {}


async def retrieve_context(query: str) -> tuple[List[Dict[str, Any]], List[ChatSource]]:
    sources: List[ChatSource] = []
    context: List[Dict[str, Any]] = []
    
    try:
        ai_results = await ai_search.search(query, limit=5)
        for doc in ai_results:
            context.append({"type": "ai_search", "content": doc.get("content", ""), "metadata": doc.get("metadata", {})})
            sources.append(ChatSource(type=doc.get("metadata", {}).get("type", "feedback"), id=doc.get("id", ""), title=doc.get("content", "")[:50] + "...", relevance=doc.get("score", 0.0)))
    except: pass
    
    try:
        embedding = await workers_ai.generate_embedding(query)
        vector_results = await vectorize.query(embedding, top_k=5)
        if vector_results:
            feedback_ids = [r["id"] for r in vector_results]
            feedback_items = await d1_client.query(f"SELECT * FROM feedback WHERE id IN ({','.join(['?' for _ in feedback_ids])})", feedback_ids)
            for item in feedback_items:
                context.append({"type": "feedback", "content": item.get("content", ""), "metadata": {"source": item.get("source"), "product": item.get("product"), "sentiment": item.get("sentiment"), "urgency": item.get("urgency"), "customer_name": item.get("customer_name"), "customer_tier": item.get("customer_tier")}})
                score = next((r.get("score", 0.8) for r in vector_results if r["id"] == item["id"]), 0.8)
                sources.append(ChatSource(type="feedback", id=item["id"], title=item.get("content", "")[:50] + "...", relevance=score))
    except: pass
    
    try:
        themes = await d1_client.query("SELECT * FROM themes WHERE theme LIKE ? ORDER BY mentions DESC LIMIT 3", [f"%{query}%"])
        for theme in themes:
            context.append({"type": "theme", "content": f"Theme: {theme.get('theme')} with {theme.get('mentions')} mentions. {theme.get('summary', '')}", "metadata": {"mentions": theme.get("mentions"), "products": theme.get("products"), "sentiment": theme.get("sentiment")}})
            sources.append(ChatSource(type="theme", id=theme["id"], title=theme.get("theme", ""), relevance=0.9))
    except: pass
    
    try:
        stats = await d1_client.query("SELECT COUNT(*) as total, AVG(sentiment) as avg_sentiment, COUNT(CASE WHEN urgency >= 8 THEN 1 END) as critical FROM feedback WHERE created_at >= datetime('now', '-7 days')", [])
        if stats:
            context.append({"type": "statistics", "content": f"Last 7 days: {stats[0].get('total', 0)} feedback, avg sentiment {stats[0].get('avg_sentiment', 0):.2f}, {stats[0].get('critical', 0)} critical alerts.", "metadata": stats[0]})
    except: pass
    
    seen = set()
    unique_sources = [s for s in sources if not (s.id in seen or seen.add(s.id))]
    return context, unique_sources[:10]


def build_system_prompt(context: List[Dict[str, Any]]) -> str:
    context_str = "\n\n".join([f"[{item['type'].upper()}]\n{item['content']}\nMetadata: {json.dumps(item.get('metadata', {}))}" for item in context])
    return f"""You are Signal, an AI assistant for Cloudflare's customer feedback intelligence platform.
You help Product Managers understand customer feedback, identify trends, and prioritize issues.

Guidelines:
- Be concise and actionable
- Use specific numbers and customer names when available
- Highlight urgency and business impact
- Suggest next steps when appropriate

Retrieved Context:
{context_str}

Answer based on this context. If irrelevant, acknowledge what you know and suggest alternatives."""


@router.post("", response_model=ChatResponse)
async def send_chat_message(request: ChatRequest):
    conversation_id = request.conversation_id or str(uuid.uuid4())
    if conversation_id not in conversations:
        conversations[conversation_id] = []
    
    context, sources = await retrieve_context(request.message)
    system_prompt = build_system_prompt(context)
    
    history = conversations[conversation_id][-10:]
    full_prompt = request.message
    if history:
        history_str = "\n".join([f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}" for m in history])
        full_prompt = f"Previous:\n{history_str}\n\nUser: {request.message}"
    
    response = await workers_ai.generate_text(full_prompt, system_prompt=system_prompt, max_tokens=1000)
    
    conversations[conversation_id].append({"role": "user", "content": request.message})
    conversations[conversation_id].append({"role": "assistant", "content": response})
    if len(conversations[conversation_id]) > 50:
        conversations[conversation_id] = conversations[conversation_id][-50:]
    
    return ChatResponse(message=response, sources=sources, conversation_id=conversation_id)


@router.get("/history/{conversation_id}")
async def get_chat_history(conversation_id: str):
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"data": conversations[conversation_id]}


@router.delete("/history/{conversation_id}")
async def clear_chat_history(conversation_id: str):
    if conversation_id in conversations:
        del conversations[conversation_id]
    return {"status": "cleared"}


@router.post("/summarize")
async def summarize_feedback(feedback_ids: List[str]):
    if not feedback_ids:
        raise HTTPException(status_code=400, detail="No feedback IDs provided")
    
    feedback_items = await d1_client.query(f"SELECT * FROM feedback WHERE id IN ({','.join(['?' for _ in feedback_ids])})", feedback_ids)
    if not feedback_items:
        raise HTTPException(status_code=404, detail="No feedback found")
    
    combined = "\n\n".join([f"- [{item.get('source', 'unknown')}] {item.get('content', '')}" for item in feedback_items])
    summary = await workers_ai.generate_text(f"Summarize:\n\n{combined}", system_prompt="Summarize feedback highlighting: main themes, sentiment, urgency, recommended actions.", max_tokens=500)
    
    return {"summary": summary, "feedback_count": len(feedback_items), "feedback_ids": [item["id"] for item in feedback_items]}
