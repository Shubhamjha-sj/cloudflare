/**
 * Scheduled Handler - Cron Trigger for hourly data ingestion
 * Generates realistic feedback data every hour
 */

import { Env } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Products (Cloudflare products)
const PRODUCTS = ['workers', 'r2', 'pages', 'd1', 'kv', 'durable-objects', 'queues', 'images'];

// Sources
const SOURCES = ['github', 'discord', 'twitter', 'support', 'forum', 'email'];

// Customers
const CUSTOMERS = [
  { id: 'cust_001', name: 'TechCorp Inc', tier: 'enterprise', arr: 250000 },
  { id: 'cust_002', name: 'StartupXYZ', tier: 'pro', arr: 12000 },
  { id: 'cust_003', name: 'GlobalMedia Ltd', tier: 'enterprise', arr: 180000 },
  { id: 'cust_004', name: 'DevStudio', tier: 'pro', arr: 24000 },
  { id: 'cust_005', name: 'CloudFirst', tier: 'enterprise', arr: 320000 },
  { id: 'cust_006', name: 'IndieDev', tier: 'free', arr: 0 },
  { id: 'cust_007', name: 'DataFlow Systems', tier: 'enterprise', arr: 150000 },
  { id: 'cust_008', name: 'WebAgency Pro', tier: 'pro', arr: 36000 },
  { id: 'cust_009', name: 'OpenSource Collective', tier: 'free', arr: 0 },
  { id: 'cust_010', name: 'FinTech Solutions', tier: 'enterprise', arr: 420000 },
];

// Feedback templates by category
const FEEDBACK_TEMPLATES: Record<string, { themes: string[]; sentiment: [number, number]; urgency: [number, number]; templates: string[] }> = {
  performance: {
    themes: ['performance', 'reliability'],
    sentiment: [-0.8, -0.3],
    urgency: [6, 9],
    templates: [
      "Workers cold starts are causing timeouts in our {product} app. Seeing {ms}ms+ delays.",
      "Cold start latency is affecting user experience. First request takes {ms}ms.",
      "Performance degradation noticed in {product} after recent update.",
      "Response times for {product} are inconsistent. Sometimes fast, sometimes {ms}ms.",
      "Our {product} deployment is experiencing slowdowns during peak traffic.",
    ],
  },
  bugs: {
    themes: ['bug', 'documentation'],
    sentiment: [-0.7, -0.2],
    urgency: [5, 8],
    templates: [
      "Getting CORS errors when accessing {product} from our frontend.",
      "Unexpected 500 errors from {product} API intermittently.",
      "{product} configuration not working as documented.",
      "Build failures on {product} with no clear error message.",
      "Wrangler crashes when deploying to {product}.",
    ],
  },
  pricing: {
    themes: ['pricing', 'documentation'],
    sentiment: [-0.5, 0.0],
    urgency: [3, 6],
    templates: [
      "The pricing model for {product} is confusing. Need clarity on costs.",
      "Unexpected charges on our {product} bill this month.",
      "Is there a way to set spending limits for {product}?",
      "Need better cost visibility for {product} usage.",
      "The {product} free tier limits are unclear.",
    ],
  },
  positive: {
    themes: ['performance', 'developer-experience'],
    sentiment: [0.6, 1.0],
    urgency: [1, 3],
    templates: [
      "Just migrated to {product} and the performance is incredible!",
      "Love how fast {product} is! Our latency dropped significantly.",
      "{product} has been rock solid. Zero downtime in months.",
      "The developer experience with {product} is amazing.",
      "Successfully integrated {product} - works perfectly!",
    ],
  },
  feature_request: {
    themes: ['feature-request', 'developer-experience'],
    sentiment: [0.0, 0.4],
    urgency: [3, 6],
    templates: [
      "Would love to see better monitoring added to {product}.",
      "Feature request: {product} needs better TypeScript support.",
      "Any plans to add webhooks to {product}?",
      "Suggesting improved logging for {product}.",
      "Is there a roadmap for {product} features?",
    ],
  },
};

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function getSentimentLabel(sentiment: number): string {
  if (sentiment >= 0.3) return 'positive';
  if (sentiment >= -0.1) return 'neutral';
  if (sentiment >= -0.3) return 'concerned';
  if (sentiment >= -0.5) return 'annoyed';
  return 'frustrated';
}

function generateFeedback(): {
  id: string;
  content: string;
  source: string;
  sentiment: number;
  sentiment_label: string;
  urgency: number;
  product: string;
  themes: string[];
  customer_id: string;
  customer_name: string;
  customer_tier: string;
  customer_arr: number;
  status: string;
} {
  const category = randomChoice(Object.keys(FEEDBACK_TEMPLATES));
  const template = FEEDBACK_TEMPLATES[category];
  const product = randomChoice(PRODUCTS);
  const customer = randomChoice(CUSTOMERS);
  
  // Generate content from template
  let content = randomChoice(template.templates)
    .replace('{product}', product)
    .replace('{ms}', String(Math.floor(Math.random() * 1000 + 300)));
  
  const sentiment = randomRange(template.sentiment[0], template.sentiment[1]);
  const urgency = Math.floor(randomRange(template.urgency[0], template.urgency[1]));
  
  return {
    id: `fb_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
    content,
    source: randomChoice(SOURCES),
    sentiment: Math.round(sentiment * 1000) / 1000,
    sentiment_label: getSentimentLabel(sentiment),
    urgency,
    product,
    themes: template.themes,
    customer_id: customer.id,
    customer_name: customer.name,
    customer_tier: customer.tier,
    customer_arr: customer.arr,
    status: randomChoice(['new', 'in_review', 'acknowledged']),
  };
}

export async function handleScheduled(env: Env, controller: ScheduledController): Promise<void> {
  console.log(`[Cron] Running scheduled data ingestion at ${new Date().toISOString()}`);
  
  // Generate 5-15 new feedback items per hour
  const count = Math.floor(Math.random() * 11) + 5;
  const now = new Date().toISOString();
  
  console.log(`[Cron] Generating ${count} new feedback items...`);
  
  let successCount = 0;
  let errorCount = 0;
  let vectorizedCount = 0;
  
  for (let i = 0; i < count; i++) {
    const feedback = generateFeedback();
    
    try {
      // Insert into D1
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
        null,
        '{}',
        now,
        now
      ).run();
      
      successCount++;
      
      // Index in Vectorize for semantic search
      try {
        const embeddingResponse = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
          text: feedback.content,
        });
        
        const vector = embeddingResponse.data[0];
        
        await env.VECTORIZE.insert([{
          id: feedback.id,
          values: vector,
          metadata: {
            source: feedback.source,
            product: feedback.product,
            sentiment: feedback.sentiment,
            urgency: feedback.urgency,
            customer_tier: feedback.customer_tier,
            created_at: now,
          },
        }]);
        
        vectorizedCount++;
      } catch (vectorError: any) {
        console.error(`[Cron] Failed to vectorize ${feedback.id}: ${vectorError.message}`);
      }
      
      console.log(`[Cron] Created feedback ${feedback.id}: "${feedback.content.slice(0, 50)}..."`);
    } catch (error: any) {
      errorCount++;
      console.error(`[Cron] Error creating feedback: ${error.message}`);
    }
  }
  
  console.log(`[Cron] Completed: ${successCount} created, ${vectorizedCount} vectorized, ${errorCount} errors`);
}
