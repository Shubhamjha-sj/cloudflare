/**
 * Queue Service
 * Handles async message processing for feedback ingestion
 */

import { Env, QueueMessage, ProcessFeedbackPayload, Feedback } from '../types';
import { analyzeSentiment, classifyThemes, calculateUrgency, detectProduct } from './ai';
import { indexFeedback } from './vectorize';
import { createFeedback, createAlert } from './database';
import { v4 as uuidv4 } from 'uuid';

/**
 * Send a message to the feedback processing queue
 */
export async function sendToQueue(
  env: Env,
  message: QueueMessage
): Promise<void> {
  await env.FEEDBACK_QUEUE.send(message);
}

/**
 * Send feedback for async processing
 */
export async function queueFeedbackProcessing(
  env: Env,
  payload: ProcessFeedbackPayload
): Promise<void> {
  await sendToQueue(env, {
    type: 'process_feedback',
    payload,
  });
}

/**
 * Process a batch of queue messages
 * This is called by the queue consumer
 */
export async function processQueueBatch(
  env: Env,
  batch: MessageBatch<QueueMessage>
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await processMessage(env, message.body);
      message.ack();
    } catch (error) {
      console.error('Failed to process message:', error);
      message.retry();
    }
  }
}

/**
 * Process a single queue message
 */
async function processMessage(env: Env, message: QueueMessage): Promise<void> {
  switch (message.type) {
    case 'process_feedback':
      await handleProcessFeedback(env, message.payload as ProcessFeedbackPayload);
      break;
    case 'update_themes':
      await handleUpdateThemes(env, message.payload);
      break;
    case 'generate_alert':
      await handleGenerateAlert(env, message.payload);
      break;
    default:
      console.warn('Unknown message type:', message.type);
  }
}

/**
 * Handle feedback processing
 */
async function handleProcessFeedback(
  env: Env,
  payload: ProcessFeedbackPayload
): Promise<void> {
  const { feedback_id, content, source, product, customer_id, customer_name, customer_tier, customer_arr } = payload;
  
  console.log(`Processing feedback: ${feedback_id}`);
  
  // Run AI analysis in parallel
  const [sentimentResult, themes, urgency, detectedProduct] = await Promise.all([
    analyzeSentiment(env, content),
    classifyThemes(env, content),
    calculateUrgency(env, content, customer_tier || null, customer_arr || null),
    product ? Promise.resolve(product) : detectProduct(env, content),
  ]);
  
  // Create feedback record
  const feedback: Omit<Feedback, 'created_at' | 'updated_at'> = {
    id: feedback_id,
    content,
    source,
    sentiment: sentimentResult.score,
    sentiment_label: sentimentResult.label,
    urgency,
    product: detectedProduct || product || null,
    themes,
    customer_id: customer_id || null,
    customer_name: customer_name || null,
    customer_tier: customer_tier || null,
    customer_arr: customer_arr || null,
    status: 'new',
    assigned_to: null,
    metadata: {},
  };
  
  // Store in D1
  await createFeedback(env, feedback);
  
  // Index in Vectorize for semantic search
  await indexFeedback(env, feedback_id, content, {
    source,
    product: detectedProduct || product,
    sentiment: sentimentResult.score,
    urgency,
    customer_tier: customer_tier || undefined,
  });
  
  // Check if alert should be generated
  if (urgency >= 8 || (customer_tier === 'enterprise' && sentimentResult.score < -0.5)) {
    await sendToQueue(env, {
      type: 'generate_alert',
      payload: {
        feedback_id,
        content,
        urgency,
        sentiment: sentimentResult.score,
        customer_name,
        customer_tier,
        customer_arr,
        product: detectedProduct || product,
      },
    });
  }
  
  // Trigger theme update
  await sendToQueue(env, {
    type: 'update_themes',
    payload: { themes, product: detectedProduct || product },
  });
  
  console.log(`Feedback processed: ${feedback_id}`);
}

/**
 * Handle theme updates
 */
async function handleUpdateThemes(
  env: Env,
  payload: Record<string, unknown>
): Promise<void> {
  const { themes, product } = payload as { themes: string[]; product: string };
  
  // This would typically:
  // 1. Increment mention counts for existing themes
  // 2. Detect new emerging themes
  // 3. Update theme sentiment and products
  
  // For now, we'll just log
  console.log('Theme update:', themes, product);
  
  // In a full implementation, you would:
  // - Query existing themes
  // - Cluster similar themes using embeddings
  // - Update mention counts
  // - Calculate trend changes
}

/**
 * Handle alert generation
 */
async function handleGenerateAlert(
  env: Env,
  payload: Record<string, unknown>
): Promise<void> {
  const {
    feedback_id,
    content,
    urgency,
    sentiment,
    customer_name,
    customer_tier,
    customer_arr,
    product,
  } = payload as {
    feedback_id: string;
    content: string;
    urgency: number;
    sentiment: number;
    customer_name?: string;
    customer_tier?: string;
    customer_arr?: number;
    product?: string;
  };
  
  // Determine alert type
  let alertType: 'critical' | 'warning' | 'info' = 'info';
  if (urgency >= 9 || (customer_tier === 'enterprise' && sentiment < -0.7)) {
    alertType = 'critical';
  } else if (urgency >= 7 || sentiment < -0.5) {
    alertType = 'warning';
  }
  
  // Build alert message
  let message = '';
  if (alertType === 'critical') {
    if (customer_name && customer_arr) {
      message = `Critical issue from ${customer_name} ($${(customer_arr / 1000).toFixed(0)}k ARR): ${content.substring(0, 100)}...`;
    } else {
      message = `Critical issue reported: ${content.substring(0, 150)}...`;
    }
  } else if (alertType === 'warning') {
    message = `High urgency feedback${customer_tier === 'enterprise' ? ' from Enterprise customer' : ''}: ${content.substring(0, 100)}...`;
  } else {
    message = `New feedback requiring attention: ${content.substring(0, 100)}...`;
  }
  
  // Create alert
  await createAlert(env, {
    id: uuidv4(),
    type: alertType,
    message,
    product: product || null,
    acknowledged: false,
    feedback_ids: [feedback_id],
  });
  
  console.log(`Alert created: ${alertType}`);
}
