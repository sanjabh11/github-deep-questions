interface RetryOptions {
  maxAttempts?: number;
  backoffMs?: number;
  maxBackoffMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const defaultOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  backoffMs: 1000,
  maxBackoffMs: 10000,
  shouldRetry: (error: unknown) => {
    // Retry on network errors and 5xx server errors
    if (error instanceof Error) {
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        return true;
      }
      if (error.name === 'ApiError' && error.message.includes('status: 5')) {
        return true;
      }
    }
    return false;
  }
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: unknown;
  let attempt = 1;
  let backoff = opts.backoffMs;

  while (attempt <= opts.maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxAttempts || !opts.shouldRetry(error)) {
        break;
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, backoff));

      // Exponential backoff with jitter
      backoff = Math.min(
        backoff * 2 * (0.5 + Math.random()),
        opts.maxBackoffMs
      );
      attempt++;
    }
  }

  throw lastError;
} 