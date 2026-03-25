import { api } from "@/lib/api";

export interface Reporter {
  id: string;
  agentId?: string;
  operationId?: string;
  name: string;
  pageId?: string;
  pageUrl?: string;
  status: "active" | "polling" | "idle" | "paused" | "error";
  lastPollAt?: string;
  pollIntervalMs: number;
  polledData?: any;
  config?: any;
  totalPolls: number;
  totalQuestions: number;
  totalTasks: number;
  metadata?: any;
  tags?: string[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReporterQuestion {
  id: string;
  reporterId: string;
  operationId?: string;
  question: string;
  context?: any;
  priority: number;
  status: "pending" | "answered" | "dismissed" | "escalated";
  response?: string;
  respondedBy?: string;
  respondedAt?: string;
  createdAt: string;
}

export interface ReporterTask {
  id: string;
  reporterId: string;
  operationId?: string;
  taskName: string;
  taskDescription?: string;
  taskType?: string;
  priority: number;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
  startedAt?: string;
  completedAt?: string;
  result?: any;
  errorMessage?: string;
  createdAt: string;
}

export const reportersService = {
  // List reporters
  list: (options?: { signal?: AbortSignal; operationId?: string; status?: string }) => {
    const params: Record<string, string> = {};
    if (options?.operationId) params.operationId = options.operationId;
    if (options?.status) params.status = options.status;
    return api.get<{ reporters: Reporter[] }>("/reporters", { params, signal: options?.signal });
  },

  // Get single reporter
  get: (id: string) =>
    api.get<{ reporter: Reporter }>(`/reporters/${id}`),

  // Create reporter
  create: (data: {
    name: string;
    operationId?: string;
    pageId?: string;
    pageUrl?: string;
    pollIntervalMs?: number;
    config?: any;
    tags?: string[];
  }) => api.post<{ reporter: Reporter }>("/reporters", data),

  // Delete reporter
  delete: (id: string) =>
    api.delete(`/reporters/${id}`),

  // Start polling
  start: (id: string) =>
    api.post<{ message: string }>(`/reporters/${id}/start`),

  // Stop polling
  stop: (id: string) =>
    api.post<{ message: string }>(`/reporters/${id}/stop`),

  // Trigger immediate poll
  poll: (id: string) =>
    api.post<{ data: any }>(`/reporters/${id}/poll`),

  // Get status
  getStatus: (id: string) =>
    api.get<{ reporter: Reporter; pendingQuestions: number; pendingTasks: number }>(`/reporters/${id}/status`),

  // List questions for reporter
  listQuestions: (reporterId: string, options?: { signal?: AbortSignal; status?: string }) => {
    const params: Record<string, string> = {};
    if (options?.status) params.status = options.status;
    return api.get<{ questions: ReporterQuestion[] }>(`/reporters/${reporterId}/questions`, { params, signal: options?.signal });
  },

  // Get all pending questions
  listPendingQuestions: (options?: { signal?: AbortSignal; operationId?: string }) => {
    const params: Record<string, string> = {};
    if (options?.operationId) params.operationId = options.operationId;
    return api.get<{ questions: ReporterQuestion[] }>("/reporters/questions/pending", { params, signal: options?.signal });
  },

  // Respond to question
  respondToQuestion: (questionId: string, response: string) =>
    api.put<{ question: ReporterQuestion }>(`/reporters/questions/${questionId}/respond`, { response }),

  // List tasks for reporter
  listTasks: (reporterId: string, options?: { signal?: AbortSignal; status?: string }) => {
    const params: Record<string, string> = {};
    if (options?.status) params.status = options.status;
    return api.get<{ tasks: ReporterTask[] }>(`/reporters/${reporterId}/tasks`, { params, signal: options?.signal });
  },

  // Create task for reporter
  createTask: (reporterId: string, data: {
    taskName: string;
    taskDescription?: string;
    taskType?: string;
    instructions?: string;
    priority?: number;
  }) => api.post<{ task: ReporterTask }>(`/reporters/${reporterId}/tasks`, data),

  // Update task status
  updateTaskStatus: (taskId: string, status: string) =>
    api.put<{ task: ReporterTask }>(`/reporters/tasks/${taskId}/status`, { status }),
};
