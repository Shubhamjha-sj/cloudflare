/**
 * Vectorize Service
 * Handles vector storage and semantic search
 */

import { Env } from '../types';
import { generateEmbedding } from './ai';

interface VectorMetadata {
  source?: string;
  product?: string;
  sentiment?: number;
  urgency?: number;
  customer_tier?: string;
  created_at?: string;
}

interface VectorMatch {
  id: string;
  score: number;
  metadata?: VectorMetadata;
}

/**
 * Insert a vector into the Vectorize index
 */
export async function insertVector(
  env: Env,
  id: string,
  vector: number[],
  metadata: VectorMetadata
): Promise<void> {
  await env.VECTORIZE.insert([
    {
      id,
      values: vector,
      metadata,
    },
  ]);
}

/**
 * Insert multiple vectors
 */
export async function insertVectors(
  env: Env,
  vectors: Array<{ id: string; values: number[]; metadata: VectorMetadata }>
): Promise<void> {
  // Vectorize has a batch limit, so we chunk if needed
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    await env.VECTORIZE.insert(batch);
  }
}

/**
 * Query for similar vectors
 */
export async function querySimilar(
  env: Env,
  vector: number[],
  topK: number = 10,
  filter?: Record<string, string | number>
): Promise<VectorMatch[]> {
  const queryOptions: VectorizeQueryOptions = {
    topK,
    returnValues: false,
    returnMetadata: true,
  };
  
  if (filter) {
    queryOptions.filter = filter;
  }
  
  const results = await env.VECTORIZE.query(vector, queryOptions);
  
  return results.matches.map(match => ({
    id: match.id,
    score: match.score,
    metadata: match.metadata as VectorMetadata,
  }));
}

/**
 * Search for similar content using text query
 */
export async function semanticSearch(
  env: Env,
  query: string,
  topK: number = 10,
  filter?: Record<string, string | number>
): Promise<VectorMatch[]> {
  // Generate embedding for the query
  const queryVector = await generateEmbedding(env, query);
  
  // Query Vectorize
  return querySimilar(env, queryVector, topK, filter);
}

/**
 * Find similar feedback items
 */
export async function findSimilarFeedback(
  env: Env,
  feedbackId: string,
  content: string,
  topK: number = 5
): Promise<VectorMatch[]> {
  // Generate embedding for the feedback content
  const vector = await generateEmbedding(env, content);
  
  // Query for similar, excluding the original
  const results = await querySimilar(env, vector, topK + 1);
  
  // Filter out the original feedback
  return results.filter(match => match.id !== feedbackId).slice(0, topK);
}

/**
 * Delete vectors by ID
 */
export async function deleteVectors(env: Env, ids: string[]): Promise<void> {
  await env.VECTORIZE.deleteByIds(ids);
}

/**
 * Update vector metadata
 * Note: Vectorize doesn't support metadata updates, so we delete and re-insert
 */
export async function updateVector(
  env: Env,
  id: string,
  vector: number[],
  metadata: VectorMetadata
): Promise<void> {
  await deleteVectors(env, [id]);
  await insertVector(env, id, vector, metadata);
}

/**
 * Index feedback content
 */
export async function indexFeedback(
  env: Env,
  feedbackId: string,
  content: string,
  metadata: VectorMetadata
): Promise<void> {
  // Generate embedding
  const vector = await generateEmbedding(env, content);
  
  // Store in Vectorize
  await insertVector(env, feedbackId, vector, {
    ...metadata,
    created_at: new Date().toISOString(),
  });
}
