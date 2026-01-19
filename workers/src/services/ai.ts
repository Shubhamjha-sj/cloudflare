/**
 * Workers AI Service
 * Handles sentiment analysis, text generation, embeddings, and classification
 */

import { Env, SentimentResult, SentimentLabel } from '../types';

// Model identifiers
const MODELS = {
  EMBEDDING: '@cf/baai/bge-base-en-v1.5',
  SENTIMENT: '@cf/huggingface/distilbert-sst-2-int8',
  TEXT_GENERATION: '@cf/meta/llama-3.1-8b-instruct',
  SUMMARIZATION: '@cf/facebook/bart-large-cnn',
};

/**
 * Generate embedding vector for text
 */
export async function generateEmbedding(env: Env, text: string): Promise<number[]> {
  const response = await env.AI.run(MODELS.EMBEDDING, {
    text: text,
  });
  
  return response.data[0];
}

/**
 * Generate embeddings for multiple texts
 */
export async function generateEmbeddings(env: Env, texts: string[]): Promise<number[][]> {
  const response = await env.AI.run(MODELS.EMBEDDING, {
    text: texts,
  });
  
  return response.data;
}

/**
 * Analyze sentiment of text
 */
export async function analyzeSentiment(env: Env, text: string): Promise<SentimentResult> {
  const response = await env.AI.run(MODELS.SENTIMENT, {
    text: text,
  });
  
  // Response is array of { label: string, score: number }
  const scores = response[0] as Array<{ label: string; score: number }>;
  
  const positiveScore = scores.find(s => s.label === 'POSITIVE')?.score || 0;
  const negativeScore = scores.find(s => s.label === 'NEGATIVE')?.score || 0;
  
  // Calculate normalized sentiment score (-1 to 1)
  const sentimentScore = positiveScore - negativeScore;
  
  // Determine label based on score and content analysis
  let label: SentimentLabel;
  if (sentimentScore > 0.3) {
    label = 'positive';
  } else if (sentimentScore < -0.5) {
    label = 'frustrated';
  } else if (sentimentScore < -0.3) {
    label = 'concerned';
  } else if (sentimentScore < -0.1) {
    label = 'annoyed';
  } else if (sentimentScore < 0.1) {
    label = 'neutral';
  } else {
    label = 'positive';
  }
  
  return {
    score: sentimentScore,
    label,
  };
}

/**
 * Generate text using LLM
 */
export async function generateText(
  env: Env,
  prompt: string,
  systemPrompt?: string,
  maxTokens: number = 1000
): Promise<string> {
  const messages: Array<{ role: string; content: string }> = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  messages.push({ role: 'user', content: prompt });
  
  const response = await env.AI.run(MODELS.TEXT_GENERATION, {
    messages,
    max_tokens: maxTokens,
    temperature: 0.7,
  });
  
  return response.response;
}

/**
 * Classify themes from feedback text
 */
export async function classifyThemes(env: Env, text: string): Promise<string[]> {
  const systemPrompt = `You are a feedback classifier for a cloud infrastructure company (like Cloudflare).
Analyze the feedback and return a JSON array of relevant themes.
Possible themes: performance, reliability, documentation, pricing, support, feature-request, bug, security, usability, integration, developer-experience, onboarding.
Return ONLY the JSON array, no other text.`;

  const prompt = `Classify this feedback into themes:\n\n${text}`;
  
  const response = await generateText(env, prompt, systemPrompt, 100);
  
  try {
    const themes = JSON.parse(response.trim());
    if (Array.isArray(themes)) {
      return themes;
    }
  } catch {
    console.error('Failed to parse themes:', response);
  }
  
  return ['uncategorized'];
}

/**
 * Calculate urgency score based on content and customer context
 */
export async function calculateUrgency(
  env: Env,
  text: string,
  customerTier: string | null,
  arr: number | null
): Promise<number> {
  const systemPrompt = `You are an urgency classifier for customer feedback.
Rate the urgency from 1-10 based on:
- Impact severity (blocking=10, degraded=7, minor=3)
- Business impact (revenue loss, reputation)
- Customer tier (enterprise=high priority)
- Keywords (urgent, critical, blocking, broken, production down)
Return ONLY a single number from 1 to 10.`;

  const prompt = `Rate urgency 1-10 for this feedback:

Content: ${text}
Customer Tier: ${customerTier || 'unknown'}
ARR: $${arr || 0}

Return only the number.`;

  const response = await generateText(env, prompt, systemPrompt, 10);
  
  try {
    const urgency = parseInt(response.trim(), 10);
    if (urgency >= 1 && urgency <= 10) {
      return urgency;
    }
  } catch {
    console.error('Failed to parse urgency:', response);
  }
  
  // Default urgency based on tier
  const tierUrgency: Record<string, number> = {
    enterprise: 7,
    pro: 5,
    free: 3,
    unknown: 5,
  };
  
  return tierUrgency[customerTier || 'unknown'] || 5;
}

/**
 * Summarize text
 */
export async function summarizeText(env: Env, text: string): Promise<string> {
  const response = await env.AI.run(MODELS.SUMMARIZATION, {
    input_text: text,
    max_length: 150,
  });
  
  return response.summary;
}

/**
 * Generate chat response with RAG context
 */
export async function generateChatResponse(
  env: Env,
  query: string,
  context: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<string> {
  const systemPrompt = `You are Signal, an AI assistant for a customer feedback intelligence platform.
You help Product Managers understand customer feedback, identify trends, and prioritize issues.

Your knowledge comes from real-time feedback data from multiple sources: Support Tickets, GitHub Issues, Discord, Twitter/X, Community Forums, and Email.

Guidelines:
- Be concise and actionable
- Use specific numbers and customer names when available
- Highlight urgency and business impact
- Suggest next steps when appropriate
- If you don't have enough information, say so

Context from feedback database:
${context}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10), // Last 10 messages
    { role: 'user', content: query },
  ];
  
  const response = await env.AI.run(MODELS.TEXT_GENERATION, {
    messages,
    max_tokens: 1000,
    temperature: 0.7,
  });
  
  return response.response;
}

/**
 * Detect product mentioned in feedback
 */
export async function detectProduct(env: Env, text: string): Promise<string | null> {
  const systemPrompt = `You are a product classifier for Cloudflare.
Given customer feedback, identify which Cloudflare product is being discussed.
Products: Workers, R2, Pages, D1, KV, Durable Objects, Workers AI, Vectorize, Queues, Turnstile, WAF, CDN, DNS, Access, Tunnel, Stream, Images, Other, Unknown.
Return ONLY the product name, nothing else.`;

  const response = await generateText(env, `Identify the product: ${text}`, systemPrompt, 20);
  
  const product = response.trim();
  
  // Validate it's a known product
  const knownProducts = [
    'Workers', 'R2', 'Pages', 'D1', 'KV', 'Durable Objects',
    'Workers AI', 'Vectorize', 'Queues', 'Turnstile', 'WAF',
    'CDN', 'DNS', 'Access', 'Tunnel', 'Stream', 'Images'
  ];
  
  if (knownProducts.some(p => product.toLowerCase().includes(p.toLowerCase()))) {
    return product;
  }
  
  if (product.toLowerCase() === 'unknown' || product.toLowerCase() === 'other') {
    return null;
  }
  
  return product;
}
