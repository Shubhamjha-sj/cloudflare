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

// Transform snake_case to camelCase
const snakeToCamel = (str: string): string => 
  str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const transformKeys = <T>(obj: any): T => {
  if (Array.isArray(obj)) return obj.map(item => transformKeys(item)) as T;
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = snakeToCamel(key);
      acc[camelKey] = transformKeys(obj[key]);
      return acc;
    }, {} as any) as T;
  }
  return obj;
};

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
  const response = await client.get(`/feedback?${params}`);
  return transformKeys<PaginatedResponse<Feedback>>(response.data);
};

export const getFeedbackById = async (id: string): Promise<Feedback> => {
  const response = await client.get(`/feedback/${id}`);
  return transformKeys<ApiResponse<Feedback>>(response.data).data;
};

export const createFeedback = async (feedback: Partial<Feedback>): Promise<Feedback> => {
  const response = await client.post('/feedback', feedback);
  return transformKeys<ApiResponse<Feedback>>(response.data).data;
};

export const updateFeedback = async (id: string, updates: Partial<Feedback>): Promise<Feedback> => {
  const response = await client.put(`/feedback/${id}`, updates);
  return transformKeys<ApiResponse<Feedback>>(response.data).data;
};

// Analytics API
export const getAnalyticsSummary = async (timeRange: TimeRange, product?: string): Promise<AnalyticsSummary> => {
  let url = `/analytics/summary?time_range=${timeRange}`;
  if (product && product !== 'all') url += `&product=${product}`;
  const response = await client.get(url);
  return transformKeys<ApiResponse<AnalyticsSummary>>(response.data).data;
};

export const getTrendingThemes = async (timeRange: TimeRange, limit = 10, product?: string): Promise<TrendingTheme[]> => {
  let url = `/analytics/themes?time_range=${timeRange}&limit=${limit}`;
  if (product) url += `&product=${product}`;
  const response = await client.get(url);
  return transformKeys<ApiResponse<TrendingTheme[]>>(response.data).data;
};

export const getProductBreakdown = async (timeRange: TimeRange): Promise<ProductBreakdown[]> => {
  const response = await client.get(`/analytics/products?time_range=${timeRange}`);
  return transformKeys<ApiResponse<ProductBreakdown[]>>(response.data).data;
};

export const getSourceBreakdown = async (timeRange: TimeRange, product?: string): Promise<SourceBreakdown[]> => {
  let url = `/analytics/sources?time_range=${timeRange}`;
  if (product && product !== 'all') url += `&product=${product}`;
  const response = await client.get(url);
  return transformKeys<ApiResponse<SourceBreakdown[]>>(response.data).data;
};

// Alerts API
export const getAlerts = async (limit = 10): Promise<Alert[]> => {
  const response = await client.get(`/alerts?limit=${limit}`);
  return transformKeys<ApiResponse<Alert[]>>(response.data).data;
};

export const acknowledgeAlert = async (id: string): Promise<Alert> => {
  const response = await client.post(`/alerts/${id}/acknowledge`);
  return transformKeys<ApiResponse<Alert>>(response.data).data;
};

// Customers API
export const getCustomers = async (page = 1, pageSize = 20, tier?: string): Promise<PaginatedResponse<Customer>> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('page_size', pageSize.toString());
  if (tier) params.append('tier', tier);
  const response = await client.get(`/customers?${params}`);
  return transformKeys<PaginatedResponse<Customer>>(response.data);
};

export const getCustomerById = async (id: string): Promise<Customer> => {
  const response = await client.get(`/customers/${id}`);
  return transformKeys<ApiResponse<Customer>>(response.data).data;
};

// Chat API
export const sendChatMessage = async (request: ChatRequest): Promise<ChatResponse> => {
  const response = await client.post('/chat', request);
  return transformKeys<ChatResponse>(response.data);
};

// Search API
export const semanticSearch = async (query: string, limit = 10): Promise<Feedback[]> => {
  const response = await client.post('/search/semantic', { query, limit });
  return transformKeys<ApiResponse<Feedback[]>>(response.data).data;
};

export const similarFeedback = async (feedbackId: string, limit = 5): Promise<Feedback[]> => {
  const response = await client.get(`/search/similar/${feedbackId}?limit=${limit}`);
  return transformKeys<ApiResponse<Feedback[]>>(response.data).data;
};

// Reports API
export interface ReportResponse {
  reportType: string;
  timeRange: string;
  generatedAt: string;
  summary: string;
  rawData: any;
}

export const generateReport = async (reportType: string, timeRange = '7d', product?: string): Promise<ReportResponse> => {
  const response = await client.post('/analytics/report', { reportType, timeRange, product });
  return transformKeys<ApiResponse<ReportResponse>>(response.data).data;
};

export default {
  getFeedback, getFeedbackById, createFeedback, updateFeedback,
  getAnalyticsSummary, getTrendingThemes, getProductBreakdown, getSourceBreakdown,
  getAlerts, acknowledgeAlert, getCustomers, getCustomerById,
  sendChatMessage, semanticSearch, similarFeedback, generateReport
};
