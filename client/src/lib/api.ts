/**
 * API Client for RTPI
 * Base fetch wrapper with authentication and error handling
 */

const API_BASE = "/api/v1";

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = "APIError";
  }
}

export async function fetchWithAuth<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorData;

    try {
      errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // If response is not JSON, use default message
    }

    throw new APIError(errorMessage, response.status, errorData);
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
