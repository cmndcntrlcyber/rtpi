/**
 * API Client for RTPI
 * Base fetch wrapper with authentication, error handling, and retry logic
 */

import { fetchWithRetry } from "@/utils/api-retry";
import { getFriendlyError } from "@/utils/errors";

const API_BASE = "/api/v1";

// Session refresh tracking
let lastActivity = Date.now();
let sessionRefreshTimer: NodeJS.Timeout | null = null;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const SESSION_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any,
    public code?: string
  ) {
    super(message);
    this.name = "APIError";

    // Add friendly error details
    const friendly = getFriendlyError(this);
    this.friendlyTitle = friendly.title;
    this.friendlyMessage = friendly.message;
    this.suggestion = friendly.suggestion;
  }

  friendlyTitle?: string;
  friendlyMessage?: string;
  suggestion?: string;
}

/**
 * Keep session alive by periodically refreshing it
 */
function startSessionRefresh() {
  // Clear existing timer
  if (sessionRefreshTimer) {
    clearInterval(sessionRefreshTimer);
  }

  // Set up periodic session refresh
  sessionRefreshTimer = setInterval(async () => {
    const timeSinceActivity = Date.now() - lastActivity;

    // Only refresh if there's been recent activity
    if (timeSinceActivity < SESSION_REFRESH_INTERVAL) {
      try {
        await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
      } catch (error) {
        // Session refresh error handled
      }
    }
  }, SESSION_REFRESH_INTERVAL);
}

/**
 * Update last activity timestamp
 */
function updateActivity() {
  lastActivity = Date.now();
}

/**
 * Initialize session management
 */
export function initializeSessionManagement() {
  startSessionRefresh();

  // Track user activity
  if (typeof window !== "undefined") {
    ["mousedown", "keydown", "scroll", "touchstart"].forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
    });
  }
}

export async function fetchWithAuth<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  updateActivity();

  const method = options.method?.toUpperCase() || "GET";
  const shouldRetry = ["GET", "HEAD", "OPTIONS"].includes(method);

  let response: Response;

  if (shouldRetry) {
    // Use retry logic for safe methods
    response = await fetchWithRetry(
      `${API_BASE}${url}`,
      {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      },
      {
        maxRetries: 3,
        onRetry: (attempt) => {
          console.log(`Retrying request (attempt ${attempt}): ${method} ${url}`);
        },
      }
    );
  } else {
    // No retry for non-safe methods (POST, PUT, DELETE, etc.)
    response = await fetch(`${API_BASE}${url}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorData;
    let errorCode;

    try {
      errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
      errorCode = errorData.code;
    } catch {
      // If response is not JSON, use default message
    }

    // Special handling for 401 Unauthorized
    if (response.status === 401) {
      // Dispatch event for global logout handling
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      }
    }

    throw new APIError(errorMessage, response.status, errorData, errorCode);
  }

  return response.json();
}

// HTTP method helpers
export const api = {
  get: <T = any>(url: string) => fetchWithAuth<T>(url),

  post: <T = any>(url: string, data?: any) =>
    fetchWithAuth<T>(url, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T = any>(url: string, data?: any) =>
    fetchWithAuth<T>(url, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T = any>(url: string, data?: any) =>
    fetchWithAuth<T>(url, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T = any>(url: string) =>
    fetchWithAuth<T>(url, {
      method: "DELETE",
    }),
};
