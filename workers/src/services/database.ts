/**
 * D1 Database Service
 * Handles all database operations
 */

import { Env, Feedback, Customer, Theme, Alert, FeatureRequest, FeedbackFilters, PaginationParams } from '../types';

// ============================================
// Feedback Operations
// ============================================

export async function createFeedback(env: Env, feedback: Omit<Feedback, 'created_at' | 'updated_at'>): Promise<void> {
  const now = new Date().toISOString();
  
  await env.DB.prepare(`
    INSERT INTO feedback (
      id, content, source, sentiment, sentiment_label, urgency, product,
      themes, customer_id, customer_name, customer_tier, customer_arr,
      status, assigned_to, metadata, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    feedback.id,
    feedback.content,
    feedback.source,
    feedback.sentiment,
    feedback.sentiment_label,
    feedback.urgency,
    feedback.product,
    JSON.stringify(feedback.themes),
    feedback.customer_id,
    feedback.customer_name,
    feedback.customer_tier,
    feedback.customer_arr,
    feedback.status,
    feedback.assigned_to,
    JSON.stringify(feedback.metadata),
    now,
    now
  ).run();
}

export async function getFeedbackById(env: Env, id: string): Promise<Feedback | null> {
  const result = await env.DB.prepare(
    'SELECT * FROM feedback WHERE id = ?'
  ).bind(id).first();
  
  if (!result) return null;
  
  return parseFeedbackRow(result);
}

export async function listFeedback(
  env: Env,
  filters: FeedbackFilters = {},
  pagination: PaginationParams = {}
): Promise<{ data: Feedback[]; total: number }> {
  const { page = 1, page_size = 20 } = pagination;
  const offset = (page - 1) * page_size;
  
  // Build WHERE clause
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  
  if (filters.source?.length) {
    conditions.push(`source IN (${filters.source.map(() => '?').join(', ')})`);
    params.push(...filters.source);
  }
  
  if (filters.product?.length) {
    conditions.push(`product IN (${filters.product.map(() => '?').join(', ')})`);
    params.push(...filters.product);
  }
  
  if (filters.status?.length) {
    conditions.push(`status IN (${filters.status.map(() => '?').join(', ')})`);
    params.push(...filters.status);
  }
  
  if (filters.customer_tier?.length) {
    conditions.push(`customer_tier IN (${filters.customer_tier.map(() => '?').join(', ')})`);
    params.push(...filters.customer_tier);
  }
  
  if (filters.urgency_min !== undefined) {
    conditions.push('urgency >= ?');
    params.push(filters.urgency_min);
  }
  
  if (filters.urgency_max !== undefined) {
    conditions.push('urgency <= ?');
    params.push(filters.urgency_max);
  }
  
  if (filters.search) {
    conditions.push('content LIKE ?');
    params.push(`%${filters.search}%`);
  }
  
  if (filters.date_from) {
    conditions.push('created_at >= ?');
    params.push(filters.date_from);
  }
  
  if (filters.date_to) {
    conditions.push('created_at <= ?');
    params.push(filters.date_to);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  // Get total count
  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM feedback ${whereClause}`
  ).bind(...params).first<{ total: number }>();
  
  const total = countResult?.total || 0;
  
  // Get paginated data
  const dataParams = [...params, page_size, offset];
  const results = await env.DB.prepare(
    `SELECT * FROM feedback ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...dataParams).all();
  
  const data = (results.results || []).map(parseFeedbackRow);
  
  return { data, total };
}

export async function updateFeedback(
  env: Env,
  id: string,
  updates: Partial<Feedback>
): Promise<void> {
  const setClauses: string[] = [];
  const params: (string | number | null)[] = [];
  
  if (updates.content !== undefined) {
    setClauses.push('content = ?');
    params.push(updates.content);
  }
  
  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    params.push(updates.status);
  }
  
  if (updates.assigned_to !== undefined) {
    setClauses.push('assigned_to = ?');
    params.push(updates.assigned_to);
  }
  
  if (updates.product !== undefined) {
    setClauses.push('product = ?');
    params.push(updates.product);
  }
  
  if (updates.urgency !== undefined) {
    setClauses.push('urgency = ?');
    params.push(updates.urgency);
  }
  
  if (updates.sentiment !== undefined) {
    setClauses.push('sentiment = ?');
    params.push(updates.sentiment);
  }
  
  if (updates.sentiment_label !== undefined) {
    setClauses.push('sentiment_label = ?');
    params.push(updates.sentiment_label);
  }
  
  if (updates.themes !== undefined) {
    setClauses.push('themes = ?');
    params.push(JSON.stringify(updates.themes));
  }
  
  if (setClauses.length === 0) return;
  
  setClauses.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);
  
  await env.DB.prepare(
    `UPDATE feedback SET ${setClauses.join(', ')} WHERE id = ?`
  ).bind(...params).run();
}

export async function deleteFeedback(env: Env, id: string): Promise<void> {
  await env.DB.prepare('DELETE FROM feedback WHERE id = ?').bind(id).run();
}

// ============================================
// Customer Operations
// ============================================

export async function getCustomerById(env: Env, id: string): Promise<Customer | null> {
  const result = await env.DB.prepare(
    'SELECT * FROM customers WHERE id = ?'
  ).bind(id).first();
  
  if (!result) return null;
  
  return parseCustomerRow(result);
}

export async function listCustomers(
  env: Env,
  tier?: string,
  pagination: PaginationParams = {}
): Promise<{ data: Customer[]; total: number }> {
  const { page = 1, page_size = 20 } = pagination;
  const offset = (page - 1) * page_size;
  
  const whereClause = tier ? 'WHERE tier = ?' : '';
  const params = tier ? [tier] : [];
  
  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM customers ${whereClause}`
  ).bind(...params).first<{ total: number }>();
  
  const total = countResult?.total || 0;
  
  const dataParams = tier ? [tier, page_size, offset] : [page_size, offset];
  const results = await env.DB.prepare(
    `SELECT * FROM customers ${whereClause} ORDER BY arr DESC LIMIT ? OFFSET ?`
  ).bind(...dataParams).all();
  
  const data = (results.results || []).map(parseCustomerRow);
  
  return { data, total };
}

