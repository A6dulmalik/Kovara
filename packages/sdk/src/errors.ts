/*
 * Typed errors thrown by the indexer client and Kovara SDK helpers.
 */
export class IndexerError extends Error {
  readonly statusCode: number;
  readonly cause?: unknown;

  constructor(message: string, statusCode = 0, cause?: unknown) {
    super(message);
    this.name = "IndexerError";
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

/**
 * Map an HTTP status + optional body snippet into an IndexerError.
 */
export function mapHttpError(status: number, bodySnippet?: string): IndexerError {
  const detail = bodySnippet?.trim() ? `: ${bodySnippet.trim().slice(0, 200)}` : "";
  switch (status) {
    case 400:
      return new IndexerError(`Bad request${detail}`, 400);
    case 401:
      return new IndexerError(`Unauthorized${detail}`, 401);
    case 403:
      return new IndexerError(`Forbidden${detail}`, 403);
    case 404:
      return new IndexerError(`Not found${detail}`, 404);
    case 429:
      return new IndexerError(`Too many requests${detail}`, 429);
    case 502:
      return new IndexerError(`Bad gateway${detail}`, 502);
    case 503:
      return new IndexerError(`Service unavailable${detail}`, 503);
    case 504:
      return new IndexerError(`Gateway timeout${detail}`, 504);
    default:
      if (status >= 500) {
        return new IndexerError(`Server error (${status})${detail}`, status);
      }
      return new IndexerError(`Request failed (${status})${detail}`, status);
  }
}

/**
 * Thrown when a reward amount is invalid (e.g. outside configured bounds).
 */
export class RewardAmountError extends Error {
  readonly amount: number;
  readonly min?: number;
  readonly max?: number;
  readonly cause?: unknown;

  constructor(amount: number, min?: number, max?: number, cause?: unknown) {
    const range = min !== undefined && max !== undefined ? `( allowed: ${min}-${max})` : "";
    const message = `Reward amount ${amount} is invalid${range}`;
    super(message);
    this.name = "RewardAmountError";
    this.amount = amount;
    this.min = min;
    this.max = max;
    this.cause = cause;
  }
}

/**
 * Thrown when the treasury balance is insufficient to cover a reward payout.
 */
export class InsufficientFundsError extends Error {
  readonly required: number;
  readonly available: number;
  readonly cause?: unknown;

  constructor(required: number, available: number, cause?: unknown) {
    const message = `Insufficient funds: required ${required}, available ${available}`;
    super(message);
    this.name = "InsufficientFundsError";
    this.required = required;
    this.available = available;
    this.cause = cause;
  }
}
