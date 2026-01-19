/**
 * Search API Handler
 * Semantic search using Vectorize
 */

import { Hono } from 'hono';
import { Env } from '../types';
import { semanticSearch, findSimilarFeedback } from '../services/vectorize';
import { getFeedbackById } from '../services/database';

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /api/search
 * Semantic search across feedback
 */
app.post('/', async (c) => {
  const env = c.env;
  const body = await c.req.json<{ query: string; limit?: number; filters?: Record<string, string | number> }>();
  
  if (!body.query) {
    return c.json({ success: false, error: 'query is required' }, 400);
  }
  
  const limit = body.limit || 10;
  
  // Perform semantic search
  const matches = await semanticSearch(env, body.query, limit, body.filters);
  
  // Get full feedback details
  const results = await Promise.all(
    matches.map(async (match) => {
      const feedback = await getFeedbackById(env, match.id);
      return feedback ? {
        ...feedback,
        relevance_score: match.score,
      } : null;
    })
  );
  
  return c.json({
    success: true,
    data: results.filter(Boolean),
    query: body.query,
    total: results.filter(Boolean).length,
  });
});

/**
 * GET /api/search/similar/:id
 * Find similar feedback items
 */
app.get('/similar/:id', async (c) => {
  const env = c.env;
  const id = c.req.param('id');
  const limit = parseInt(c.req.query('limit') || '5');
  
  const feedback = await getFeedbackById(env, id);
  if (!feedback) {
    return c.json({ success: false, error: 'Feedback not found' }, 404);
  }
  
  const matches = await findSimilarFeedback(env, id, feedback.content, limit);
  
  // Get full feedback details
  const results = await Promise.all(
    matches.map(async (match) => {
      const item = await getFeedbackById(env, match.id);
      return item ? {
        ...item,
        similarity_score: match.score,
      } : null;
    })
  );
  
  return c.json({
    success: true,
    data: results.filter(Boolean),
  });
});

/**
 * POST /api/search/aggregate
 * Search and aggregate by field
 */
app.post('/aggregate', async (c) => {
  const env = c.env;
  const body = await c.req.json<{ query: string; group_by: string; limit?: number }>();
  
  if (!body.query || !body.group_by) {
    return c.json({ success: false, error: 'query and group_by are required' }, 400);
  }
  
  const limit = body.limit || 50;
  
  // Search
  const matches = await semanticSearch(env, body.query, limit);
  
  // Get feedback and aggregate
  const aggregation: Record<string, { count: number; avg_sentiment: number; items: any[] }> = {};
  
  for (const match of matches) {
    const feedback = await getFeedbackById(env, match.id);
    if (!feedback) continue;
    
    const groupValue = (feedback as any)[body.group_by] || 'unknown';
    
    if (!aggregation[groupValue]) {
      aggregation[groupValue] = { count: 0, avg_sentiment: 0, items: [] };
    }
    
    aggregation[groupValue].count++;
    aggregation[groupValue].avg_sentiment += feedback.sentiment;
    aggregation[groupValue].items.push({
      id: feedback.id,
      content: feedback.content.substring(0, 100),
      relevance: match.score,
    });
  }
  
  // Calculate averages
  for (const key of Object.keys(aggregation)) {
    aggregation[key].avg_sentiment = aggregation[key].avg_sentiment / aggregation[key].count;
  }
  
  return c.json({
    success: true,
    data: aggregation,
    query: body.query,
    group_by: body.group_by,
  });
});

export default app;
