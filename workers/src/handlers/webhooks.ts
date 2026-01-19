/**
 * Webhooks Handler
 * Process incoming webhooks from GitHub, Discord, Zendesk, etc.
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { Env, GitHubWebhookPayload, DiscordWebhookPayload } from '../types';
import { queueFeedbackProcessing } from '../services/queue';

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /webhooks/github
 * Process GitHub issue and comment webhooks
 */
app.post('/github', async (c) => {
  const env = c.env;
  const event = c.req.header('X-GitHub-Event');
  const body = await c.req.json<GitHubWebhookPayload>();
  
  // Handle issue events
  if (event === 'issues' && body.issue) {
    const { action, issue, repository } = body;
    
    // Only process opened and edited issues
    if (action !== 'opened' && action !== 'edited') {
      return c.json({ status: 'ignored', reason: `Action ${action} not processed` });
    }
    
    const content = `[${repository.full_name}#${issue.number}] ${issue.title}\n\n${issue.body || ''}`;
    
    // Detect product from labels
    const product = detectProductFromLabels(issue.labels.map(l => l.name));
    
    await queueFeedbackProcessing(env, {
      feedback_id: uuidv4(),
      content,
      source: 'github',
      product,
      customer_name: issue.user.login,
      customer_tier: undefined,
      customer_arr: undefined,
    });
    
    return c.json({ status: 'queued', issue_number: issue.number });
  }
  
  // Handle issue comment events
  if (event === 'issue_comment' && body.comment && body.issue) {
    const { action, comment, issue, repository } = body;
    
    if (action !== 'created') {
      return c.json({ status: 'ignored', reason: `Action ${action} not processed` });
    }
    
    const content = `[${repository.full_name}#${issue.number}] Comment by ${comment.user.login}:\n\n${comment.body}`;
    
    const product = detectProductFromLabels(issue.labels?.map(l => l.name) || []);
    
    await queueFeedbackProcessing(env, {
      feedback_id: uuidv4(),
      content,
      source: 'github',
      product,
      customer_name: comment.user.login,
      customer_tier: undefined,
      customer_arr: undefined,
    });
    
    return c.json({ status: 'queued', comment_user: comment.user.login });
  }
  
  return c.json({ status: 'ignored', reason: `Event ${event} not handled` });
});

/**
 * POST /webhooks/discord
 * Process Discord message webhooks
 */
app.post('/discord', async (c) => {
  const env = c.env;
  const body = await c.req.json<DiscordWebhookPayload>();
  
  // Skip bot messages
  if (!body.content || !body.author) {
    return c.json({ status: 'ignored', reason: 'Empty message or no author' });
  }
  
  // Detect product from channel or message content
  const product = detectProductFromContent(body.content);
  
  await queueFeedbackProcessing(env, {
    feedback_id: uuidv4(),
    content: body.content,
    source: 'discord',
    product,
    customer_name: body.author.username,
    customer_tier: undefined,
    customer_arr: undefined,
  });
  
  return c.json({ status: 'queued', author: body.author.username });
});

/**
 * POST /webhooks/zendesk
 * Process Zendesk ticket webhooks
 */
app.post('/zendesk', async (c) => {
  const env = c.env;
  const body = await c.req.json<{
    ticket_id: string;
    subject: string;
    description: string;
    requester: { name: string; email: string };
    priority?: string;
    tags?: string[];
    custom_fields?: Record<string, string>;
  }>();
  
  const content = `[Ticket #${body.ticket_id}] ${body.subject}\n\n${body.description}`;
  
  // Detect product from tags
  const product = detectProductFromLabels(body.tags || []);
  
  // Try to get customer tier from custom fields
  const customerTier = body.custom_fields?.tier as any;
  const customerArr = body.custom_fields?.arr ? parseInt(body.custom_fields.arr) : undefined;
  
  await queueFeedbackProcessing(env, {
    feedback_id: uuidv4(),
    content,
    source: 'support',
    product,
    customer_name: body.requester.name,
    customer_tier: customerTier,
    customer_arr: customerArr,
  });
  
  return c.json({ status: 'queued', ticket_id: body.ticket_id });
});

/**
 * POST /webhooks/email
 * Process email forwarding webhooks
 */
