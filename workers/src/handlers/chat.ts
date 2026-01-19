/**
 * AI Chat API Handler
 * RAG-powered chatbot using Vectorize and Workers AI
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { Env, ChatRequest, ChatResponse, ChatSource } from '../types';
import { generateChatResponse, generateEmbedding } from '../services/ai';
import { semanticSearch } from '../services/vectorize';
import { getFeedbackById, listThemes, getAnalyticsSummary } from '../services/database';

const app = new Hono<{ Bindings: Env }>();

// In-memory conversation storage (for demo - use D1 in production)
const conversations = new Map<string, Array<{ role: string; content: string }>>();

/**
 * POST /api/chat
 * Send a message to the AI chatbot
 */
app.post('/', async (c) => {
  const env = c.env;
  const body = await c.req.json<ChatRequest>();
  
  if (!body.message) {
    return c.json({ success: false, error: 'message is required' }, 400);
  }
  
  const conversationId = body.conversation_id || uuidv4();
  
  // Get or create conversation history
  if (!conversations.has(conversationId)) {
    conversations.set(conversationId, []);
  }
  const history = conversations.get(conversationId)!;
  
  // Retrieve relevant context using RAG
  const { context, sources } = await retrieveContext(env, body.message);
  
  // Generate response
  const response = await generateChatResponse(
    env,
    body.message,
    context,
    history
  );
  
  // Update conversation history
  history.push({ role: 'user', content: body.message });
  history.push({ role: 'assistant', content: response });
  
  // Limit history size
  if (history.length > 20) {
    conversations.set(conversationId, history.slice(-20));
  }
  
  return c.json({
    message: response,
    sources,
    conversation_id: conversationId,
  });
});

/**
 * GET /api/chat/history/:id
 * Get conversation history
 */
app.get('/history/:id', async (c) => {
  const conversationId = c.req.param('id');
  
  const history = conversations.get(conversationId);
  
  if (!history) {
    return c.json({ success: false, error: 'Conversation not found' }, 404);
  }
  
  return c.json({ success: true, data: history });
});

/**
 * DELETE /api/chat/history/:id
 * Clear conversation history
 */
app.delete('/history/:id', async (c) => {
  const conversationId = c.req.param('id');
  
  conversations.delete(conversationId);
  
  return c.json({ success: true, message: 'Conversation cleared' });
});

/**
 * POST /api/chat/summarize
 * Summarize multiple feedback items
 */
app.post('/summarize', async (c) => {
  const env = c.env;
  const body = await c.req.json<{ feedback_ids: string[] }>();
  
  if (!body.feedback_ids?.length) {
    return c.json({ success: false, error: 'feedback_ids is required' }, 400);
  }
  
  // Get feedback items
  const feedbackItems = await Promise.all(
    body.feedback_ids.map(id => getFeedbackById(env, id))
  );
  
  const validItems = feedbackItems.filter(Boolean);
  
  if (validItems.length === 0) {
    return c.json({ success: false, error: 'No feedback found' }, 404);
  }
  
  // Build context
  const content = validItems.map(item => 
    `- [${item!.source}] ${item!.content}`
  ).join('\n\n');
  
  const systemPrompt = `You are a feedback summarizer. Given multiple pieces of customer feedback, provide a concise summary that highlights:
1. Main themes and issues
2. Overall sentiment
3. Urgency level
4. Recommended actions

Be specific and actionable.`;
  
  const response = await generateChatResponse(
    env,
    `Summarize this feedback:\n\n${content}`,
    '',
    [{ role: 'system', content: systemPrompt }]
  );
  
  return c.json({
    success: true,
    data: {
      summary: response,
      feedback_count: validItems.length,
      feedback_ids: validItems.map(item => item!.id),
    },
  });
});

/**
 * Retrieve relevant context for RAG
 */
async function retrieveContext(
  env: Env,
  query: string
): Promise<{ context: string; sources: ChatSource[] }> {
  const sources: ChatSource[] = [];
  const contextParts: string[] = [];
  
  try {
    // 1. Semantic search for relevant feedback
    const searchResults = await semanticSearch(env, query, 5);
    
    if (searchResults.length > 0) {
      const feedbackItems = await Promise.all(
        searchResults.map(async (result) => {
          const feedback = await getFeedbackById(env, result.id);
          if (feedback) {
            sources.push({
              type: 'feedback',
              id: feedback.id,
              title: feedback.content.substring(0, 50) + '...',
              relevance: result.score,
            });
            return feedback;
          }
          return null;
        })
      );
      
      const validFeedback = feedbackItems.filter(Boolean);
      if (validFeedback.length > 0) {
        contextParts.push('RELEVANT FEEDBACK:');
        validFeedback.forEach((fb, i) => {
          contextParts.push(`${i + 1}. [${fb!.source}] ${fb!.content}`);
          contextParts.push(`   Sentiment: ${fb!.sentiment.toFixed(2)}, Urgency: ${fb!.urgency}/10`);
          if (fb!.customer_name) {
            contextParts.push(`   Customer: ${fb!.customer_name} (${fb!.customer_tier})`);
          }
        });
      }
    }
  } catch (error) {
    console.error('Semantic search failed:', error);
  }
  
  try {
    // 2. Get trending themes
    const themes = await listThemes(env, 5);
    
    if (themes.length > 0) {
      contextParts.push('\nTRENDING THEMES:');
      themes.forEach((theme, i) => {
        sources.push({
          type: 'theme',
          id: theme.id,
          title: theme.theme,
          relevance: 0.8,
        });
        contextParts.push(`${i + 1}. ${theme.theme} (${theme.mentions} mentions, ${theme.sentiment})`);
      });
    }
  } catch (error) {
    console.error('Theme fetch failed:', error);
  }
  
  try {
    // 3. Get summary statistics
    const stats = await getAnalyticsSummary(env, '7d');
    
    contextParts.push('\nSUMMARY STATISTICS (Last 7 days):');
    contextParts.push(`- Total feedback: ${stats.total_feedback}`);
    contextParts.push(`- Average sentiment: ${stats.avg_sentiment.toFixed(2)}`);
    contextParts.push(`- Critical alerts: ${stats.critical_alerts}`);
    contextParts.push(`- Enterprise customers affected: ${stats.enterprise_affected}`);
  } catch (error) {
    console.error('Stats fetch failed:', error);
  }
  
  return {
    context: contextParts.join('\n'),
    sources,
  };
}

export default app;
