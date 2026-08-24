/**
 * BE-34: Reusable retry utility for transient database and stream errors.
 *
 * Wraps an async operation with bounded exponential-backoff retries.
 * Only errors matching the supplied predicate are retried; all others
 * propagate immediately.
 */

export interface RetryOptions {
  /** Maximum number of total attempts (including the first one). Default: 3 */
  maxAttempts?: number;
  /** Base delay in ms before the first retry. Default: 300 */
  baseDelayMs?: number;
  /** Multiplier applied to the delay after each failure. Default: 2 */
  backoffMultiplier?: number;
  /** Predicate that returns true if the error is retryable. Default: all errors */
  isRetryable?: (error: unknown) => boolean;
  /** Label used in log messages to identify the operation. */
  operationLabel?: string;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Execute `fn` with bounded retries.
 *
 * @throws The last error when all attempts are exhausted.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 300,
    backoffMultiplier = 2,
    isRetryable = () => true,
    operationLabel = "operation",
  } = opts;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isLastAttempt = attempt >= maxAttempts;
      const retryable = isRetryable(err);

      if (isLastAttempt || !retryable) {
        break;
      }

      const delay = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);
      console.warn(
        `[retry] ${operationLabel} failed (attempt ${attempt}/${maxAttempts}): ${err instanceof Error ? err.message : String(err)}. Retrying in ${delay}ms…`
      );
      await sleep(delay);
    }
  }

  console.error(
    `[retry] ${operationLabel} failed after ${maxAttempts} attempt(s): ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
  throw lastError;
}
