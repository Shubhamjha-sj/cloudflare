/**
 * Signal Platform - Main API Worker
 * Handles HTTP requests for the feedback intelligence platform
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Environment bindings
interface Env {
  DB: D1Database;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  FEEDBACK_QUEUE: Queue;
  ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'https://signal-dashboard.pages.dev'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/', (c) => c.json({ name: 'Signal API', version: '1.0.0', status: 'healthy' }));
app.get('/health', (c) => c.json({ status: 'healthy' }));

// ============================================
// Feedback Routes
// ============================================

app.get('/api/feedback', async (c) => {
  const { DB } = c.env;
  const { page = '1', page_size = '20', source, product, status } = c.req.query();
  
  let sql = 'SELECT * FROM feedback WHERE 1=1';
  const params: any[] = [];
  
  if (source) {
    sql += ' AND source = ?';
    params.push(source);
  }
  if (product) {
    sql += ' AND product = ?';
    params.push(product);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(page_size), (parseInt(page) - 1) * parseInt(page_size));
  
  const results = await DB.prepare(sql).bind(...params).all();
  const countResult = await DB.prepare('SELECT COUNT(*) as total FROM feedback').first();
  
  return c.json({
    data: results.results,
    total: countResult?.total || 0,
    page: parseInt(page),
    page_size: parseInt(page_size),
    has_more: (parseInt(page) * parseInt(page_size)) < (countResult?.total as number || 0)
  });
});

app.get('/api/feedback/:id', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');
  
  const result = await DB.prepare('SELECT * FROM feedback WHERE id = ?').bind(id).first();
  
  if (!result) {
    return c.json({ error: 'Feedback not found' }, 404);
  }
  
  return c.json({ data: result });
});

app.post('/api/feedback', async (c) => {
  const { DB, AI, VECTORIZE, FEEDBACK_QUEUE } = c.env;
  const body = await c.req.json();
  
  const id = crypto.randomUUID();
  
  // Analyze sentiment using Workers AI
  const sentimentResult = await AI.run('@cf/huggingface/distilbert-sst-2-int8', {
    text: body.content
  }) as any;
  
  const positiveScore = sentimentResult[0]?.find((s: any) => s.label === 'POSITIVE')?.score || 0;
  const negativeScore = sentimentResult[0]?.find((s: any) => s.label === 'NEGATIVE')?.score || 0;
  const sentiment = positiveScore - negativeScore;
  
  let sentimentLabel = 'neutral';
  if (sentiment > 0.3) sentimentLabel = 'positive';
  else if (sentiment < -0.5) sentimentLabel = 'frustrated';
  else if (sentiment < -0.3) sentimentLabel = 'concerned';
  else if (sentiment < -0.1) sentimentLabel = 'annoyed';
  
  // Generate embedding for vector search
  const embeddingResult = await AI.run('@cf/baai/bge-base-en-v1.5', {
    text: body.content
  }) as any;
  
  const embedding = embeddingResult.data[0];
  
  // Calculate urgency (simplified)
  let urgency = 5;
  if (body.customer_tier === 'enterprise') urgency += 2;
  if (sentiment < -0.5) urgency += 2;
  if (body.content.toLowerCase().includes('urgent') || body.content.toLowerCase().includes('critical')) urgency += 2;
  urgency = Math.min(10, Math.max(1, urgency));
  
  // Insert into D1
  await DB.prepare(`
    INSERT INTO feedback (id, content, source, sentiment, sentiment_label, urgency, product, themes, customer_id, customer_name, customer_tier, customer_arr, status, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(
    id,
    body.content,
    body.source,
    sentiment,
    sentimentLabel,
    urgency,
    body.product || null,
    JSON.stringify(body.themes || []),
    body.customer_id || null,
    body.customer_name || null,
    body.customer_tier || null,
    body.customer_arr || 0,
    'new',
    JSON.stringify(body.metadata || {})
  ).run();
  
  // Insert into Vectorize
  await VECTORIZE.insert([{
    id,
    values: embedding,
    metadata: {
      source: body.source,
      product: body.product,
      sentiment,
      urgency,
      customer_tier: body.customer_tier
    }
  }]);
  
  // Queue for additional processing
  await FEEDBACK_QUEUE.send({
    type: 'process_feedback',
    feedback_id: id,
    content: body.content
  });
  
  return c.json({
    data: {
      id,
      sentiment,
      sentiment_label: sentimentLabel,
      urgency,
      status: 'new'
    }
  }, 201);
});

// ============================================
// Analytics Routes
// ============================================

app.get('/api/analytics/summary', async (c) => {
  const { DB } = c.env;
  const { time_range = '7d' } = c.req.query();
  
  const days = time_range === '24h' ? 1 : time_range === '30d' ? 30 : time_range === '90d' ? 90 : 7;
  
  const stats = await DB.prepare(`
    SELECT 
      COUNT(*) as total_feedback,
      AVG(sentiment) as avg_sentiment,
      COUNT(CASE WHEN urgency >= 8 THEN 1 END) as critical_alerts,
      COUNT(DISTINCT CASE WHEN customer_tier = 'enterprise' THEN customer_id END) as enterprise_affected
    FROM feedback
    WHERE created_at >= datetime('now', '-${days} days')
  `).first();
  
  return c.json({
    data: {
      total_feedback: stats?.total_feedback || 0,
      total_feedback_change: 12.5,
      avg_sentiment: stats?.avg_sentiment || 0,
      sentiment_change: 0.08,
      critical_alerts: stats?.critical_alerts || 0,
      alerts_change: -2,
      avg_response_time: '4.2h',
      response_time_change: -18,
      enterprise_affected: stats?.enterprise_affected || 0
    }
  });
});

app.get('/api/analytics/themes', async (c) => {
  const { DB } = c.env;
  
  const themes = await DB.prepare(`
    SELECT * FROM themes ORDER BY mentions DESC LIMIT 10
  `).all();
  
  return c.json({ data: themes.results });
});

app.get('/api/analytics/products', async (c) => {
  const { DB } = c.env;
  
  const products = await DB.prepare(`
    SELECT 
      product,
      COUNT(*) as count,
      AVG(sentiment) as sentiment
    FROM feedback
    WHERE product IS NOT NULL
    GROUP BY product
    ORDER BY count DESC
  `).all();
  
  const total = (products.results as any[]).reduce((sum, p) => sum + p.count, 0);
  
  return c.json({
    data: (products.results as any[]).map(p => ({
      product: p.product,
      count: p.count,
      percentage: total > 0 ? (p.count / total * 100).toFixed(1) : 0,
      sentiment: p.sentiment?.toFixed(2) || 0
    }))
  });
});

app.get('/api/analytics/sources', async (c) => {
  const { DB } = c.env;
  
  const sources = await DB.prepare(`
    SELECT source, COUNT(*) as count
    FROM feedback
    GROUP BY source
    ORDER BY count DESC
  `).all();
  
  const total = (sources.results as any[]).reduce((sum, s) => sum + s.count, 0);
  
  return c.json({
    data: (sources.results as any[]).map(s => ({
      source: s.source,
      count: s.count,
      percentage: total > 0 ? (s.count / total * 100).toFixed(1) : 0
    }))
  });
});

// ============================================
// AI Chat Routes
// ============================================

app.post('/api/chat', async (c) => {
  const { DB, AI, VECTORIZE } = c.env;
  const { message, conversation_id } = await c.req.json();
  
  const convId = conversation_id || crypto.randomUUID();
  
  // Generate embedding for semantic search
  const embeddingResult = await AI.run('@cf/baai/bge-base-en-v1.5', {
    text: message
  }) as any;
  
  const embedding = embeddingResult.data[0];
  
  // Query Vectorize for relevant feedback
  const vectorResults = await VECTORIZE.query(embedding, { topK: 5, returnMetadata: true });
  
  // Get feedback details
  let context = '';
  const sources: any[] = [];
  
  if (vectorResults.matches.length > 0) {
    const ids = vectorResults.matches.map(m => m.id);
    const feedbackResults = await DB.prepare(
      `SELECT * FROM feedback WHERE id IN (${ids.map(() => '?').join(',')})`
    ).bind(...ids).all();
    
    for (const f of feedbackResults.results as any[]) {
      context += `\n[${f.source.toUpperCase()}] ${f.content}\nProduct: ${f.product}, Sentiment: ${f.sentiment?.toFixed(2)}, Urgency: ${f.urgency}\n`;
      sources.push({
        type: 'feedback',
        id: f.id,
        title: f.content.substring(0, 50) + '...',
        relevance: vectorResults.matches.find(m => m.id === f.id)?.score || 0
      });
    }
  }
  
  // Get recent stats
  const stats = await DB.prepare(`
    SELECT COUNT(*) as total, AVG(sentiment) as avg_sentiment, COUNT(CASE WHEN urgency >= 8 THEN 1 END) as critical
    FROM feedback WHERE created_at >= datetime('now', '-7 days')
  `).first();
  
  context += `\n\nSummary: ${stats?.total || 0} feedback items in last 7 days, avg sentiment ${(stats?.avg_sentiment as number || 0).toFixed(2)}, ${stats?.critical || 0} critical alerts.`;
  
  // Generate response using Workers AI
  const response = await AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'system',
        content: `You are Signal, an AI assistant for Cloudflare's customer feedback intelligence platform. Help Product Managers understand feedback, identify trends, and prioritize issues.

Retrieved Context:
${context}

Be concise, use specific numbers, highlight urgency and business impact.`
      },
      { role: 'user', content: message }
    ],
    max_tokens: 1000,
    temperature: 0.7
  }) as any;
  
  return c.json({
    message: response.response,
    sources,
    conversation_id: convId
  });
});

// ============================================
// Search Routes
// ============================================

app.post('/api/search/semantic', async (c) => {
  const { DB, AI, VECTORIZE } = c.env;
  const { query, limit = 10 } = await c.req.json();
  
  // Generate embedding
  const embeddingResult = await AI.run('@cf/baai/bge-base-en-v1.5', {
    text: query
  }) as any;
  
  const embedding = embeddingResult.data[0];
  
  // Query Vectorize
  const vectorResults = await VECTORIZE.query(embedding, { topK: limit, returnMetadata: true });
  
  if (vectorResults.matches.length === 0) {
    return c.json({ data: [] });
  }
  
  // Get feedback details
  const ids = vectorResults.matches.map(m => m.id);
  const feedbackResults = await DB.prepare(
    `SELECT * FROM feedback WHERE id IN (${ids.map(() => '?').join(',')})`
  ).bind(...ids).all();
  
  const results = (feedbackResults.results as any[]).map(f => ({
    ...f,
    score: vectorResults.matches.find(m => m.id === f.id)?.score || 0
  }));
  
  return c.json({ data: results });
});

// ============================================
// Alerts Routes
// ============================================

app.get('/api/alerts', async (c) => {
  const { DB } = c.env;
  const { limit = '10' } = c.req.query();
  
  const alerts = await DB.prepare(`
    SELECT * FROM alerts
    ORDER BY 
      CASE type WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
      created_at DESC
    LIMIT ?
  `).bind(parseInt(limit)).all();
  
  return c.json({ data: alerts.results });
});

app.post('/api/alerts/:id/acknowledge', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');
  
  await DB.prepare('UPDATE alerts SET acknowledged = 1 WHERE id = ?').bind(id).run();
  
  const result = await DB.prepare('SELECT * FROM alerts WHERE id = ?').bind(id).first();
  
  return c.json({ data: result });
});

// ============================================
// Customers Routes
// ============================================

app.get('/api/customers', async (c) => {
  const { DB } = c.env;
  const { page = '1', page_size = '20', tier } = c.req.query();
  
  let sql = 'SELECT * FROM customers WHERE 1=1';
  const params: any[] = [];
  
  if (tier) {
    sql += ' AND tier = ?';
    params.push(tier);
  }
  
  sql += ' ORDER BY arr DESC LIMIT ? OFFSET ?';
  params.push(parseInt(page_size), (parseInt(page) - 1) * parseInt(page_size));
  
  const results = await DB.prepare(sql).bind(...params).all();
  
  return c.json({ data: results.results });
});

app.get('/api/customers/:id', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');
  
  const result = await DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first();
  
  if (!result) {
    return c.json({ error: 'Customer not found' }, 404);
  }
  
  return c.json({ data: result });
});

// ============================================
// Webhooks Routes
// ============================================

app.post('/webhooks/github', async (c) => {
  const { FEEDBACK_QUEUE } = c.env;
  const event = c.req.header('X-GitHub-Event');
  const body = await c.req.json();
  
  if (event === 'issues' && ['opened', 'edited'].includes(body.action)) {
    const issue = body.issue;
    await FEEDBACK_QUEUE.send({
      type: 'process_feedback',
      feedback_id: crypto.randomUUID(),
      content: `${issue.title}\n\n${issue.body}`,
      source: 'github',
      metadata: {
        github_issue_number: issue.number,
        github_issue_url: issue.html_url,
        github_repo: body.repository.full_name,
        github_user: issue.user.login
      }
    });
  }
  
  return c.json({ status: 'received', event });
});

app.post('/webhooks/discord', async (c) => {
  const { FEEDBACK_QUEUE } = c.env;
  const body = await c.req.json();
  
  if (body.author?.bot) {
    return c.json({ status: 'ignored', reason: 'bot message' });
  }
  
  await FEEDBACK_QUEUE.send({
    type: 'process_feedback',
    feedback_id: crypto.randomUUID(),
    content: body.content,
    source: 'discord',
    metadata: {
      discord_channel_id: body.channel_id,
      discord_message_id: body.id,
      discord_user: body.author?.username
    }
  });
  
  return c.json({ status: 'received' });
});

// Export for Cloudflare Workers
export default app;

// Queue consumer
export async function queue(batch: MessageBatch<any>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    const { type, feedback_id, content, source, metadata } = message.body;
    
    if (type === 'process_feedback') {
      // Additional processing can be done here
      // e.g., theme extraction, alert generation, etc.
      console.log(`Processing feedback ${feedback_id}`);
    }
    
    message.ack();
  }
}

// Scheduled handler
export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  const { DB } = env;
  
  // Auto-detect alerts
  const criticalIssues = await DB.prepare(`
    SELECT product, customer_name, customer_arr, content
    FROM feedback
    WHERE urgency >= 9
    AND created_at >= datetime('now', '-24 hours')
    AND customer_tier = 'enterprise'
  `).all();
  
  for (const issue of criticalIssues.results as any[]) {
    await DB.prepare(`
      INSERT INTO alerts (id, type, message, product, acknowledged, created_at)
      VALUES (?, 'critical', ?, ?, 0, datetime('now'))
    `).bind(
      crypto.randomUUID(),
      `Critical issue from ${issue.customer_name} ($${issue.customer_arr} ARR) - ${issue.product}: ${issue.content.substring(0, 100)}...`,
      issue.product
    ).run();
  }
  
  console.log(`Scheduled task completed at ${event.scheduledTime}`);
}
