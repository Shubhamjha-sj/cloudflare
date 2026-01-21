/**
 * Cerebro Platform - Cloudflare Workers API
 * Main entry point for all API routes
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './types';

// Import handlers
import chatHandler from './handlers/chat';
import feedbackHandler from './handlers/feedback';
import analyticsHandler from './handlers/analytics';
import searchHandler from './handlers/search';
import webhooksHandler from './handlers/webhooks';
import alertsHandler from './handlers/alerts';

// Import AI services
import { analyzeSentiment, classifyThemes, calculateUrgency } from './services/ai';
import { listFeedback, updateFeedback } from './services/database';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'https://cerebro-dashboard.pages.dev'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'Cerebro Platform API',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cron: 'every hour at :00',
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// Manual trigger for cron job (for testing)
app.post('/api/cron/trigger', async (c) => {
  const env = c.env;
  
  // Generate 5-15 new feedback items
  const count = Math.floor(Math.random() * 11) + 5;
  const now = new Date().toISOString();
  
  const PRODUCTS = ['workers', 'r2', 'pages', 'd1', 'kv', 'durable-objects', 'queues', 'images'];
  const SOURCES = ['github', 'discord', 'twitter', 'support', 'forum', 'email'];
  const CUSTOMERS = [
    { id: 'cust_001', name: 'TechCorp Inc', tier: 'enterprise', arr: 250000 },
    { id: 'cust_002', name: 'StartupXYZ', tier: 'pro', arr: 12000 },
    { id: 'cust_003', name: 'GlobalMedia Ltd', tier: 'enterprise', arr: 180000 },
    { id: 'cust_004', name: 'DevStudio', tier: 'pro', arr: 24000 },
    { id: 'cust_005', name: 'CloudFirst', tier: 'enterprise', arr: 320000 },
  ];
  
  const TEMPLATES = [
    { content: 'Workers cold starts are causing timeouts. Seeing high latency.', themes: ['performance', 'reliability'], sentiment: -0.6 },
    { content: 'Getting CORS errors when accessing from our frontend.', themes: ['bug', 'documentation'], sentiment: -0.5 },
    { content: 'The pricing model is confusing. Need clarity on costs.', themes: ['pricing', 'documentation'], sentiment: -0.3 },
    { content: 'Just migrated and the performance is incredible!', themes: ['performance', 'developer-experience'], sentiment: 0.8 },
    { content: 'Would love to see better monitoring added.', themes: ['feature-request'], sentiment: 0.2 },
    { content: 'Response times are inconsistent during peak traffic.', themes: ['performance', 'reliability'], sentiment: -0.4 },
    { content: 'Build failures with no clear error message.', themes: ['bug', 'developer-experience'], sentiment: -0.7 },
    { content: 'Successfully integrated - works perfectly!', themes: ['integration', 'developer-experience'], sentiment: 0.9 },
  ];
  
  const results: Array<{ id: string; content: string }> = [];
  
  for (let i = 0; i < count; i++) {
    const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
    const customer = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
    const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];
    
    const content = template.content.replace('{product}', product);
    const sentiment = template.sentiment + (Math.random() * 0.2 - 0.1);
    const urgency = template.sentiment < 0 ? Math.floor(Math.random() * 4) + 5 : Math.floor(Math.random() * 3) + 1;
    
    const getSentimentLabel = (s: number) => {
      if (s >= 0.3) return 'positive';
      if (s >= -0.1) return 'neutral';
      if (s >= -0.3) return 'concerned';
      if (s >= -0.5) return 'annoyed';
      return 'frustrated';
    };
    
    const id = `fb_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    
    await env.DB.prepare(`
      INSERT INTO feedback (
        id, content, source, sentiment, sentiment_label, urgency, product,
        themes, customer_id, customer_name, customer_tier, customer_arr,
        status, assigned_to, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      content,
      source,
      Math.round(sentiment * 1000) / 1000,
      getSentimentLabel(sentiment),
      urgency,
      product,
      JSON.stringify(template.themes),
      customer.id,
      customer.name,
      customer.tier,
      customer.arr,
      'new',
      null,
      '{}',
      now,
      now
    ).run();
    
    results.push({ id, content });
  }
  
  return c.json({
    success: true,
    message: `Generated ${count} new feedback items`,
    timestamp: now,
    items: results,
  });
});

// AI Classification Test Endpoint
app.post('/api/ai/classify', async (c) => {
  const env = c.env;
  const body = await c.req.json<{ text: string; customer_tier?: string; arr?: number }>();
  
  if (!body.text) {
    return c.json({ success: false, error: 'text is required' }, 400);
  }
  
  try {
    // Run all AI analysis in parallel
    const [sentiment, themes, urgency] = await Promise.all([
      analyzeSentiment(env, body.text),
      classifyThemes(env, body.text),
      calculateUrgency(env, body.text, body.customer_tier || null, body.arr || null),
    ]);
    
    return c.json({
      success: true,
      data: {
        input: body.text,
        sentiment: {
          score: sentiment.score,
          label: sentiment.label,
        },
        themes,
        urgency,
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Batch AI Classification Endpoint - Process records in batches
// Note: Workers has a 50 subrequest limit. Each record needs 3 AI calls, so max ~15 records per batch
app.post('/api/ai/batch-classify', async (c) => {
  const env = c.env;
  const body = await c.req.json<{ batch_size?: number; page?: number }>();
  
  // Max 15 per batch due to Workers subrequest limit (15 records × 3 AI calls = 45 subrequests)
  const batchSize = Math.min(body.batch_size || 15, 15);
  const page = body.page || 1;
  
  try {
    // Get a batch of feedback records
    const { data: records, total } = await listFeedback(env, {}, { page, page_size: batchSize });
    
    if (records.length === 0) {
      return c.json({ 
        success: true, 
        message: 'No more records to process',
        processed: 0,
        total,
        page,
      });
    }
    
    const results: Array<{ 
      id: string; 
      status: string; 
      input?: string;
      output?: {
        sentiment: number;
        sentiment_label: string;
        themes: string[];
        urgency: number;
      };
      error?: string;
    }> = [];
    
    // Process each record with AI (sequentially to avoid rate limits)
    for (const record of records) {
      // Log input
      console.log(`[AI Classification] Processing ID: ${record.id}`);
      console.log(`[AI Classification] Input: ${record.content.substring(0, 200)}...`);
      
      try {
        // Run AI classification
        const [sentiment, themes, urgency] = await Promise.all([
          analyzeSentiment(env, record.content),
          classifyThemes(env, record.content),
          calculateUrgency(env, record.content, record.customer_tier, record.customer_arr),
        ]);
        
        // Extract theme strings from response
        const themeStrings = Array.isArray(themes) 
          ? themes.map((t: any) => typeof t === 'string' ? t : t.theme || t.name || String(t))
          : [];
        
        // Log output
        console.log(`[AI Classification] Output for ${record.id}:`);
        console.log(`  - Sentiment: ${sentiment.score.toFixed(3)} (${sentiment.label})`);
        console.log(`  - Themes: ${themeStrings.join(', ')}`);
        console.log(`  - Urgency: ${urgency}`);
        
        // Update the record in D1
        await updateFeedback(env, record.id, {
          sentiment: sentiment.score,
          sentiment_label: sentiment.label,
          themes: themeStrings,
          urgency: urgency,
        });
        
        results.push({ 
          id: record.id, 
          status: 'success',
          input: record.content,
          output: {
            sentiment: sentiment.score,
            sentiment_label: sentiment.label,
            themes: themeStrings,
            urgency,
          },
        });
      } catch (error: any) {
        console.log(`[AI Classification] Error for ${record.id}: ${error.message}`);
        results.push({ id: record.id, status: 'error', error: error.message });
      }
    }
    
    const successCount = results.filter(r => r.status === 'success').length;
    const totalPages = Math.ceil(total / batchSize);
    
    return c.json({
      success: true,
      processed: successCount,
      failed: results.length - successCount,
      batch_size: batchSize,
      page,
      total_pages: totalPages,
      total_records: total,
      next_page: page < totalPages ? page + 1 : null,
      results,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get classification progress
app.get('/api/ai/batch-progress', async (c) => {
  const env = c.env;
  
  // Count records with dummy content vs real AI-classified content
  const dummyCount = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM feedback WHERE content LIKE 'Dummy feedback%'
  `).first<{ count: number }>();
  
  const classifiedCount = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM feedback 
    WHERE themes != '["design", "performance"]' 
    AND themes != '["performance", "api"]'
    AND themes != '["feature", "api"]'
    AND themes != '["bug", "api"]'
  `).first<{ count: number }>();
  
  const totalCount = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM feedback
  `).first<{ count: number }>();
  
  return c.json({
    success: true,
    total: totalCount?.count || 0,
    dummy_records: dummyCount?.count || 0,
    estimated_classified: classifiedCount?.count || 0,
  });
});

// Vectorize: Index existing feedback (batch)
// Note: Free tier = 30M dimensions. Each embedding = 768 dims. Max ~39k vectors.
app.post('/api/vectorize/index-batch', async (c) => {
  const env = c.env;
  const body = await c.req.json<{ batch_size?: number; offset?: number }>();
  
  // Limit batch size due to Workers subrequest limit (each embedding = 1 AI call)
  const batchSize = Math.min(body.batch_size || 20, 20);
  const offset = body.offset || 0;
  
  try {
    // Get a batch of feedback records
    const { results } = await env.DB.prepare(`
      SELECT id, content, source, product, sentiment, urgency, customer_tier, created_at
      FROM feedback
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(batchSize, offset).all();
    
    if (!results || results.length === 0) {
      return c.json({
        success: true,
        message: 'No more records to index',
        indexed: 0,
        offset,
        done: true,
      });
    }
    
    const totalResult = await env.DB.prepare('SELECT COUNT(*) as count FROM feedback').first<{ count: number }>();
    const total = totalResult?.count || 0;
    
    const indexed: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];
    
    for (const record of results as any[]) {
      try {
        // Generate embedding using Workers AI
        const embeddingResponse = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
          text: record.content,
        });
        
        const vector = embeddingResponse.data[0];
        
        // Insert into Vectorize
        await env.VECTORIZE.insert([{
          id: record.id,
          values: vector,
          metadata: {
            source: record.source,
            product: record.product,
            sentiment: record.sentiment,
            urgency: record.urgency,
            customer_tier: record.customer_tier,
            created_at: record.created_at,
          },
        }]);
        
        indexed.push(record.id);
      } catch (error: any) {
        errors.push({ id: record.id, error: error.message });
      }
    }
    
    const nextOffset = offset + batchSize;
    const hasMore = nextOffset < total;
    
    return c.json({
      success: true,
      indexed: indexed.length,
      errors: errors.length,
      error_details: errors,
      offset,
      next_offset: hasMore ? nextOffset : null,
      total,
      done: !hasMore,
      progress: `${Math.min(nextOffset, total)}/${total}`,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Vectorize: Get index stats
app.get('/api/vectorize/stats', async (c) => {
  const env = c.env;
  
  try {
    // Get feedback count from D1
    const feedbackCount = await env.DB.prepare('SELECT COUNT(*) as count FROM feedback').first<{ count: number }>();
    
    return c.json({
      success: true,
      index_name: 'signal-embeddings',
      dimensions: 768,
      metric: 'cosine',
      feedback_count: feedbackCount?.count || 0,
      free_tier_limit: {
        dimensions: '30M total',
        max_vectors_approx: 39062, // 30M / 768
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Mount route handlers (with /api prefix)
app.route('/api/chat', chatHandler);
app.route('/api/feedback', feedbackHandler);
app.route('/api/analytics', analyticsHandler);
app.route('/api/search', searchHandler);
app.route('/api/webhooks', webhooksHandler);
app.route('/api/alerts', alertsHandler);

// Mount route handlers (without /api prefix for direct calls)
app.route('/chat', chatHandler);
app.route('/feedback', feedbackHandler);
app.route('/analytics', analyticsHandler);
app.route('/search', searchHandler);
app.route('/webhooks', webhooksHandler);
app.route('/alerts', alertsHandler);

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Not Found',
    path: c.req.path,
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({
    success: false,
    error: err.message || 'Internal Server Error',
  }, 500);
});

// Import scheduled handler for cron triggers
import { handleScheduled } from './handlers/scheduled';

// Export both fetch (HTTP) and scheduled (Cron) handlers
export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
};
