/**
 * API Retry Mechanism with Exponential Backoff
 * Automatically retries failed API calls for transient errors
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** HTTP methods to retry (default: GET only) */
  retryMethods?: string[];
  /** HTTP status codes to retry (default: 408, 429, 500, 502, 503, 504) */
  retryStatusCodes?: number[];
  /** Callback for retry attempts */
  onRetry?: (attempt: number, error: any) => void;
}

const defaultOptions: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryMethods: ["GET", "HEAD", "OPTIONS"],
  retryStatusCodes: [408, 429, 500, 502, 503, 504],
  onRetry: () => {},
};

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any, options: Required<RetryOptions>): boolean {
  // Network errors are retryable
  if (error.code === "ECONNREFUSED" ||
      error.code === "ETIMEDOUT" ||
      error.code === "ERR_NETWORK" ||
      error.message?.includes("Network Error")) {
    return true;
  }

  // Check HTTP status code
  const status = error.status || error.response?.status;
  if (status && options.retryStatusCodes.includes(status)) {
    return true;
  }

  return false;
}

/**
 * Calculate delay for next retry using exponential backoff with jitter
 */
function getRetryDelay(attempt: number, options: Required<RetryOptions>): number {
  const exponentialDelay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, options.maxDelay);
  // Add jitter (random ±25%)
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.floor(cappedDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a fetch request with exponential backoff
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  const options: Required<RetryOptions> = { ...defaultOptions, ...retryOptions };
  const method = init?.method?.toUpperCase() || "GET";

  // Check if method is retryable
  if (!options.retryMethods.includes(method)) {
    return fetch(url, init);
  }

  let lastError: any;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      const response = await fetch(url, init);

      // If response is OK or error is not retryable, return it
      if (response.ok || !isRetryableError({ status: response.status }, options)) {
        return response;
      }

      // Clone response for retry check (can only read body once)
      const clonedResponse = response.clone();
      lastError = { status: response.status, response: clonedResponse };

    } catch (error: any) {
      lastError = error;

      // If error is not retryable or this is the last attempt, throw it
      if (!isRetryableError(error, options) || attempt === options.maxRetries) {
        throw error;
      }
    }

    // If we're here, we should retry
    if (attempt < options.maxRetries) {
      const delay = getRetryDelay(attempt + 1, options);
      options.onRetry(attempt + 1, lastError);
      await sleep(delay);
    }
  }

  // All retries exhausted
  throw lastError || new Error("Max retries exceeded");
}

/**
 * Wrap an async function with retry logic
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  retryOptions?: RetryOptions
): T {
  const options: Required<RetryOptions> = { ...defaultOptions, ...retryOptions };

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    let lastError: any;

    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (error: any) {
        lastError = error;

        // If error is not retryable or this is the last attempt, throw it
        if (!isRetryableError(error, options) || attempt === options.maxRetries) {
          throw error;
        }

        // Retry with exponential backoff
        const delay = getRetryDelay(attempt + 1, options);
        options.onRetry(attempt + 1, error);
        await sleep(delay);
      }
    }

    throw lastError || new Error("Max retries exceeded");
  }) as T;
}

/**
 * Create a retryable version of the fetch function
 */
export function createRetryableFetch(retryOptions?: RetryOptions) {
  return (url: string, init?: RequestInit) => fetchWithRetry(url, init, retryOptions);
}
