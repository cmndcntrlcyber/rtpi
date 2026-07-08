import { createLogger } from "./logger";

const log = createLogger("retry");

export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  label: string;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const { maxRetries, initialDelayMs, maxDelayMs, label } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) break;

      const baseDelay = Math.min(initialDelayMs * 2 ** attempt, maxDelayMs);
      const jitter = baseDelay * 0.2 * Math.random();
      const delay = Math.round(baseDelay + jitter);

      log.warn(
        { attempt: attempt + 1, maxRetries, delayMs: delay, err },
        `${label}: attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
