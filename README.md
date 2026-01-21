# Cerebro - Customer Feedback Intelligence Platform

A full-stack customer feedback intelligence platform built entirely on Cloudflare's developer platform. Cerebro collects feedback from multiple sources, analyzes sentiment and themes using AI, and surfaces actionable insights through an interactive dashboard.

> **⚠️ Prototype Notice:** This is a demo prototype that uses synthetic data generation. Webhook integrations exist in code but are not connected to real external sources.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  DATA GENERATION (Prototype)                     │
│   Cron Trigger (hourly) │ Manual Trigger │ SQL Seeds            │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Synthetic feedback
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                 CLOUDFLARE WORKERS (Edge Runtime)                │
│   Scheduled │ Feedback │ Analytics │ Chat │ Search │ Alerts     │
└─────────────────────────────────────────────────────────────────┘
                    │              │              │
                    ▼              ▼              ▼
             ┌───────────┐  ┌───────────┐  ┌───────────┐
             │ Workers AI│  │    D1     │  │ Vectorize │
             │ (ML)      │  │  (SQL)    │  │ (Vectors) │
             └───────────┘  └───────────┘  └───────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   Cloudflare Pages      │
                    │   (React Dashboard)     │
                    └─────────────────────────┘
```

## 🛠️ Cloudflare Products Used

| Product | Purpose | Free Tier |
|---------|---------|-----------|
| **Workers** | API endpoints, business logic, handlers | 100K requests/day |
| **Workers AI** | Sentiment analysis, theme classification, embeddings, chat | 10K neurons/day |
| **D1** | SQLite database for feedback, customers, alerts | 5M reads/day |
| **Vectorize** | Vector embeddings for semantic search & RAG | 30M dimensions |
| **Pages** | React dashboard hosting with global CDN | Unlimited sites |
| **Cron Triggers** | Scheduled synthetic data generation | Included with Workers |

> **Note:** Queues (async processing) requires Workers Paid plan ($5/mo). Code exists but is disabled in this prototype.

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm** or **pnpm** - Comes with Node.js
- **Wrangler CLI** - Cloudflare's CLI tool
- **Cloudflare Account** - [Sign up free](https://dash.cloudflare.com/sign-up)

Optional (for local backend development):
- Python 3.11+ with pip

## 🚀 Setup Guide

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd signal-platform

# Install Wrangler CLI globally
npm install -g wrangler

# Install frontend dependencies
cd frontend && npm install

# Install workers dependencies
cd ../workers && npm install

# Return to root
cd ..
```

### Step 2: Authenticate with Cloudflare

```bash
# Login to your Cloudflare account
wrangler login

# Verify authentication
wrangler whoami
```

### Step 3: Create Cloudflare Resources

```bash
# Create D1 Database
wrangler d1 create cerebro-db

# Create Vectorize Index (768 dimensions for BGE embeddings)
wrangler vectorize create cerebro-embeddings --dimensions=768 --metric=cosine
```

After running these commands, you'll see output with resource IDs. **Save these IDs!**

### Step 4: Configure wrangler.toml

Open `workers/wrangler.toml` and update with your resource IDs:

```toml
name = "cerebro-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# Update these with YOUR resource IDs from Step 3
[[d1_databases]]
binding = "DB"
database_name = "cerebro-db"
database_id = "YOUR_D1_DATABASE_ID"  # <-- Replace this

[[vectorize]]
binding = "VECTORIZE"
index_name = "cerebro-embeddings"

# AI binding (no config needed)
[ai]
binding = "AI"

# Cron trigger for synthetic data (hourly)
[triggers]
crons = ["0 * * * *"]
```

### Step 5: Run Database Migrations

```bash
cd workers

# Run the initial schema migration
wrangler d1 execute cerebro-db --remote --file=./migrations/001_initial.sql

# Seed with initial data (optional)
wrangler d1 execute cerebro-db --remote --file=./migrations/002_seed_data.sql
```

### Step 6: Deploy the Worker

```bash
cd workers

# Deploy to Cloudflare
npm run deploy
# or: wrangler deploy

# Note your worker URL (e.g., https://cerebro-api.<your-subdomain>.workers.dev)
```

### Step 7: Configure Frontend

Update the API URL in `frontend/src/services/api.ts`:

```typescript
const API_BASE_URL = 'https://cerebro-api.<your-subdomain>.workers.dev';
```

### Step 8: Deploy Frontend to Pages

