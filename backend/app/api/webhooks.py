"""
Webhooks API Routes
Handle incoming webhooks from GitHub, Discord, Zendesk, etc.
"""

from fastapi import APIRouter, HTTPException, Header, Request
from typing import Optional
import uuid
import hmac
import hashlib
import json
from datetime import datetime

from app.models.schemas import (
    GitHubWebhook,
    DiscordWebhook,
    ZendeskWebhook,
    FeedbackSource,
)
from app.services.cloudflare import queue, workers_ai
from app.core.config import settings
from app.core.database import d1_client

router = APIRouter()


def verify_github_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify GitHub webhook signature."""
    if not signature:
        return False
    
    expected = "sha256=" + hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(expected, signature)


@router.post("/github")
async def github_webhook(
    request: Request,
    x_hub_signature_256: Optional[str] = Header(None),
    x_github_event: Optional[str] = Header(None),
):
    """Handle GitHub webhook events (issues, comments, discussions)."""
    
    body = await request.body()
    
    # Verify signature in production
    # if not verify_github_signature(body, x_hub_signature_256, settings.GITHUB_WEBHOOK_SECRET):
    #     raise HTTPException(status_code=401, detail="Invalid signature")
    
    payload = json.loads(body)
    event_type = x_github_event
    
    feedback_items = []
    
    if event_type == "issues" and payload.get("action") in ["opened", "edited"]:
        issue = payload.get("issue", {})
        
        feedback_items.append({
            "content": f"{issue.get('title', '')}\n\n{issue.get('body', '')}",
            "source": FeedbackSource.GITHUB.value,
            "metadata": {
                "github_issue_number": issue.get("number"),
                "github_issue_url": issue.get("html_url"),
                "github_repo": payload.get("repository", {}).get("full_name"),
                "github_user": issue.get("user", {}).get("login"),
                "github_labels": [l.get("name") for l in issue.get("labels", [])],
            }
        })
    
    elif event_type == "issue_comment" and payload.get("action") == "created":
        comment = payload.get("comment", {})
        issue = payload.get("issue", {})
        
        feedback_items.append({
            "content": comment.get("body", ""),
            "source": FeedbackSource.GITHUB.value,
            "metadata": {
                "github_issue_number": issue.get("number"),
                "github_comment_url": comment.get("html_url"),
                "github_repo": payload.get("repository", {}).get("full_name"),
                "github_user": comment.get("user", {}).get("login"),
            }
        })
    
    elif event_type == "discussion" and payload.get("action") in ["created", "edited"]:
        discussion = payload.get("discussion", {})
        
        feedback_items.append({
            "content": f"{discussion.get('title', '')}\n\n{discussion.get('body', '')}",
            "source": FeedbackSource.GITHUB.value,
            "metadata": {
                "github_discussion_url": discussion.get("html_url"),
                "github_repo": payload.get("repository", {}).get("full_name"),
                "github_user": discussion.get("user", {}).get("login"),
                "github_category": discussion.get("category", {}).get("name"),
            }
        })
    
    # Queue for processing
    for item in feedback_items:
        feedback_id = str(uuid.uuid4())
        await queue.send_message({
            "type": "process_feedback",
            "feedback_id": feedback_id,
            **item
        })
    
    return {
        "status": "received",
        "event": event_type,
        "items_queued": len(feedback_items)
    }


@router.post("/discord")
async def discord_webhook(request: Request):
    """Handle Discord webhook events."""
    
    payload = await request.json()
    
    # Discord sends different event types
    event_type = payload.get("type")
    
    # Handle message events
    if event_type == 0:  # PING
        return {"type": 1}  # PONG
    
    content = payload.get("content", "")
    author = payload.get("author", {})
    
    # Filter out bot messages
    if author.get("bot"):
        return {"status": "ignored", "reason": "bot message"}
    
    # Only process messages from specific channels or with keywords
    channel_id = payload.get("channel_id")
    
    feedback_id = str(uuid.uuid4())
    
    await queue.send_message({
        "type": "process_feedback",
        "feedback_id": feedback_id,
        "content": content,
        "source": FeedbackSource.DISCORD.value,
        "metadata": {
            "discord_channel_id": channel_id,
            "discord_guild_id": payload.get("guild_id"),
            "discord_message_id": payload.get("id"),
            "discord_user": author.get("username"),
            "discord_user_id": author.get("id"),
        }
    })
    
    return {"status": "received", "feedback_id": feedback_id}


@router.post("/zendesk")
async def zendesk_webhook(
    request: Request,
    x_zendesk_webhook_signature: Optional[str] = Header(None),
):
    """Handle Zendesk ticket webhooks."""
    
    payload = await request.json()
    
    ticket = payload.get("ticket", {})
    requester = payload.get("requester", {})
    
    # Extract customer info
    customer_name = requester.get("name")
    customer_email = requester.get("email")
    
    # Try to match with existing customer
    customer_tier = "unknown"
    customer_arr = 0
    customer_id = None
    
    if customer_email:
        # Look up customer by email domain
        domain = customer_email.split("@")[-1] if "@" in customer_email else None
        if domain:
            customer_sql = "SELECT * FROM customers WHERE name LIKE ? LIMIT 1"
            customers = await d1_client.query(customer_sql, [f"%{domain}%"])
            if customers:
                customer = customers[0]
                customer_id = customer.get("id")
                customer_tier = customer.get("tier", "unknown")
                customer_arr = customer.get("arr", 0)
                customer_name = customer.get("name")
    
    # Map Zendesk priority to urgency
    priority_map = {
        "urgent": 9,
        "high": 7,
        "normal": 5,
        "low": 3
    }
    urgency_hint = priority_map.get(ticket.get("priority"), 5)
    
    feedback_id = str(uuid.uuid4())
    
    await queue.send_message({
        "type": "process_feedback",
        "feedback_id": feedback_id,
        "content": f"{ticket.get('subject', '')}\n\n{ticket.get('description', '')}",
        "source": FeedbackSource.SUPPORT.value,
        "customer_id": customer_id,
        "customer_name": customer_name,
        "customer_tier": customer_tier,
        "customer_arr": customer_arr,
        "metadata": {
            "zendesk_ticket_id": ticket.get("id"),
            "zendesk_ticket_url": ticket.get("url"),
            "zendesk_priority": ticket.get("priority"),
            "zendesk_status": ticket.get("status"),
            "zendesk_tags": ticket.get("tags", []),
            "zendesk_requester_email": customer_email,
            "urgency_hint": urgency_hint,
        }
    })
    
    return {"status": "received", "feedback_id": feedback_id}


@router.post("/email")
async def email_webhook(request: Request):
    """Handle email forwarding webhook (e.g., from Mailgun, SendGrid)."""
    
    payload = await request.json()
    
    # Extract email content
    subject = payload.get("subject", "")
    body = payload.get("body", "") or payload.get("text", "") or payload.get("html", "")
    from_email = payload.get("from", "") or payload.get("sender", "")
    
    # Try to match customer
    customer_tier = "unknown"
    customer_arr = 0
    customer_id = None
    customer_name = from_email.split("@")[0] if "@" in from_email else from_email
    
    if from_email:
        domain = from_email.split("@")[-1] if "@" in from_email else None
        if domain:
            customer_sql = "SELECT * FROM customers WHERE name LIKE ? LIMIT 1"
            customers = await d1_client.query(customer_sql, [f"%{domain}%"])
            if customers:
                customer = customers[0]
                customer_id = customer.get("id")
                customer_tier = customer.get("tier", "unknown")
                customer_arr = customer.get("arr", 0)
                customer_name = customer.get("name")
    
    feedback_id = str(uuid.uuid4())
    
    await queue.send_message({
        "type": "process_feedback",
        "feedback_id": feedback_id,
        "content": f"{subject}\n\n{body}",
        "source": FeedbackSource.EMAIL.value,
        "customer_id": customer_id,
        "customer_name": customer_name,
        "customer_tier": customer_tier,
        "customer_arr": customer_arr,
        "metadata": {
            "email_from": from_email,
            "email_subject": subject,
            "email_message_id": payload.get("message_id"),
        }
    })
    
    return {"status": "received", "feedback_id": feedback_id}


@router.post("/twitter")
async def twitter_webhook(request: Request):
    """Handle Twitter/X mention webhook."""
    
    payload = await request.json()
    
    # Twitter webhook format varies
    tweet = payload.get("tweet", payload)
    
    content = tweet.get("text", "")
    user = tweet.get("user", {})
    
    feedback_id = str(uuid.uuid4())
    
    await queue.send_message({
        "type": "process_feedback",
        "feedback_id": feedback_id,
        "content": content,
        "source": FeedbackSource.TWITTER.value,
        "metadata": {
            "twitter_tweet_id": tweet.get("id"),
            "twitter_user": user.get("screen_name"),
            "twitter_user_id": user.get("id"),
            "twitter_followers": user.get("followers_count"),
            "twitter_verified": user.get("verified", False),
        }
    })
    
    return {"status": "received", "feedback_id": feedback_id}


@router.post("/forum")
async def forum_webhook(request: Request):
    """Handle community forum webhook (Discourse, etc.)."""
    
    payload = await request.json()
    
    # Discourse format
    post = payload.get("post", {})
    topic = payload.get("topic", {})
    
    content = post.get("raw", "") or post.get("cooked", "")
    title = topic.get("title", "")
    
    if title:
        content = f"{title}\n\n{content}"
    
    user = post.get("username", "")
    
    feedback_id = str(uuid.uuid4())
    
    await queue.send_message({
        "type": "process_feedback",
        "feedback_id": feedback_id,
        "content": content,
        "source": FeedbackSource.FORUM.value,
        "metadata": {
            "forum_post_id": post.get("id"),
            "forum_topic_id": topic.get("id"),
            "forum_topic_url": topic.get("url"),
            "forum_user": user,
            "forum_category": topic.get("category_name"),
        }
    })
    
    return {"status": "received", "feedback_id": feedback_id}


@router.get("/status")
async def webhook_status():
    """Get webhook configuration status."""
    
    return {
        "webhooks": {
            "github": {"enabled": True, "endpoint": "/webhooks/github"},
            "discord": {"enabled": True, "endpoint": "/webhooks/discord"},
            "zendesk": {"enabled": True, "endpoint": "/webhooks/zendesk"},
            "email": {"enabled": True, "endpoint": "/webhooks/email"},
            "twitter": {"enabled": True, "endpoint": "/webhooks/twitter"},
            "forum": {"enabled": True, "endpoint": "/webhooks/forum"},
        }
    }