app.post('/email', async (c) => {
  const env = c.env;
  const body = await c.req.json<{
    from: string;
    from_name?: string;
    subject: string;
    body_plain: string;
    body_html?: string;
  }>();
  
  const content = `[Email] ${body.subject}\n\nFrom: ${body.from_name || body.from}\n\n${body.body_plain}`;
  
  const product = detectProductFromContent(content);
  
  await queueFeedbackProcessing(env, {
    feedback_id: uuidv4(),
    content,
    source: 'email',
    product,
    customer_name: body.from_name || body.from,
    customer_tier: undefined,
    customer_arr: undefined,
  });
  
  return c.json({ status: 'queued', from: body.from });
});

/**
 * POST /webhooks/twitter
 * Process Twitter/X mention webhooks
 */
app.post('/twitter', async (c) => {
  const env = c.env;
  const body = await c.req.json<{
    tweet_id: string;
    text: string;
    author: { id: string; username: string; name: string };
    created_at: string;
  }>();
  
  const product = detectProductFromContent(body.text);
  
  await queueFeedbackProcessing(env, {
    feedback_id: uuidv4(),
    content: body.text,
    source: 'twitter',
    product,
    customer_name: `@${body.author.username}`,
    customer_tier: undefined,
    customer_arr: undefined,
  });
  
  return c.json({ status: 'queued', tweet_id: body.tweet_id });
});

/**
 * POST /webhooks/forum
 * Process community forum webhooks
 */
app.post('/forum', async (c) => {
  const env = c.env;
  const body = await c.req.json<{
    post_id: string;
    topic: string;
    content: string;
    author: { username: string };
    category?: string;
  }>();
  
  const fullContent = `[${body.category || 'Forum'}] ${body.topic}\n\n${body.content}`;
  
  const product = detectProductFromContent(fullContent) || 
    detectProductFromLabels([body.category || '']);
  
  await queueFeedbackProcessing(env, {
    feedback_id: uuidv4(),
    content: fullContent,
    source: 'forum',
    product,
    customer_name: body.author.username,
    customer_tier: undefined,
    customer_arr: undefined,
  });
  
  return c.json({ status: 'queued', post_id: body.post_id });
});

// ============================================
// Helper Functions
// ============================================

const PRODUCT_KEYWORDS: Record<string, string[]> = {
  'Workers': ['workers', 'worker', 'wrangler', 'edge function'],
  'R2': ['r2', 'r2 storage', 'object storage', 's3 compatible'],
  'Pages': ['pages', 'cloudflare pages', 'static site'],
  'D1': ['d1', 'd1 database', 'sqlite'],
  'KV': ['kv', 'workers kv', 'key-value', 'key value'],
  'Durable Objects': ['durable objects', 'durable object', 'do'],
  'Workers AI': ['workers ai', 'ai gateway', 'ai inference', 'llama', 'inference'],
  'Vectorize': ['vectorize', 'vector database', 'embeddings'],
  'Queues': ['queues', 'queue', 'message queue'],
  'Turnstile': ['turnstile', 'captcha', 'bot protection'],
  'WAF': ['waf', 'firewall', 'web application firewall'],
  'CDN': ['cdn', 'cache', 'caching', 'edge cache'],
  'DNS': ['dns', 'nameserver', '1.1.1.1'],
  'Access': ['access', 'zero trust', 'ztna'],
  'Tunnel': ['tunnel', 'argo tunnel', 'cloudflared'],
  'Stream': ['stream', 'video', 'live streaming'],
  'Images': ['images', 'image optimization', 'image resize'],
};

function detectProductFromLabels(labels: string[]): string | undefined {
  const labelsLower = labels.map(l => l.toLowerCase());
  
  for (const [product, keywords] of Object.entries(PRODUCT_KEYWORDS)) {
    if (keywords.some(kw => labelsLower.some(l => l.includes(kw)))) {
      return product;
    }
  }
  
  return undefined;
}

function detectProductFromContent(content: string): string | undefined {
  const contentLower = content.toLowerCase();
  
  for (const [product, keywords] of Object.entries(PRODUCT_KEYWORDS)) {
    if (keywords.some(kw => contentLower.includes(kw))) {
      return product;
    }
  }
  
  return undefined;
}

export default app;