export async function upsertCustomer(env: Env, customer: Customer): Promise<void> {
  const now = new Date().toISOString();
  
  await env.DB.prepare(`
    INSERT INTO customers (id, name, email, tier, arr, products, health_score, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      tier = excluded.tier,
      arr = excluded.arr,
      products = excluded.products,
      health_score = excluded.health_score,
      updated_at = excluded.updated_at
  `).bind(
    customer.id,
    customer.name,
    customer.email,
    customer.tier,
    customer.arr,
    JSON.stringify(customer.products),
    customer.health_score,
    now,
    now
  ).run();
}

// ============================================
// Theme Operations
// ============================================

export async function listThemes(
  env: Env,
  limit: number = 10,
  timeRange?: string
): Promise<Theme[]> {
  // If time range specified, get themes with dynamic mention counts from feedback
  if (timeRange) {
    const dateFilter = getDateFilter(timeRange);
    
    // Get base theme info
    const themes = await env.DB.prepare(
      'SELECT * FROM themes ORDER BY mentions DESC LIMIT ?'
    ).bind(limit).all();
    
    // Get feedback counts for each theme within time range
    const feedbackCounts = await env.DB.prepare(`
      SELECT themes, COUNT(*) as count
      FROM feedback
      WHERE created_at >= ?
      GROUP BY themes
    `).bind(dateFilter).all();
    
    // Build a map of theme -> count from feedback
    const themeCountMap = new Map<string, number>();
    for (const row of (feedbackCounts.results || []) as any[]) {
      try {
        const themeList = JSON.parse(row.themes || '[]');
        for (const theme of themeList) {
          const current = themeCountMap.get(theme.toLowerCase()) || 0;
          themeCountMap.set(theme.toLowerCase(), current + row.count);
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
    
    // Update theme mentions based on feedback in time range
    return (themes.results || []).map((row: any) => {
      const theme = parseThemeRow(row);
      // Scale mentions based on time range (simulate dynamic data)
      const baseKeyword = theme.theme.toLowerCase().split(' ')[0];
      const feedbackMentions = themeCountMap.get(baseKeyword) || 0;
      
      // Adjust mentions based on time range
      let multiplier = 1;
      switch (timeRange) {
        case '24h': multiplier = 0.11; break;  // ~1/9 of weekly
        case '7d': multiplier = 1; break;
        case '30d': multiplier = 4.3; break;   // ~4.3x weekly
        case '90d': multiplier = 13; break;    // ~13x weekly
      }
      
      return {
        ...theme,
        mentions: Math.round(theme.mentions * multiplier) + feedbackMentions,
      };
    }).sort((a, b) => b.mentions - a.mentions);
  }
  
  const results = await env.DB.prepare(
    'SELECT * FROM themes ORDER BY mentions DESC LIMIT ?'
  ).bind(limit).all();
  
  return (results.results || []).map(parseThemeRow);
}

export async function upsertTheme(env: Env, theme: Theme): Promise<void> {
  const now = new Date().toISOString();
  
  await env.DB.prepare(`
    INSERT INTO themes (id, theme, mentions, change_percent, sentiment, products, is_new, summary, suggested_action, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      mentions = excluded.mentions,
      change_percent = excluded.change_percent,
      sentiment = excluded.sentiment,
      products = excluded.products,
      is_new = excluded.is_new,
      summary = excluded.summary,
      suggested_action = excluded.suggested_action,
      updated_at = excluded.updated_at
  `).bind(
    theme.id,
    theme.theme,
    theme.mentions,
    theme.change_percent,
    theme.sentiment,
    JSON.stringify(theme.products),
    theme.is_new ? 1 : 0,
    theme.summary,
    theme.suggested_action,
    now,
    now
  ).run();
}

// ============================================
// Alert Operations
// ============================================

export async function createAlert(env: Env, alert: Omit<Alert, 'created_at'>): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO alerts (id, type, message, product, acknowledged, feedback_ids, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    alert.id,
    alert.type,
    alert.message,
    alert.product,
    alert.acknowledged ? 1 : 0,
    JSON.stringify(alert.feedback_ids),
    new Date().toISOString()
  ).run();
}

export async function listAlerts(
  env: Env,
  limit: number = 10,
  acknowledgedOnly: boolean = false
): Promise<Alert[]> {
  const whereClause = acknowledgedOnly ? '' : 'WHERE acknowledged = 0';
  
  const results = await env.DB.prepare(
    `SELECT * FROM alerts ${whereClause} ORDER BY created_at DESC LIMIT ?`
  ).bind(limit).all();
  
  return (results.results || []).map(parseAlertRow);
}

export async function acknowledgeAlert(env: Env, id: string): Promise<void> {
  await env.DB.prepare(
    'UPDATE alerts SET acknowledged = 1 WHERE id = ?'
  ).bind(id).run();
}

// ============================================
// Analytics Queries
// ============================================

export async function getAnalyticsSummary(env: Env, timeRange: string, product?: string, source?: string): Promise<{
  total_feedback: number;
  avg_sentiment: number;
  critical_alerts: number;
  enterprise_affected: number;
}> {
  const dateFilter = getDateFilter(timeRange);
  
  let feedbackQuery = `
    SELECT 
      COUNT(*) as total,
      AVG(sentiment) as avg_sentiment,
      COUNT(DISTINCT CASE WHEN customer_tier = 'enterprise' THEN customer_id END) as enterprise_affected
    FROM feedback
    WHERE created_at >= ?
  `;
  const feedbackParams: (string | number)[] = [dateFilter];
  
  if (product && product !== 'all') {
    feedbackQuery += ` AND product = ?`;
    feedbackParams.push(product);
  }
  
  if (source && source !== 'all') {
    feedbackQuery += ` AND source = ?`;
    feedbackParams.push(source);
  }
  
  const feedbackStats = await env.DB.prepare(feedbackQuery).bind(...feedbackParams).first();
  
  let alertQuery = `
    SELECT COUNT(*) as count FROM alerts 
    WHERE type = 'critical' AND acknowledged = 0 AND created_at >= ?
  `;
  const alertParams: (string | number)[] = [dateFilter];
  
  if (product && product !== 'all') {
    alertQuery += ` AND product = ?`;
    alertParams.push(product);
  }
  
  const alertCount = await env.DB.prepare(alertQuery).bind(...alertParams).first<{ count: number }>();
  
  return {
    total_feedback: (feedbackStats as any)?.total || 0,
    avg_sentiment: (feedbackStats as any)?.avg_sentiment || 0,
    critical_alerts: alertCount?.count || 0,
    enterprise_affected: (feedbackStats as any)?.enterprise_affected || 0,
  };
}

export async function getProductBreakdown(env: Env, timeRange: string): Promise<Array<{
  product: string;
  count: number;
  sentiment: number;
}>> {
  const dateFilter = getDateFilter(timeRange);
  
  const results = await env.DB.prepare(`
    SELECT 
      product,
      COUNT(*) as count,
      AVG(sentiment) as sentiment
    FROM feedback
    WHERE created_at >= ? AND product IS NOT NULL
    GROUP BY product
    ORDER BY count DESC
  `).bind(dateFilter).all();
  
  return (results.results || []).map((row: any) => ({
    product: row.product,
    count: row.count,
    sentiment: row.sentiment,
  }));
}

export async function getSourceBreakdown(env: Env, timeRange: string, product?: string): Promise<Array<{
  source: string;
  count: number;
}>> {
  const dateFilter = getDateFilter(timeRange);
  
  let query = `
    SELECT source, COUNT(*) as count
    FROM feedback
    WHERE created_at >= ?
  `;
  const params: (string | number)[] = [dateFilter];
  
  if (product && product !== 'all') {
    query += ` AND product = ?`;
    params.push(product);
  }
  
  query += ` GROUP BY source ORDER BY count DESC`;
  
  const results = await env.DB.prepare(query).bind(...params).all();
  
  return (results.results || []).map((row: any) => ({
    source: row.source,
    count: row.count,
  }));
}

// ============================================
// Helper Functions
// ============================================

function parseFeedbackRow(row: any): Feedback {
  return {
    ...row,
    themes: JSON.parse(row.themes || '[]'),
    metadata: JSON.parse(row.metadata || '{}'),
  };
}

function parseCustomerRow(row: any): Customer {
  return {
    ...row,
    products: JSON.parse(row.products || '[]'),
  };
}

function parseThemeRow(row: any): Theme {
  return {
    ...row,
    products: JSON.parse(row.products || '[]'),
    is_new: Boolean(row.is_new),
  };
}

function parseAlertRow(row: any): Alert {
  return {
    ...row,
    acknowledged: Boolean(row.acknowledged),
    feedback_ids: JSON.parse(row.feedback_ids || '[]'),
  };
}

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
