"""Cloudflare Services - Workers AI, Vectorize, Queues, AI Search"""

import httpx
import json
from typing import List, Dict, Any, Optional
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings, cf_endpoints


class WorkersAIService:
    def __init__(self):
        self.account_id = settings.CLOUDFLARE_ACCOUNT_ID
        self.api_token = settings.CLOUDFLARE_API_TOKEN
        self.headers = {"Authorization": f"Bearer {self.api_token}", "Content-Type": "application/json"}
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10))
    async def _call_model(self, model: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = cf_endpoints.workers_ai(self.account_id, model)
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()
    
    async def generate_embedding(self, text: str) -> List[float]:
        result = await self._call_model(settings.EMBEDDING_MODEL, {"text": text})
        if result.get("success") and result.get("result"):
            return result["result"]["data"][0]
        raise Exception(f"Failed to generate embedding: {result}")
    
    async def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        result = await self._call_model(settings.SENTIMENT_MODEL, {"text": text})
        if result.get("success") and result.get("result"):
            scores = result["result"][0]
            positive = next((s["score"] for s in scores if s["label"] == "POSITIVE"), 0)
            negative = next((s["score"] for s in scores if s["label"] == "NEGATIVE"), 0)
            score = positive - negative
            
            if score > 0.3: label = "positive"
            elif score < -0.5: label = "frustrated"
            elif score < -0.3: label = "concerned"
            elif score < -0.1: label = "annoyed"
            elif score < 0.1: label = "neutral"
            else: label = "positive"
            
            return {"score": score, "label": label, "raw_scores": scores}
        raise Exception(f"Failed to analyze sentiment: {result}")
    
    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None, max_tokens: int = 1000) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        result = await self._call_model(settings.TEXT_GENERATION_MODEL, {"messages": messages, "max_tokens": max_tokens, "temperature": 0.7})
        if result.get("success") and result.get("result"):
            return result["result"]["response"]
        raise Exception(f"Failed to generate text: {result}")
    
    async def classify_themes(self, text: str) -> List[str]:
        system_prompt = """You are a feedback classifier. Analyze and return a JSON array of themes.
        Possible: performance, reliability, documentation, pricing, support, feature-request, bug, security, usability, integration.
        Return only the JSON array."""
        response = await self.generate_text(f"Classify: {text}", system_prompt, max_tokens=100)
        try:
            themes = json.loads(response.strip())
            if isinstance(themes, list): return themes
        except: pass
        return ["uncategorized"]
    
    async def calculate_urgency(self, text: str, customer_tier: str, arr: int) -> int:
        system_prompt = "Rate urgency 1-10 based on impact severity, business impact, customer tier/ARR. Return only a number."
        response = await self.generate_text(f"Content: {text}\nTier: {customer_tier}\nARR: ${arr}", system_prompt, max_tokens=10)
        try:
            return max(1, min(10, int(response.strip())))
        except:
            return {"enterprise": 7, "pro": 5, "free": 3}.get(customer_tier.lower(), 5)


class VectorizeService:
    def __init__(self):
        self.account_id = settings.CLOUDFLARE_ACCOUNT_ID
        self.api_token = settings.CLOUDFLARE_API_TOKEN
        self.index_name = settings.VECTORIZE_INDEX_NAME
        self.headers = {"Authorization": f"Bearer {self.api_token}", "Content-Type": "application/json"}
    
    async def insert(self, id: str, vector: List[float], metadata: Dict[str, Any]) -> Dict[str, Any]:
        url = cf_endpoints.vectorize_insert(self.account_id, self.index_name)
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=self.headers, json={"vectors": [{"id": id, "values": vector, "metadata": metadata}]})
            response.raise_for_status()
            return response.json()
    
    async def query(self, vector: List[float], top_k: int = 10, filter: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        url = cf_endpoints.vectorize_query(self.account_id, self.index_name)
        payload = {"vector": vector, "topK": top_k, "returnValues": False, "returnMetadata": True}
        if filter: payload["filter"] = filter
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            result = response.json()
            return result.get("result", {}).get("matches", []) if result.get("success") else []
    
    async def delete(self, ids: List[str]) -> Dict[str, Any]:
        url = f"{cf_endpoints.BASE_URL}/accounts/{self.account_id}/vectorize/indexes/{self.index_name}/delete-by-ids"
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=self.headers, json={"ids": ids})
            response.raise_for_status()
            return response.json()


class AISearchService:
    def __init__(self):
        self.account_id = settings.CLOUDFLARE_ACCOUNT_ID
        self.api_token = settings.CLOUDFLARE_API_TOKEN
        self.index_name = settings.AI_SEARCH_INDEX_NAME
        self.headers = {"Authorization": f"Bearer {self.api_token}", "Content-Type": "application/json"}
    
    async def search(self, query: str, limit: int = 10, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        url = cf_endpoints.ai_search_query(self.account_id, self.index_name)
        payload = {"query": query, "limit": limit}
        if filters: payload["filters"] = filters
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            result = response.json()
            return result.get("result", {}).get("documents", []) if result.get("success") else []


class QueueService:
    def __init__(self):
        self.account_id = settings.CLOUDFLARE_ACCOUNT_ID
        self.api_token = settings.CLOUDFLARE_API_TOKEN
        self.queue_name = settings.QUEUE_NAME
        self.headers = {"Authorization": f"Bearer {self.api_token}", "Content-Type": "application/json"}
    
    async def send_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        url = cf_endpoints.queue_send(self.account_id, self.queue_name)
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=self.headers, json={"messages": [{"body": json.dumps(message)}]})
            response.raise_for_status()
            return response.json()


workers_ai = WorkersAIService()
vectorize = VectorizeService()
ai_search = AISearchService()
queue = QueueService()
