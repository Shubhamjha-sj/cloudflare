# Signal - Customer Feedback Intelligence Platform

A full-stack application for aggregating and analyzing customer feedback using Cloudflare's developer platform.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FEEDBACK SOURCES                                    │
│         Discord │ GitHub │ Twitter │ Support Tickets │ Email │ Forums          │
└─────────────────────────────────────┬───────────────────────────────────────────┘
                                      │ Webhooks / Polling
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE WORKERS (Edge)                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  Ingestion   │  │  Processing  │  │  Dashboard   │  │  AI Chatbot          │ │
│  │  Worker      │  │  Worker      │  │  API Worker  │  │  Worker              │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │
└─────────┼─────────────────┼─────────────────┼────────────────────┼──────────────┘
          │                 │                 │                    │
          ▼                 ▼                 ▼                    ▼
┌─────────────────┐ ┌───────────────┐ ┌─────────────┐ ┌────────────────────────────┐
│   QUEUES        │ │  WORKERS AI   │ │     D1      │ │  VECTORIZE + AI SEARCH     │
│ (Async tasks)   │ │ (Analysis)    │ │ (Database)  │ │  (RAG / Semantic Search)   │
└─────────────────┘ └───────────────┘ └─────────────┘ └────────────────────────────┘
                                            │
                                            ▼
                              ┌─────────────────────────┐
                              │   CLOUDFLARE PAGES      │
                              │   (React Dashboard)     │
                              └─────────────────────────┘
```

## 🛠️ Cloudflare Products Used

| Product | Purpose |
|---------|---------|
| **Workers** | API endpoints, data processing, webhooks |
| **Workers AI** | Sentiment analysis, classification, summarization |
| **D1** | Structured feedback storage (SQL) |
| **Vectorize** | Vector embeddings for semantic search |
| **AI Search** | Managed RAG pipelines for chatbot |
| **Queues** | Async feedback processing pipeline |
| **Pages** | Dashboard hosting with global CDN |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- Wrangler CLI (`npm install -g wrangler`)

### Setup

```bash
# 1. Install dependencies
cd frontend && npm install
cd ../workers && npm install
cd ../backend && pip install -r requirements.txt

# 2. Login to Cloudflare
wrangler login

# 3. Create resources
wrangler d1 create signal-db
wrangler vectorize create signal-embeddings --dimensions=768 --metric=cosine
wrangler queues create signal-feedback-queue

# 4. Update wrangler.toml with your resource IDs

# 5. Run migrations
cd workers && wrangler d1 execute signal-db --file=./migrations/001_initial.sql

# 6. Start development
cd frontend && npm run dev      # Terminal 1
cd workers && npm run dev       # Terminal 2
cd backend && uvicorn main:app --reload  # Terminal 3 (optional)
```

### Deploy

```bash
cd workers && npm run deploy
cd frontend && npm run deploy
```

## 📁 Project Structure

```
signal-platform/
├── frontend/           # React Dashboard (Cloudflare Pages)
├── backend/            # FastAPI Backend (optional local dev)
├── workers/            # Cloudflare Workers
└── docs/               # Documentation
```
