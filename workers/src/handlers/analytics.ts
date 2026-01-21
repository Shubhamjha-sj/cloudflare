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
  const product = c.req.query('product');
  const source = c.req.query('source');
  
  const stats = await getAnalyticsSummary(env, timeRange, product, source);
  
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
 * Get trending themes - dynamically extracted from feedback
 */
app.get('/themes', async (c) => {
  const env = c.env;
  const limit = parseInt(c.req.query('limit') || '10');
  const timeRange = c.req.query('time_range') || '7d';
  const product = c.req.query('product');
  const source = c.req.query('source');
  
  // Calculate date filter
  const now = new Date();
  let dateFilter: string;
  switch (timeRange) {
    case '24h':
      now.setHours(now.getHours() - 24);
      dateFilter = now.toISOString();
      break;
    case '7d':
      now.setDate(now.getDate() - 7);
      dateFilter = now.toISOString();
      break;
    case '30d':
      now.setDate(now.getDate() - 30);
      dateFilter = now.toISOString();
      break;
    case '90d':
      now.setDate(now.getDate() - 90);
      dateFilter = now.toISOString();
      break;
    default:
      now.setDate(now.getDate() - 7);
      dateFilter = now.toISOString();
  }
  
  // Build query to get themes from feedback
  let query = `
    SELECT themes, product, sentiment_label, COUNT(*) as count
    FROM feedback
    WHERE created_at >= ?
  `;
  const params: (string | number)[] = [dateFilter];
  
  if (product && product !== 'all') {
    query += ` AND product = ?`;
    params.push(product);
  }
  
  if (source && source !== 'all') {
    query += ` AND source = ?`;
    params.push(source);
  }
  
  query += ` GROUP BY themes, product, sentiment_label`;
  
  const feedbackCounts = await env.DB.prepare(query).bind(...params).all();
  
  // Aggregate themes from feedback
  const themeStats = new Map<string, { 
    count: number; 
    products: Set<string>; 
    sentiments: Map<string, number>;
  }>();
  
  for (const row of (feedbackCounts.results || []) as any[]) {
    try {
      const themeList = JSON.parse(row.themes || '[]');
      for (const theme of themeList) {
        const themeLower = theme.toLowerCase().trim();
        if (!themeLower) continue;
        
        const existing = themeStats.get(themeLower) || { 
          count: 0, 
          products: new Set(), 
          sentiments: new Map() 
        };
        existing.count += row.count;
        existing.products.add(row.product);
        const sentCount = existing.sentiments.get(row.sentiment_label) || 0;
        existing.sentiments.set(row.sentiment_label, sentCount + row.count);
        themeStats.set(themeLower, existing);
      }
    } catch (e) {
      // Skip invalid JSON
    }
  }
  
  // Convert to array and sort by count
  const sortedThemes = Array.from(themeStats.entries())
    .map(([theme, stats]) => {
      // Get dominant sentiment
      let dominantSentiment = 'neutral';
      let maxSentimentCount = 0;
      stats.sentiments.forEach((count, sentiment) => {
        if (count > maxSentimentCount) {
          maxSentimentCount = count;
          dominantSentiment = sentiment;
        }
      });
      
      return {
        id: `theme_${theme.replace(/[^a-z0-9]/g, '_')}`,
        theme: theme.charAt(0).toUpperCase() + theme.slice(1),
        mentions: stats.count,
        change: Math.floor(Math.random() * 40) - 10, // Simulated change
        change_direction: 'up',
        sentiment: dominantSentiment,
        products: Array.from(stats.products),
        is_new: stats.count < 50,
        summary: `${stats.count} mentions across ${stats.products.size} product(s)`,
        suggested_action: null,
        top_sources: [],
        affected_customers: [],
        created_at: new Date().toISOString(),
        top_issues: [] as Array<{ id: string; content: string; product: string; sentiment_label: string; customer_name: string | null }>,
      };
    })
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, limit);
  
  // Fetch top 5 representative issues for each theme
  for (const theme of sortedThemes) {
    const themeName = theme.theme.toLowerCase();
    
    let issuesQuery = `
      SELECT id, content, product, sentiment_label, customer_name
      FROM feedback
      WHERE created_at >= ?
        AND themes LIKE ?
    `;
    const issuesParams: (string | number)[] = [dateFilter, `%${themeName}%`];
    
    if (product && product !== 'all') {
      issuesQuery += ` AND product = ?`;
      issuesParams.push(product);
    }
    
    if (source && source !== 'all') {
      issuesQuery += ` AND source = ?`;
      issuesParams.push(source);
    }
    
    issuesQuery += ` ORDER BY urgency DESC, created_at DESC LIMIT 5`;
    
    const issuesResult = await env.DB.prepare(issuesQuery).bind(...issuesParams).all();
    
    theme.top_issues = (issuesResult.results || []).map((row: any) => ({
      id: row.id,
      content: row.content,
      product: row.product,
      sentiment_label: row.sentiment_label,
      customer_name: row.customer_name,
    }));
  }
  
  return c.json({ success: true, data: sortedThemes });
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
  const product = c.req.query('product');
  
  const breakdown = await getSourceBreakdown(env, timeRange, product);
  
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

/**
 * POST /api/analytics/report
 * Generate an AI-powered report summary
 */
app.post('/report', async (c) => {
  const env = c.env;
  const body = await c.req.json<{ reportType: string; timeRange?: string; product?: string }>();
  const { reportType, timeRange = '7d', product } = body;
  
  const dateFilter = getDateFilter(timeRange);
  
  try {
    let reportData: any = {};
    let prompt = '';
    
    if (reportType === 'weekly-digest') {
      // Get summary stats
      const stats = await getAnalyticsSummary(env, timeRange, product);
      
      // Get top themes
      const themesQuery = `
        SELECT themes, COUNT(*) as count 
        FROM feedback 
        WHERE created_at >= ? 
        GROUP BY themes 
        ORDER BY count DESC 
        LIMIT 5
      `;
      const themesResult = await env.DB.prepare(themesQuery).bind(dateFilter).all();
      
      // Get recent critical feedback
      const criticalQuery = `
        SELECT content, product, sentiment_label, urgency 
        FROM feedback 
        WHERE created_at >= ? AND urgency >= 7 
        ORDER BY urgency DESC, created_at DESC 
        LIMIT 5
      `;
      const criticalResult = await env.DB.prepare(criticalQuery).bind(dateFilter).all();
      
      reportData = { stats, themes: themesResult.results, critical: criticalResult.results };
      
      prompt = `You are Cerebro, a customer feedback intelligence system. Generate a concise Weekly Digest report based on this data:

**Summary Stats:**
- Total Feedback: ${stats.total_feedback}
- Average Sentiment: ${stats.avg_sentiment.toFixed(2)} (scale -1 to 1)
- Critical Alerts: ${stats.critical_alerts}
- Enterprise Customers Affected: ${stats.enterprise_affected}

**Top Themes:**
${themesResult.results?.map((t: any) => `- ${t.themes}: ${t.count} mentions`).join('\n') || 'No themes found'}

**Critical Issues (Urgency 7+):**
${criticalResult.results?.map((f: any) => `- [${f.product}] ${f.content.slice(0, 100)}...`).join('\n') || 'No critical issues'}

Write a professional 3-4 paragraph executive summary highlighting:
1. Key metrics and trends
2. Top concerns requiring attention  
3. Recommended actions
Keep it under 300 words.`;

    } else if (reportType === 'product-health') {
      // Get per-product breakdown
      const productQuery = `
        SELECT 
          product,
          COUNT(*) as feedback_count,
          AVG(sentiment) as avg_sentiment,
          SUM(CASE WHEN urgency >= 7 THEN 1 ELSE 0 END) as critical_count,
          SUM(CASE WHEN sentiment_label = 'positive' THEN 1 ELSE 0 END) as positive_count,
          SUM(CASE WHEN sentiment_label = 'frustrated' THEN 1 ELSE 0 END) as frustrated_count
        FROM feedback
        WHERE created_at >= ?
        ${product && product !== 'all' ? 'AND product = ?' : ''}
        GROUP BY product
        ORDER BY feedback_count DESC
      `;
      const params = product && product !== 'all' ? [dateFilter, product] : [dateFilter];
      const productResult = await env.DB.prepare(productQuery).bind(...params).all();
      
      reportData = { products: productResult.results };
      
      const productBreakdown = productResult.results?.map((p: any) => 
        `- **${p.product}**: ${p.feedback_count} feedback, sentiment ${p.avg_sentiment?.toFixed(2) || 'N/A'}, ${p.critical_count} critical, ${p.positive_count} positive, ${p.frustrated_count} frustrated`
      ).join('\n') || 'No product data';
      
      prompt = `You are Cerebro, a customer feedback intelligence system. Generate a Product Health Report based on this data:

**Product Breakdown (${timeRange} period):**
${productBreakdown}

Write a professional 3-4 paragraph analysis covering:
1. Which products are performing well (positive sentiment)
2. Which products need attention (high critical issues or frustrated feedback)
3. Specific recommendations per product
Keep it under 300 words.`;

    } else if (reportType === 'customer-insights') {
      // Get per-tier breakdown  
      const tierQuery = `
        SELECT 
          customer_tier,
          COUNT(*) as feedback_count,
          AVG(sentiment) as avg_sentiment,
          SUM(CASE WHEN urgency >= 7 THEN 1 ELSE 0 END) as critical_count,
          COUNT(DISTINCT customer_id) as unique_customers
        FROM feedback
        WHERE created_at >= ?
        GROUP BY customer_tier
        ORDER BY 
          CASE customer_tier 
            WHEN 'enterprise' THEN 1 
            WHEN 'pro' THEN 2 
            WHEN 'free' THEN 3 
            ELSE 4 
          END
      `;
      const tierResult = await env.DB.prepare(tierQuery).bind(dateFilter).all();
      
      // Get top enterprise issues
      const enterpriseQuery = `
        SELECT content, product, urgency 
        FROM feedback 
        WHERE created_at >= ? AND customer_tier = 'enterprise' AND urgency >= 5
        ORDER BY urgency DESC 
        LIMIT 5
      `;
      const enterpriseResult = await env.DB.prepare(enterpriseQuery).bind(dateFilter).all();
      
      reportData = { tiers: tierResult.results, enterpriseIssues: enterpriseResult.results };
      
      const tierBreakdown = tierResult.results?.map((t: any) => 
        `- **${t.customer_tier || 'unknown'}**: ${t.feedback_count} feedback from ${t.unique_customers} customers, sentiment ${t.avg_sentiment?.toFixed(2) || 'N/A'}, ${t.critical_count} critical`
      ).join('\n') || 'No tier data';
      
      const enterpriseIssues = enterpriseResult.results?.map((e: any) => 
        `- [${e.product}] ${e.content.slice(0, 80)}...`
      ).join('\n') || 'No enterprise issues';
      
      prompt = `You are Cerebro, a customer feedback intelligence system. Generate a Customer Insights Report based on this data:

**Feedback by Customer Tier (${timeRange} period):**
${tierBreakdown}

**Top Enterprise Customer Issues:**
${enterpriseIssues}

Write a professional 3-4 paragraph analysis covering:
1. How different customer tiers are experiencing the products
2. Priority issues for enterprise customers (highest value)
3. Recommendations for improving customer satisfaction by tier
Keep it under 300 words.`;

    } else {
      return c.json({ success: false, error: 'Invalid report type' }, 400);
    }
    
    // Generate AI summary
    const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: 'You are Cerebro, a professional customer feedback intelligence assistant. Generate clear, actionable reports.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
    });
    
    const summary = (aiResponse as any).response || 'Unable to generate summary';
    
    return c.json({
      success: true,
      data: {
        reportType,
        timeRange,
        generatedAt: new Date().toISOString(),
        summary,
        rawData: reportData
      }
    });
    
  } catch (error: any) {
    console.error('Report generation error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default app;
