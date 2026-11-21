import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type {
  ActivityItem,
  Comment,
  Dashboard,
  Issue,
  IssueFilters,
  IssuePayload,
  Member,
  Paginated,
  Project,
  ProjectStats,
  User,
} from '@/types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: {
    pagination?: Paginated<unknown>['pagination'];
    total?: number;
  };
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, string[]>;

  constructor(message: string, status: number, code: string, details?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const http: AxiosInstance = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

function normaliseError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const axiosError = error as AxiosError<{
    error?: { message?: string; code?: string; details?: Record<string, string[]> };
  }>;

  if (axiosError.response) {
    const payload = axiosError.response.data;
    return new ApiError(
      payload?.error?.message ?? `Request failed with status ${axiosError.response.status}`,
      axiosError.response.status,
      payload?.error?.code ?? 'ERROR',
      payload?.error?.details,
    );
  }
  if (axiosError.code === 'ECONNABORTED') {
    return new ApiError('The request timed out. Please try again.', 408, 'TIMEOUT');
  }
  return new ApiError(
    'Cannot reach the IssueTrack API. Check your connection and that the server is running.',
    0,
    'NETWORK_ERROR',
  );
}

http.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normaliseError(error)),
);

async function request<T>(
  config: AxiosRequestConfig,
): Promise<{ data: T; meta?: ApiEnvelope<T>['meta'] }> {
  const response = await http.request<ApiEnvelope<T>>(config);
  return { data: response.data.data, meta: response.data.meta };
}

/** Serialises filter objects into query params, dropping empty values. */
export function toQueryParams(filters: Record<string, unknown>): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((v) => params.append(key, String(v)));
    } else {
      params.append(key, String(value));
    }
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  auth: {
    register: (payload: { name: string; email: string; password: string }) =>
      request<{ user: User; token: string }>({
        method: 'POST',
        url: '/auth/register',
        data: payload,
      }),
    login: (payload: { email: string; password: string }) =>
      request<{ user: User; token: string }>({ method: 'POST', url: '/auth/login', data: payload }),
    logout: () => request<{ message: string }>({ method: 'POST', url: '/auth/logout' }),
    me: () => request<{ user: User }>({ method: 'GET', url: '/auth/me' }),
  },
  users: {
    updateProfile: (payload: {
      name?: string;
      avatarUrl?: string | null;
      currentPassword?: string;
      newPassword?: string;
    }) => request<{ user: User }>({ method: 'PATCH', url: '/users/me', data: payload }),
    lookup: (email: string) =>
      request<{ user: User | null }>({
        method: 'GET',
        url: `/users/lookup?email=${encodeURIComponent(email)}`,
      }),
    search: (q: string) =>
      request<{ users: User[] }>({
        method: 'GET',
        url: `/users/search?q=${encodeURIComponent(q)}`,
      }),
  },
  dashboard: {
    get: () => request<Dashboard>({ method: 'GET', url: '/dashboard' }),
  },
  projects: {
    list: () => request<Project[]>({ method: 'GET', url: '/projects' }),
    get: (id: string) => request<Project>({ method: 'GET', url: `/projects/${id}` }),
    create: (payload: { name: string; key: string; description?: string }) =>
      request<Project>({ method: 'POST', url: '/projects', data: payload }),
    update: (id: string, payload: { name?: string; description?: string }) =>
      request<Project>({ method: 'PATCH', url: `/projects/${id}`, data: payload }),
    remove: (id: string) =>
      request<{ message: string }>({ method: 'DELETE', url: `/projects/${id}` }),
    stats: (id: string) => request<ProjectStats>({ method: 'GET', url: `/projects/${id}/stats` }),
    activity: (id: string, limit = 30) =>
      request<ActivityItem[]>({ method: 'GET', url: `/projects/${id}/activity?limit=${limit}` }),
    labels: (id: string) => request<string[]>({ method: 'GET', url: `/projects/${id}/labels` }),
    members: {
      list: (id: string) =>
        request<{ members: Member[]; owner: User | null; canManage: boolean }>({
          method: 'GET',
          url: `/projects/${id}/members`,
        }),
      add: (id: string, payload: { email: string; role: string }) =>
        request<Project>({ method: 'POST', url: `/projects/${id}/members`, data: payload }),
      updateRole: (id: string, userId: string, role: string) =>
        request<Project>({
          method: 'PATCH',
          url: `/projects/${id}/members/${userId}`,
          data: { role },
        }),
      remove: (id: string, userId: string) =>
        request<Project>({ method: 'DELETE', url: `/projects/${id}/members/${userId}` }),
    },
  },
  issues: {
    list: async (filters: IssueFilters & { projectId?: string }): Promise<Paginated<Issue>> => {
      const { projectId, ...rest } = filters;
      const url = projectId ? `/projects/${projectId}/issues` : '/issues';
      const { data, meta } = await request<Issue[]>({
        method: 'GET',
        url: `${url}${toQueryParams(rest)}`,
      });
      return {
        items: data,
        pagination: meta?.pagination ?? {
          page: 1,
          limit: data.length,
          total: data.length,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    },
    board: async (projectId: string, filters: IssueFilters = {}): Promise<Issue[]> => {
      const payload = await request<Issue[]>({
        method: 'GET',
        url: `/projects/${projectId}/issues/board${toQueryParams({ ...filters, page: undefined, limit: undefined })}`,
      });
      return payload.data;
    },
    get: (id: string) => request<Issue>({ method: 'GET', url: `/issues/${id}` }),
    create: (projectId: string, payload: IssuePayload) =>
      request<Issue>({ method: 'POST', url: `/projects/${projectId}/issues`, data: payload }),
    update: (id: string, payload: Partial<IssuePayload>) =>
      request<Issue>({ method: 'PATCH', url: `/issues/${id}`, data: payload }),
    updateStatus: (id: string, status: string) =>
      request<Issue>({ method: 'PATCH', url: `/issues/${id}/status`, data: { status } }),
    assign: (id: string, assignee: string | null) =>
      request<Issue>({ method: 'PATCH', url: `/issues/${id}/assignee`, data: { assignee } }),
    remove: (id: string) =>
      request<{ message: string }>({ method: 'DELETE', url: `/issues/${id}` }),
    activity: (id: string) =>
      request<ActivityItem[]>({ method: 'GET', url: `/issues/${id}/activity` }),
    comments: {
      list: (id: string) => request<Comment[]>({ method: 'GET', url: `/issues/${id}/comments` }),
      create: (id: string, content: string) =>
        request<Comment>({ method: 'POST', url: `/issues/${id}/comments`, data: { content } }),
      update: (id: string, commentId: string, content: string) =>
        request<Comment>({
          method: 'PATCH',
          url: `/issues/${id}/comments/${commentId}`,
          data: { content },
        }),
      remove: (id: string, commentId: string) =>
        request<{ message: string }>({
          method: 'DELETE',
          url: `/issues/${id}/comments/${commentId}`,
        }),
    },
    attachments: {
      upload: async (id: string, files: File[]) => {
        const formData = new FormData();
        files.forEach((file) => formData.append('files', file));
        return request<Issue>({
          method: 'POST',
          url: `/issues/${id}/attachments`,
          data: formData,
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      },
      remove: (id: string, attachmentId: string) =>
        request<Issue>({ method: 'DELETE', url: `/issues/${id}/attachments/${attachmentId}` }),
    },
  },
};

export { API_BASE };