```bash
cd frontend

# Build the frontend
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=cerebro-dashboard
```

Or connect your GitHub repo to Cloudflare Pages for automatic deployments.

## 🧪 Local Development

### Run Workers Locally

```bash
cd workers

# Start local development server
npm run dev
# or: wrangler dev

# Worker runs at http://localhost:8787
```

### Run Frontend Locally

```bash
cd frontend

# Start Vite dev server
npm run dev

# Dashboard runs at http://localhost:5173
```

### Generate Test Data

```bash
# Trigger synthetic data generation manually
curl -X POST http://localhost:8787/api/cron/trigger

# Or via deployed worker
curl -X POST https://cerebro-api.<subdomain>.workers.dev/api/cron/trigger
```

## 📁 Project Structure

```
signal-platform/
├── frontend/                 # React Dashboard (Cloudflare Pages)
│   ├── src/
│   │   ├── App.tsx          # Main dashboard component
│   │   ├── components/      # UI components (AIChatbot, etc.)
│   │   ├── hooks/           # React hooks (useApi)
│   │   ├── services/        # API client
│   │   └── styles/          # Tailwind CSS
│   └── package.json
│
├── workers/                  # Cloudflare Workers (API)
│   ├── src/
│   │   ├── index.ts         # Main router
│   │   ├── handlers/        # API route handlers
│   │   │   ├── feedback.ts  # Feedback CRUD
│   │   │   ├── analytics.ts # Metrics & reports
│   │   │   ├── chat.ts      # AI chatbot
│   │   │   ├── search.ts    # Semantic search
│   │   │   ├── alerts.ts    # Alert management
│   │   │   └── scheduled.ts # Cron data generation
│   │   ├── services/        # Business logic
│   │   │   ├── ai.ts        # Workers AI integration
│   │   │   ├── database.ts  # D1 queries
│   │   │   └── vectorize.ts # Vector operations
│   │   └── types/           # TypeScript types
│   ├── migrations/          # D1 SQL migrations
│   └── wrangler.toml        # Worker configuration
│
├── backend/                  # FastAPI (optional, local dev only)
│
├── Cerebro_Architecture.rtf  # Detailed architecture documentation
└── README.md                 # This file
```

## 🔧 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/feedback` | GET | List feedback with filters |
| `/api/feedback` | POST | Submit new feedback |
| `/api/feedback/:id` | GET | Get single feedback item |
| `/api/analytics/overview` | GET | Dashboard metrics |
| `/api/analytics/trends` | GET | Trend data over time |
| `/api/analytics/report` | GET | AI-generated report |
| `/api/chat` | POST | AI chatbot query |
| `/api/search` | GET | Semantic search |
| `/api/alerts` | GET | List alerts |
| `/api/cron/trigger` | POST | Manually trigger data generation |

## 🤖 AI Models Used

| Model | Task | Binding |
|-------|------|---------|
| DistilBERT SST-2 | Sentiment Analysis | `@cf/huggingface/distilbert-sst-2-int8` |
| Llama 3.1 8B | Theme Classification, Chat | `@cf/meta/llama-3.1-8b-instruct` |
| BGE Base EN | Text Embeddings (768-dim) | `@cf/baai/bge-base-en-v1.5` |
| BART Large CNN | Summarization | `@cf/facebook/bart-large-cnn` |

## 🐛 Troubleshooting

### "D1 database not found"
- Ensure `database_id` in `wrangler.toml` matches the ID from `wrangler d1 create`
- Run `wrangler d1 list` to see all your databases

### "Vectorize index not found"
- Run `wrangler vectorize list` to verify the index exists
- Ensure `index_name` in `wrangler.toml` matches exactly

### "AI model error"
- Workers AI has rate limits on free tier (10K neurons/day)
- Check Cloudflare dashboard for quota usage

### CORS errors in browser
- Ensure the Worker has proper CORS headers
- Check that `API_BASE_URL` in frontend matches the deployed worker URL

### Cron not generating data
- Crons only run on deployed workers, not locally
- Use `/api/cron/trigger` endpoint for manual testing

## 📚 Additional Resources

- [Cerebro_Architecture.rtf](./Cerebro_Architecture.rtf) - Detailed architecture documentation
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [Workers AI Models](https://developers.cloudflare.com/workers-ai/models/)
- [Vectorize Guide](https://developers.cloudflare.com/vectorize/)

## 📄 License

MIT License - See LICENSE file for details
