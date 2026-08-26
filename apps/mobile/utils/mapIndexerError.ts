/**
 * Maps typed indexer / API failures to the retryable mobile UI error shape
 * consumed by ErrorState (title, message, status badge).
 *
 * Network (unreachable / timeout), auth (401/403), and not-found (404)
 * failures previously surfaced inconsistently across pool hooks. This helper
 * is the single source of truth so every load path produces a stable
 * IndexerErrorCode that ErrorState can render.
 */

import { IndexerError } from "../../../packages/sdk/src/errors";
import type { IndexerErrorCode } from "../components/states/ErrorState";

/** Status codes the ErrorState component knows how to badge and message. */
export const RENDERABLE_ERROR_CODES: ReadonlySet<IndexerErrorCode> = new Set([
  400, 401, 403, 404, 429, 500, 502, 503, 504,
]);

/**
 * Clamp an arbitrary status (including IndexerError's 0 for network/abort)
 * into a code ErrorState can display. Unknown / network codes become 503
 * so the UI shows "Service unavailable" with a retry action.
 */
export function clampStatusCode(raw: number | undefined): IndexerErrorCode {
  if (typeof raw === "number" && RENDERABLE_ERROR_CODES.has(raw as IndexerErrorCode)) {
    return raw as IndexerErrorCode;
  }
  // status 0 (network / timeout / abort) and any other non-renderable code
  // map to 503 — retryable "temporarily unreachable".
  return 503;
}

export interface MappedIndexerError {
  message: string;
  statusCode: IndexerErrorCode;
}

/**
 * Resolve any thrown value from a pool (or other indexer) load into a
 * stable message + statusCode pair for ErrorState.
 */
export function mapIndexerError(
  err: unknown,
  fallbackMessage: string
): MappedIndexerError {
  if (err instanceof IndexerError) {
    return {
      message: err.message || fallbackMessage,
      statusCode: clampStatusCode(err.statusCode),
    };
  }

  return {
    message: fallbackMessage,
    statusCode: 503,
  };
}
