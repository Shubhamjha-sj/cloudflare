/**
 * Feedback API Handler
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { Env, CreateFeedbackRequest, UpdateFeedbackRequest, FeedbackFilters } from '../types';
import { getFeedbackById, listFeedback, updateFeedback, deleteFeedback } from '../services/database';
import { queueFeedbackProcessing } from '../services/queue';
import { findSimilarFeedback, semanticSearch, deleteVectors } from '../services/vectorize';

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /api/feedback
 * List feedback with filters and pagination
 */
app.get('/', async (c) => {
  const env = c.env;
  
  // Parse query parameters
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('page_size') || '20');
  
  const filters: FeedbackFilters = {};
  
  const source = c.req.queries('source');
  if (source?.length) filters.source = source as any;
  
  const product = c.req.queries('product');
  if (product?.length) filters.product = product;
  
  const status = c.req.queries('status');
  if (status?.length) filters.status = status as any;
  
  const customerTier = c.req.queries('customer_tier');
  if (customerTier?.length) filters.customer_tier = customerTier as any;
  
  const urgencyMin = c.req.query('urgency_min');
  if (urgencyMin) filters.urgency_min = parseInt(urgencyMin);
  
  const urgencyMax = c.req.query('urgency_max');
  if (urgencyMax) filters.urgency_max = parseInt(urgencyMax);
  
  const search = c.req.query('search');
  if (search) filters.search = search;
  
  const dateFrom = c.req.query('date_from');
  if (dateFrom) filters.date_from = dateFrom;
  
  const dateTo = c.req.query('date_to');
  if (dateTo) filters.date_to = dateTo;
  
  const { data, total } = await listFeedback(env, filters, { page, page_size: pageSize });
  
  return c.json({
    data,
    total,
    page,
    page_size: pageSize,
    has_more: page * pageSize < total,
  });
});

/**
 * GET /api/feedback/:id
 * Get feedback by ID
 */
app.get('/:id', async (c) => {
  const env = c.env;
  const id = c.req.param('id');
  
  const feedback = await getFeedbackById(env, id);
  
  if (!feedback) {
    return c.json({ success: false, error: 'Feedback not found' }, 404);
  }
  
  return c.json({ success: true, data: feedback });
});

/**
 * POST /api/feedback
 * Create new feedback
 */
app.post('/', async (c) => {
  const env = c.env;
  const body = await c.req.json<CreateFeedbackRequest>();
  
  // Validate required fields
  if (!body.content || !body.source) {
    return c.json({ success: false, error: 'content and source are required' }, 400);
  }
  
  const feedbackId = uuidv4();
  
  // Queue for async processing with AI analysis
  await queueFeedbackProcessing(env, {
    feedback_id: feedbackId,
    content: body.content,
    source: body.source,
    product: body.product,
    customer_id: body.customer_id,
    customer_name: body.customer_name,
    customer_tier: body.customer_tier,
    customer_arr: body.customer_arr,
  });
  
  return c.json({
    success: true,
    data: {
      id: feedbackId,
      status: 'processing',
      message: 'Feedback queued for processing',
    },
  }, 202);
});

/**
 * PUT /api/feedback/:id
 * Update feedback
 */
app.put('/:id', async (c) => {
  const env = c.env;
  const id = c.req.param('id');
  const body = await c.req.json<UpdateFeedbackRequest>();
  
  const existing = await getFeedbackById(env, id);
  if (!existing) {
    return c.json({ success: false, error: 'Feedback not found' }, 404);
  }
  
  await updateFeedback(env, id, body);
  
  const updated = await getFeedbackById(env, id);
  
  return c.json({ success: true, data: updated });
});

/**
 * DELETE /api/feedback/:id
 * Delete feedback
 */
app.delete('/:id', async (c) => {
  const env = c.env;
  const id = c.req.param('id');
  
  const existing = await getFeedbackById(env, id);
  if (!existing) {
    return c.json({ success: false, error: 'Feedback not found' }, 404);
  }
  
  // Delete from D1
  await deleteFeedback(env, id);
  
  // Delete from Vectorize
  await deleteVectors(env, [id]);
  
  return c.json({ success: true, message: 'Feedback deleted' });
});

/**
 * GET /api/feedback/:id/similar
 * Get similar feedback items
 */
app.get('/:id/similar', async (c) => {
  const env = c.env;
  const id = c.req.param('id');
  const limit = parseInt(c.req.query('limit') || '5');
  
  const feedback = await getFeedbackById(env, id);
  if (!feedback) {
    return c.json({ success: false, error: 'Feedback not found' }, 404);
  }
  
  const similarMatches = await findSimilarFeedback(env, id, feedback.content, limit);
  
  // Get full feedback details for matches
  const similarFeedback = await Promise.all(
    similarMatches.map(async (match) => {
      const item = await getFeedbackById(env, match.id);
      return item ? { ...item, similarity_score: match.score } : null;
    })
  );
  
  return c.json({
    success: true,
    data: similarFeedback.filter(Boolean),
  });
});

export default app;
