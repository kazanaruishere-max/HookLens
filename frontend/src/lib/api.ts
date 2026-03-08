/**
 * API Client — Typed fetch wrapper for backend communication
 */
import { useAuthStore } from '@/stores/auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new ApiError(401, 'Session expired');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, data.error || 'Request failed');
  }

  return data as T;
}

// Auth
export const authApi = {
  signup: (data: { email: string; password: string; name: string }) =>
    apiFetch<{ user: { id: string; email: string; name: string; plan: string }; token: string }>('/auth/signup', { method: 'POST', body: data }),

  login: (data: { email: string; password: string }) =>
    apiFetch<{ user: { id: string; email: string; name: string; plan: string; avatarUrl: string | null }; token: string }>('/auth/login', { method: 'POST', body: data }),

  me: () =>
    apiFetch<{ user: { id: string; email: string; name: string; plan: string; avatarUrl: string | null } }>('/auth/me'),
};

// Endpoints
export const endpointApi = {
  list: () =>
    apiFetch<{ endpoints: Endpoint[]; total: number }>('/api/endpoints'),

  get: (id: string) =>
    apiFetch<Endpoint>(`/api/endpoints/${id}`),

  create: (data: { name: string; provider?: string; signingSecret?: string; description?: string }) =>
    apiFetch<Endpoint>('/api/endpoints', { method: 'POST', body: data }),

  update: (id: string, data: Partial<{ name: string; provider: string; signingSecret: string; active: boolean }>) =>
    apiFetch('/api/endpoints/' + id, { method: 'PATCH', body: data }),

  delete: (id: string) =>
    apiFetch('/api/endpoints/' + id, { method: 'DELETE' }),
};

// Webhooks
export const webhookApi = {
  list: (endpointId: string, page = 1, limit = 20) =>
    apiFetch<{ webhooks: WebhookSummary[]; pagination: Pagination }>(`/api/webhooks?endpointId=${endpointId}&page=${page}&limit=${limit}`),

  get: (id: string) =>
    apiFetch<{ webhook: Webhook }>(`/api/webhooks/${id}`),

  analyze: (id: string) =>
    apiFetch<{ webhookId: string; analysis: AIAnalysis; analyzedAt: string }>(`/api/webhooks/${id}/analyze`, { method: 'POST' }),

  forward: (id: string, targetUrl: string) =>
    apiFetch<{ status: number; responseBody: string; responseTime: number }>(`/api/webhooks/${id}/forward`, { method: 'POST', body: { targetUrl } }),

  share: (id: string) =>
    apiFetch<{ shareToken: string; shareUrl: string }>(`/api/webhooks/${id}/share`, { method: 'POST' }),

  export: (id: string, format: 'curl' | 'json') =>
    apiFetch<{ format: string; content: string }>(`/api/webhooks/${id}/export?format=${format}`),
};

// Types
export interface Endpoint {
  id: string;
  slug: string;
  url: string;
  name: string;
  provider: string | null;
  description: string | null;
  active: boolean;
  webhookCount: number;
  lastWebhookAt: string | null;
  createdAt: string;
}

export interface WebhookSummary {
  id: string;
  endpointId: string;
  provider: string | null;
  eventType: string | null;
  method: string;
  responseCode: number | null;
  responseTimeMs: number | null;
  signatureValid: boolean | null;
  aiAnalyzed: boolean;
  forwarded: boolean;
  shared: boolean;
  createdAt: string;
}

export interface Webhook extends WebhookSummary {
  headers: Record<string, string>;
  payload: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  responseBody: string | null;
  signatureHeader: string | null;
  signatureAlgorithm: string | null;
  expectedSignature: string | null;
  receivedSignature: string | null;
  aiInsights: AIAnalysis | null;
  shareToken: string | null;
}

export interface AIAnalysis {
  status: 'success' | 'warning' | 'error';
  summary: string;
  issues: string[];
  rootCause: string | null;
  suggestions: Array<{
    title: string;
    description: string;
    code?: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  relatedDocs: string[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
