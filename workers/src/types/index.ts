// ============================================
// Environment Bindings
// ============================================

export interface Env {
  // D1 Database
  DB: D1Database;
  
  // Vectorize Index
  VECTORIZE: VectorizeIndex;
  
  // Queue
  FEEDBACK_QUEUE: Queue<QueueMessage>;
  
  // Workers AI
  AI: Ai;
  
  // Environment variables
  ENVIRONMENT: string;
}

// ============================================
// Database Types
// ============================================

export type FeedbackSource = 'github' | 'discord' | 'twitter' | 'support' | 'forum' | 'email';
export type SentimentLabel = 'positive' | 'neutral' | 'negative' | 'frustrated' | 'concerned' | 'annoyed';
export type CustomerTier = 'enterprise' | 'pro' | 'free' | 'unknown';
export type FeedbackStatus = 'new' | 'in_review' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';
export type AlertType = 'critical' | 'warning' | 'info';
export type Priority = 'high' | 'medium' | 'low';
export type FeatureStatus = 'new' | 'under_review' | 'planned' | 'in_progress' | 'shipped' | 'declined';

export interface Feedback {
  id: string;
  content: string;
  source: FeedbackSource;
  sentiment: number;
  sentiment_label: SentimentLabel;
  urgency: number;
  product: string | null;
  themes: string[]; // Stored as JSON string in D1
  customer_id: string | null;
  customer_name: string | null;
  customer_tier: CustomerTier | null;
  customer_arr: number | null;
  status: FeedbackStatus;
  assigned_to: string | null;
  metadata: Record<string, unknown>; // Stored as JSON string in D1
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  tier: CustomerTier;
  arr: number;
  products: string[]; // Stored as JSON string in D1
  health_score: number;
  created_at: string;
  updated_at: string;
}

export interface Theme {
  id: string;
  theme: string;
  mentions: number;
  change_percent: number;
  sentiment: SentimentLabel;
  products: string[]; // Stored as JSON string in D1
  is_new: boolean;
  summary: string | null;
  suggested_action: string | null;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  type: AlertType;
  message: string;
  product: string | null;
  acknowledged: boolean;
  feedback_ids: string[]; // Stored as JSON string in D1
  created_at: string;
}

export interface FeatureRequest {
  id: string;
  title: string;
  description: string | null;
  request_count: number;
  top_use_cases: string[]; // Stored as JSON string in D1
  customer_profile: string | null;
  priority: Priority;
  status: FeatureStatus;
  product: string | null;
  feedback_ids: string[]; // Stored as JSON string in D1
  created_at: string;
  updated_at: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateFeedbackRequest {
  content: string;
  source: FeedbackSource;
  product?: string;
  customer_id?: string;
  customer_name?: string;
  customer_tier?: CustomerTier;
  customer_arr?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateFeedbackRequest {
  content?: string;
  status?: FeedbackStatus;
  assigned_to?: string;
  product?: string;
  urgency?: number;
}

export interface FeedbackFilters {
  source?: FeedbackSource[];
  product?: string[];
  status?: FeedbackStatus[];
  customer_tier?: CustomerTier[];
  urgency_min?: number;
  urgency_max?: number;
  search?: string;
  date_from?: string;
  date_to?: string;
}

export interface PaginationParams {
  page?: number;
  page_size?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// Analytics Types
// ============================================

export interface AnalyticsSummary {
  total_feedback: number;
  total_feedback_change: number;
  avg_sentiment: number;
  sentiment_change: number;
  critical_alerts: number;
  alerts_change: number;
  avg_response_time: string;
  response_time_change: number;
  enterprise_affected: number;
}

export interface ProductBreakdown {
  product: string;
  count: number;
  percentage: number;
  sentiment: number;
  top_issue: string | null;
}

export interface SourceBreakdown {
  source: FeedbackSource;
  count: number;
  percentage: number;
}

export interface TrendingTheme {
  id: string;
  theme: string;
  mentions: number;
  change: number;
  change_direction: 'up' | 'down' | 'stable';
  sentiment: SentimentLabel;
  products: string[];
  is_new: boolean;
  summary?: string;
  top_sources: string[];
  affected_customers: string[];
  suggested_action?: string;
}

// ============================================
// Chat Types
// ============================================

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface ChatSource {
  type: 'feedback' | 'theme' | 'customer';
  id: string;
  title: string;
  relevance: number;
}

export interface ChatResponse {
  message: string;
  sources: ChatSource[];
  conversation_id: string;
}

// ============================================
// Queue Types
// ============================================

export interface QueueMessage {
  type: 'process_feedback' | 'update_themes' | 'generate_alert';
  payload: Record<string, unknown>;
}

export interface ProcessFeedbackPayload {
  feedback_id: string;
  content: string;
  source: FeedbackSource;
  product?: string;
  customer_id?: string;
  customer_name?: string;
  customer_tier?: CustomerTier;
  customer_arr?: number;
}

// ============================================
// Webhook Types
// ============================================

export interface GitHubWebhookPayload {
  action: string;
  issue?: {
    number: number;
    title: string;
    body: string;
    user: { login: string };
    labels: Array<{ name: string }>;
  };
  comment?: {
    body: string;
    user: { login: string };
  };
  repository: {
    full_name: string;
  };
}

export interface DiscordWebhookPayload {
  content: string;
  author: {
    id: string;
    username: string;
  };
  channel_id: string;
  guild_id?: string;
}

// ============================================
// Workers AI Types
// ============================================

export interface SentimentResult {
  score: number;
  label: SentimentLabel;
}

export interface EmbeddingResult {
  values: number[];
}

export interface TextGenerationResult {
  response: string;
}
