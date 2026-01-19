// Feedback Types
export interface Feedback {
  id: string;
  content: string;
  source: FeedbackSource;
  sentiment: number;
  sentimentLabel: SentimentLabel;
  urgency: number;
  product: string;
  themes: string[];
  customerId?: string;
  customerName?: string;
  customerTier?: CustomerTier;
  customerArr?: number;
  createdAt: string;
  updatedAt: string;
  status: FeedbackStatus;
  assignedTo?: string;
  metadata?: Record<string, unknown>;
}

export type FeedbackSource = 'github' | 'discord' | 'twitter' | 'support' | 'forum' | 'email';
export type SentimentLabel = 'positive' | 'neutral' | 'negative' | 'frustrated' | 'concerned' | 'annoyed';
export type CustomerTier = 'enterprise' | 'pro' | 'free' | 'unknown';
export type FeedbackStatus = 'new' | 'in_review' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';

export interface TrendingTheme {
  id: string;
  theme: string;
  mentions: number;
  change: number;
  changeDirection: 'up' | 'down' | 'stable';
  sentiment: SentimentLabel;
  products: string[];
  isNew: boolean;
  summary?: string;
  topSources: string[];
  affectedCustomers: string[];
  suggestedAction?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  tier: CustomerTier;
  arr: number;
  products: string[];
  openIssues: number;
  sentiment: number;
  healthScore: number;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalFeedback: number;
  totalFeedbackChange: number;
  avgSentiment: number;
  sentimentChange: number;
  criticalAlerts: number;
  alertsChange: number;
  avgResponseTime: string;
  responseTimeChange: number;
  enterpriseAffected: number;
}

export interface ProductBreakdown {
  product: string;
  count: number;
  percentage: number;
  sentiment: number;
  topIssue?: string;
}

export interface SourceBreakdown {
  source: FeedbackSource;
  count: number;
  percentage: number;
}

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  product: string;
  createdAt: string;
  acknowledged: boolean;
  feedbackIds?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: ChatSource[];
}

export interface ChatSource {
  type: 'feedback' | 'theme' | 'customer';
  id: string;
  title: string;
  relevance: number;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface ChatResponse {
  message: string;
  sources: ChatSource[];
  conversationId: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface FeedbackFilters {
  source?: FeedbackSource[];
  product?: string[];
  sentiment?: SentimentLabel[];
  urgencyMin?: number;
  urgencyMax?: number;
  customerTier?: CustomerTier[];
  status?: FeedbackStatus[];
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export type TimeRange = '24h' | '7d' | '30d' | '90d';
