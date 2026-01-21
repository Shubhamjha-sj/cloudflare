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
  
  // Enhance query with context from previous conversation for follow-up questions
  const enhancedQuery = enhanceQueryWithContext(body.message, history);
  
  // Retrieve relevant context using RAG
  const { context, sources } = await retrieveContext(env, enhancedQuery);
  
  // Generate response - pass original message but enhanced context
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
 * Detect if query is a follow-up and enhance with context from previous messages
 */
function enhanceQueryWithContext(
  query: string,
  history: Array<{ role: string; content: string }>
): string {
  const queryLower = query.toLowerCase();
  
  // Patterns that indicate a follow-up question
  const followUpPatterns = [
    /\b(their|them|they|these|those|this|that|it)\b/i,
    /\b(mentioned|above|previous|earlier|said|listed)\b/i,
    /\b(explain|elaborate|tell me more|what about|details|specifics)\b/i,
    /\b(which|what|how)\s+(are|is|do|does|can|could|should|would)\s+(the|these|those|they|it)\b/i,
    /^(and|but|also|what about|how about|why)\b/i,
    /\b(for (them|those|these|the mentioned|the above))\b/i,
    /\bcritical\b/i,
  ];
  
  const isFollowUp = followUpPatterns.some(pattern => pattern.test(queryLower));
  
  if (!isFollowUp || history.length === 0) {
    return query;
  }
  
  // Get the last assistant response
  const lastAssistantMessage = history
    .filter(m => m.role === 'assistant')
    .slice(-1)[0]?.content || '';
  
  if (!lastAssistantMessage) {
    return query;
  }
  
  // Extract key entities from the last response
  const extractedEntities: string[] = [];
  
  // Extract customer names (patterns like "**CustomerName (tier)**" or "CustomerName (enterprise)")
  const customerMatches = lastAssistantMessage.match(/\*\*([A-Z][^*]+?)\s*\([^)]+\)\*\*/g);
  if (customerMatches) {
    customerMatches.forEach(match => {
      const name = match.replace(/\*\*/g, '').replace(/\s*\([^)]+\)/, '').trim();
      if (name && !extractedEntities.includes(name)) {
        extractedEntities.push(name);
      }
    });
  }
  
  // Also try simpler pattern for customer names
  const simpleCustomerMatches = lastAssistantMessage.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s*\((enterprise|pro|free)\)/g);
  if (simpleCustomerMatches) {
    simpleCustomerMatches.forEach(match => {
      const name = match.replace(/\s*\([^)]+\)/, '').trim();
      if (name && !extractedEntities.includes(name)) {
        extractedEntities.push(name);
      }
    });
  }
  
  // Extract products mentioned
  const products = ['Workers', 'R2', 'Pages', 'D1', 'KV', 'Queues', 'Durable Objects', 'Vectorize', 'Workers AI', 'Hyperdrive'];
  products.forEach(product => {
    if (lastAssistantMessage.toLowerCase().includes(product.toLowerCase())) {
      if (!extractedEntities.includes(product)) {
        extractedEntities.push(product);
      }
    }
  });
  
  // Extract key themes/issues (numbered items or bold items)
  const themeMatches = lastAssistantMessage.match(/\*\*([^*]+)\*\*/g);
  if (themeMatches) {
    themeMatches.slice(0, 3).forEach(match => {
      const theme = match.replace(/\*\*/g, '').trim();
      // Only add if it looks like a theme/issue (not a customer name we already have)
      if (theme && theme.length < 50 && !extractedEntities.includes(theme) && !/enterprise|pro|free/i.test(theme)) {
        extractedEntities.push(theme);
      }
    });
  }
  
  if (extractedEntities.length === 0) {
    return query;
  }
  
  // Enhance the query with extracted context
  const contextAddition = extractedEntities.slice(0, 4).join(', ');
  const enhancedQuery = `${query} (context: ${contextAddition})`;
  
  console.log(`Enhanced query: "${query}" -> "${enhancedQuery}"`);
  
  return enhancedQuery;
}

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
  const queryLower = query.toLowerCase();
  
  // Track unique items to avoid duplicates in sources
  const seenFeedbackIds = new Set<string>();
  const seenFeedbackContent = new Set<string>();
  const seenThemeIds = new Set<string>();
  const seenCustomers = new Set<string>();
  
  try {
    // 1. Semantic search for relevant feedback
    const searchResults = await semanticSearch(env, query, 8);
    
    if (searchResults.length > 0) {
      const feedbackItems = await Promise.all(
        searchResults.map(async (result) => {
          const feedback = await getFeedbackById(env, result.id);
          if (feedback) {
            // Deduplicate by content (first 50 chars) to avoid similar feedback
            const contentKey = feedback.content.substring(0, 50).toLowerCase();
            
            if (!seenFeedbackIds.has(feedback.id) && !seenFeedbackContent.has(contentKey)) {
              seenFeedbackIds.add(feedback.id);
              seenFeedbackContent.add(contentKey);
              
              sources.push({
                type: 'feedback',
                id: feedback.id,
                title: feedback.content.substring(0, 50) + '...',
                relevance: result.score,
              });
              return { ...feedback, score: result.score };
            }
          }
          return null;
        })
      );
      
      const validFeedback = feedbackItems.filter(Boolean);
      if (validFeedback.length > 0) {
        contextParts.push('RELEVANT FEEDBACK:');
        validFeedback.forEach((fb, i) => {
          const customerKey = fb!.customer_name || 'Anonymous';
          const isNewCustomer = !seenCustomers.has(customerKey);
          seenCustomers.add(customerKey);
          
          contextParts.push(`${i + 1}. [${fb!.source}] ${fb!.content}`);
          contextParts.push(`   Sentiment: ${fb!.sentiment.toFixed(2)}, Urgency: ${fb!.urgency}/10 (${fb!.urgency <= 3 ? 'Low' : fb!.urgency <= 6 ? 'Medium' : 'High'})`);
          if (fb!.customer_name) {
            contextParts.push(`   Customer: ${fb!.customer_name} (${fb!.customer_tier})${isNewCustomer ? '' : ' [DUPLICATE - consolidate with above]'}`);
          }
        });
      }
    }
  } catch (error) {
    console.error('Semantic search failed:', error);
  }
  
  try {
    // 2. Get trending themes - only add if query seems to be asking about themes/trends
    const isAskingAboutThemes = /theme|trend|issue|problem|top|popular|common|frequent|urgent/i.test(query);
    const themes = await listThemes(env, 5);
    
    if (themes.length > 0) {
      contextParts.push('\nTRENDING THEMES:');
      themes.forEach((theme, i) => {
        // Only add to sources if the query mentions themes or the theme is relevant
        const themeRelevant = isAskingAboutThemes || 
          queryLower.includes(theme.theme.toLowerCase()) ||
          theme.products.some(p => queryLower.includes(p.toLowerCase()));
        
        // Deduplicate themes
        if (themeRelevant && !seenThemeIds.has(theme.id)) {
          seenThemeIds.add(theme.id);
          sources.push({
            type: 'theme',
            id: theme.id,
            title: theme.theme,
            relevance: 0.8,
          });
        }
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
