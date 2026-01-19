import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/services/api';
import type { Feedback, FeedbackFilters, ChatRequest, TimeRange } from '@/types';

// Query Keys
export const queryKeys = {
  feedback: {
    all: ['feedback'] as const,
    list: (filters?: FeedbackFilters, page?: number) => [...queryKeys.feedback.all, 'list', filters, page] as const,
    detail: (id: string) => [...queryKeys.feedback.all, 'detail', id] as const,
    similar: (id: string) => [...queryKeys.feedback.all, 'similar', id] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    summary: (timeRange: TimeRange) => [...queryKeys.analytics.all, 'summary', timeRange] as const,
    themes: (timeRange: TimeRange) => [...queryKeys.analytics.all, 'themes', timeRange] as const,
    products: (timeRange: TimeRange) => [...queryKeys.analytics.all, 'products', timeRange] as const,
    sources: (timeRange: TimeRange) => [...queryKeys.analytics.all, 'sources', timeRange] as const,
  },
  alerts: {
    all: ['alerts'] as const,
    list: (limit?: number) => [...queryKeys.alerts.all, 'list', limit] as const,
  },
  customers: {
    all: ['customers'] as const,
    list: (page?: number, tier?: string) => [...queryKeys.customers.all, 'list', page, tier] as const,
    detail: (id: string) => [...queryKeys.customers.all, 'detail', id] as const,
  },
  search: {
    semantic: (query: string) => ['search', 'semantic', query] as const,
  },
};

// Feedback Hooks
export function useFeedback(filters?: FeedbackFilters, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: queryKeys.feedback.list(filters, page),
    queryFn: () => api.getFeedback(filters, page, pageSize),
    staleTime: 30000,
  });
}

export function useFeedbackDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.feedback.detail(id),
    queryFn: () => api.getFeedbackById(id),
    enabled: !!id,
  });
}

export function useSimilarFeedback(feedbackId: string, limit = 5) {
  return useQuery({
    queryKey: queryKeys.feedback.similar(feedbackId),
    queryFn: () => api.similarFeedback(feedbackId, limit),
    enabled: !!feedbackId,
  });
}

export function useCreateFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (feedback: Partial<Feedback>) => api.createFeedback(feedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feedback.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },
  });
}

export function useUpdateFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Feedback> }) => api.updateFeedback(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feedback.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.feedback.all });
    },
  });
}

// Analytics Hooks
export function useAnalyticsSummary(timeRange: TimeRange) {
  return useQuery({
    queryKey: queryKeys.analytics.summary(timeRange),
    queryFn: () => api.getAnalyticsSummary(timeRange),
    staleTime: 60000,
  });
}

export function useTrendingThemes(timeRange: TimeRange, limit = 10) {
  return useQuery({
    queryKey: queryKeys.analytics.themes(timeRange),
    queryFn: () => api.getTrendingThemes(timeRange, limit),
    staleTime: 60000,
  });
}

export function useProductBreakdown(timeRange: TimeRange) {
  return useQuery({
    queryKey: queryKeys.analytics.products(timeRange),
    queryFn: () => api.getProductBreakdown(timeRange),
    staleTime: 60000,
  });
}

export function useSourceBreakdown(timeRange: TimeRange) {
  return useQuery({
    queryKey: queryKeys.analytics.sources(timeRange),
    queryFn: () => api.getSourceBreakdown(timeRange),
    staleTime: 60000,
  });
}

// Alerts Hooks
export function useAlerts(limit = 10) {
  return useQuery({
    queryKey: queryKeys.alerts.list(limit),
    queryFn: () => api.getAlerts(limit),
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.acknowledgeAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all });
    },
  });
}

// Customers Hooks
export function useCustomers(page = 1, pageSize = 20, tier?: string) {
  return useQuery({
    queryKey: queryKeys.customers.list(page, tier),
    queryFn: () => api.getCustomers(page, pageSize, tier),
    staleTime: 60000,
  });
}

export function useCustomerDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => api.getCustomerById(id),
    enabled: !!id,
  });
}

// Chat Hooks
export function useSendChatMessage() {
  return useMutation({
    mutationFn: (request: ChatRequest) => api.sendChatMessage(request),
  });
}

// Search Hooks
export function useSemanticSearch(query: string, limit = 10) {
  return useQuery({
    queryKey: queryKeys.search.semantic(query),
    queryFn: () => api.semanticSearch(query, limit),
    enabled: query.length > 2,
    staleTime: 300000,
  });
}
