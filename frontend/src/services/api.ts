import axios from 'axios';
import type {
  Feedback, FeedbackFilters, TrendingTheme, Customer, AnalyticsSummary,
  ProductBreakdown, SourceBreakdown, Alert, ChatRequest, ChatResponse,
  ApiResponse, PaginatedResponse, TimeRange
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Feedback API
export const getFeedback = async (
  filters?: FeedbackFilters, page = 1, pageSize = 20
): Promise<PaginatedResponse<Feedback>> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('page_size', pageSize.toString());
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) value.forEach(v => params.append(key, v));
        else params.append(key, value.toString());
      }
    });
  }
  const response = await client.get<PaginatedResponse<Feedback>>(`/feedback?${params}`);
  return response.data;
};

export const getFeedbackById = async (id: string): Promise<Feedback> => {
  const response = await client.get<ApiResponse<Feedback>>(`/feedback/${id}`);
  return response.data.data;
};

export const createFeedback = async (feedback: Partial<Feedback>): Promise<Feedback> => {
  const response = await client.post<ApiResponse<Feedback>>('/feedback', feedback);
  return response.data.data;
};

export const updateFeedback = async (id: string, updates: Partial<Feedback>): Promise<Feedback> => {
  const response = await client.put<ApiResponse<Feedback>>(`/feedback/${id}`, updates);
  return response.data.data;
};

// Analytics API
export const getAnalyticsSummary = async (timeRange: TimeRange): Promise<AnalyticsSummary> => {
  const response = await client.get<ApiResponse<AnalyticsSummary>>(`/analytics/summary?time_range=${timeRange}`);
  return response.data.data;
};

export const getTrendingThemes = async (timeRange: TimeRange, limit = 10): Promise<TrendingTheme[]> => {
  const response = await client.get<ApiResponse<TrendingTheme[]>>(`/analytics/themes?time_range=${timeRange}&limit=${limit}`);
  return response.data.data;
};

export const getProductBreakdown = async (timeRange: TimeRange): Promise<ProductBreakdown[]> => {
  const response = await client.get<ApiResponse<ProductBreakdown[]>>(`/analytics/products?time_range=${timeRange}`);
  return response.data.data;
};

export const getSourceBreakdown = async (timeRange: TimeRange): Promise<SourceBreakdown[]> => {
  const response = await client.get<ApiResponse<SourceBreakdown[]>>(`/analytics/sources?time_range=${timeRange}`);
  return response.data.data;
};

// Alerts API
export const getAlerts = async (limit = 10): Promise<Alert[]> => {
  const response = await client.get<ApiResponse<Alert[]>>(`/alerts?limit=${limit}`);
  return response.data.data;
};

export const acknowledgeAlert = async (id: string): Promise<Alert> => {
  const response = await client.post<ApiResponse<Alert>>(`/alerts/${id}/acknowledge`);
  return response.data.data;
};

// Customers API
export const getCustomers = async (page = 1, pageSize = 20, tier?: string): Promise<PaginatedResponse<Customer>> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('page_size', pageSize.toString());
  if (tier) params.append('tier', tier);
  const response = await client.get<PaginatedResponse<Customer>>(`/customers?${params}`);
  return response.data;
};

export const getCustomerById = async (id: string): Promise<Customer> => {
  const response = await client.get<ApiResponse<Customer>>(`/customers/${id}`);
  return response.data.data;
};

// Chat API
export const sendChatMessage = async (request: ChatRequest): Promise<ChatResponse> => {
  const response = await client.post<ChatResponse>('/chat', request);
  return response.data;
};

// Search API
export const semanticSearch = async (query: string, limit = 10): Promise<Feedback[]> => {
  const response = await client.post<ApiResponse<Feedback[]>>('/search/semantic', { query, limit });
  return response.data.data;
};

export const similarFeedback = async (feedbackId: string, limit = 5): Promise<Feedback[]> => {
  const response = await client.get<ApiResponse<Feedback[]>>(`/search/similar/${feedbackId}?limit=${limit}`);
  return response.data.data;
};

export default {
  getFeedback, getFeedbackById, createFeedback, updateFeedback,
  getAnalyticsSummary, getTrendingThemes, getProductBreakdown, getSourceBreakdown,
  getAlerts, acknowledgeAlert, getCustomers, getCustomerById,
  sendChatMessage, semanticSearch, similarFeedback
};
