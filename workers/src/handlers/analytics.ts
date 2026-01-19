/**
 * Analytics API Handler
 */

import { Hono } from 'hono';
import { Env } from '../types';
import { getAnalyticsSummary, getProductBreakdown, getSourceBreakdown, listThemes, listAlerts } from '../services/database';

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /api/analytics/summary
 * Get dashboard summary statistics
 */
app.get('/summary', async (c) => {
  const env = c.env;
  const timeRange = c.req.query('time_range') || '7d';
  
  const stats = await getAnalyticsSummary(env, timeRange);
  
  // Calculate changes (would normally compare to previous period)
  const summary = {
    total_feedback: stats.total_feedback,
    total_feedback_change: 12.5, // Placeholder - calculate from previous period
    avg_sentiment: stats.avg_sentiment,
    sentiment_change: 0.08, // Placeholder
    critical_alerts: stats.critical_alerts,
    alerts_change: -2, // Placeholder
    avg_response_time: '4.2h', // Placeholder - would calculate from status timestamps
    response_time_change: -18, // Placeholder
    enterprise_affected: stats.enterprise_affected,
  };
  
  return c.json({ success: true, data: summary });
});

/**
 * GET /api/analytics/themes
 * Get trending themes
 */
app.get('/themes', async (c) => {
  const env = c.env;
  const limit = parseInt(c.req.query('limit') || '10');
  
  const themes = await listThemes(env, limit);
  
  // Transform to API format
  const trendingThemes = themes.map(theme => ({
    id: theme.id,
    theme: theme.theme,
    mentions: theme.mentions,
    change: theme.change_percent,
    change_direction: theme.change_percent > 0 ? 'up' : theme.change_percent < 0 ? 'down' : 'stable',
    sentiment: theme.sentiment,
    products: theme.products,
    is_new: theme.is_new,
    summary: theme.summary,
    suggested_action: theme.suggested_action,
    top_sources: [], // Would need to aggregate from feedback
    affected_customers: [], // Would need to aggregate from feedback
    created_at: theme.created_at,
  }));
  
  return c.json({ success: true, data: trendingThemes });
});

/**
 * GET /api/analytics/products
 * Get product breakdown
 */
app.get('/products', async (c) => {
  const env = c.env;
  const timeRange = c.req.query('time_range') || '7d';
  
  const breakdown = await getProductBreakdown(env, timeRange);
  
  // Calculate percentages
  const total = breakdown.reduce((sum, item) => sum + item.count, 0);
  
  const products = breakdown.map(item => ({
    product: item.product,
    count: item.count,
    percentage: total > 0 ? (item.count / total) * 100 : 0,
    sentiment: item.sentiment,
    top_issue: null, // Would need to aggregate
  }));
  
  return c.json({ success: true, data: products });
});

/**
 * GET /api/analytics/sources
 * Get source breakdown
 */
app.get('/sources', async (c) => {
  const env = c.env;
  const timeRange = c.req.query('time_range') || '7d';
  
  const breakdown = await getSourceBreakdown(env, timeRange);
  
  // Calculate percentages
  const total = breakdown.reduce((sum, item) => sum + item.count, 0);
  
  const sources = breakdown.map(item => ({
    source: item.source,
    count: item.count,
    percentage: total > 0 ? (item.count / total) * 100 : 0,
  }));
  
  return c.json({ success: true, data: sources });
});

/**
 * GET /api/analytics/sentiment
 * Get sentiment breakdown
 */
app.get('/sentiment', async (c) => {
  const env = c.env;
  const timeRange = c.req.query('time_range') || '7d';
  
  // Query sentiment distribution
  const dateFilter = getDateFilter(timeRange);
  
  const result = await env.DB.prepare(`
    SELECT 
      SUM(CASE WHEN sentiment > 0.3 THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN sentiment BETWEEN -0.3 AND 0.3 THEN 1 ELSE 0 END) as neutral,
      SUM(CASE WHEN sentiment < -0.3 THEN 1 ELSE 0 END) as negative,
      COUNT(*) as total
    FROM feedback
    WHERE created_at >= ?
  `).bind(dateFilter).first();
  
  const total = (result as any)?.total || 1;
  
  return c.json({
    success: true,
    data: {
      positive: ((result as any)?.positive || 0) / total,
      neutral: ((result as any)?.neutral || 0) / total,
      negative: ((result as any)?.negative || 0) / total,
    },
  });
});

/**
 * GET /api/alerts
 * Get recent alerts
 */
app.get('/alerts', async (c) => {
  const env = c.env;
  const limit = parseInt(c.req.query('limit') || '10');
  
  const alerts = await listAlerts(env, limit);
  
  return c.json({ success: true, data: alerts });
});

// Helper function
function getDateFilter(timeRange: string): string {
  const now = new Date();
  
  switch (timeRange) {
    case '24h':
      now.setHours(now.getHours() - 24);
      break;
    case '7d':
      now.setDate(now.getDate() - 7);
      break;
    case '30d':
      now.setDate(now.getDate() - 30);
      break;
    case '90d':
      now.setDate(now.getDate() - 90);
      break;
    default:
      now.setDate(now.getDate() - 7);
  }
  
  return now.toISOString();
}

export default app;
