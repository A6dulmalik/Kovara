import { useState, useEffect, useCallback } from "react";
import type { Pool } from "../utils/indexerClient";
import { getPoolById } from "../utils/indexerClient";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Pool } from "../../../packages/sdk/src/types";
import { IndexerError } from "../../../packages/sdk/src/errors";
import type { IndexerErrorCode } from "../components/states/ErrorState";
import { mapIndexerError } from "../utils/mapIndexerError";

const RENDERABLE_ERROR_CODES: ReadonlySet<IndexerErrorCode> = new Set([
  400, 401, 403, 404, 429, 500, 502, 503, 504,
]);

function clampStatusCode(raw: number | undefined): IndexerErrorCode {
  if (typeof raw === "number" && RENDERABLE_ERROR_CODES.has(raw as IndexerErrorCode)) {
    return raw as IndexerErrorCode;
  }
  return 500;
}

/** Simulated single-pool fetch that respects AbortSignal (MO-002). */
function fetchPoolMock(poolId: string, signal?: AbortSignal): Promise<Pool | null> {
  return new Promise<Pool | null>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new IndexerError("Indexer request was aborted or timed out", 0));
      return;
    }

    const timer = setTimeout(() => {
      if (signal?.aborted) {
        reject(new IndexerError("Indexer request was aborted or timed out", 0));
        return;
      }
      resolve(MOCK_POOLS[poolId] ?? null);
    }, 300);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new IndexerError("Indexer request was aborted or timed out", 0));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export interface UsePoolReturn {
  pool: Pool | null;
  loading: boolean;
  error: string | null;
  errorCode: IndexerErrorCode | undefined;
  isAdmin: (address: string) => boolean;
  refresh: () => void;
}

/**
 * Load a single pool from the configured indexer backend.
 * Missing / empty IDs surface a 404 without hitting the network.
 */
export function usePool(poolId: string): UsePoolReturn {
  const [pool, setPool] = useState<Pool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<IndexerErrorCode | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  const loadPool = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setErrorCode(undefined);

    const id = String(poolId ?? "").trim();
    if (!id) {
      setPool(null);
      setErrorCode(404);
      setError("Pool not found");
      setLoading(false);
      return;
    }

    try {
      const foundPool = await getPoolById(id);
      if (!foundPool) {
        setPool(null);
        setErrorCode(404);
        setError("Pool not found");
      const foundPool = await fetchPoolMock(poolId, controller.signal);
      if (controller.signal.aborted) return;

      if (!foundPool) {
        // Typed not-found → ErrorState "Not found" + retry (MO-004).
        setErrorCode(404);
        setError("Pool not found");
        setPool(null);
        return;
      }
      setPool(foundPool);
    } catch (err) {
      setPool(null);
      if (err instanceof IndexerError) {
        setErrorCode(clampStatusCode(err.statusCode));
        setError(err.message);
      } else {
        setError("Failed to load pool. Please try again.");
        setErrorCode(500);
      if (controller.signal.aborted) return;
      if (err instanceof IndexerError && err.statusCode === 0 && /abort/i.test(err.message)) {
        return;
      }
      const mapped = mapIndexerError(err, "Failed to load pool. Please try again.");
      setErrorCode(mapped.statusCode);
      setError(mapped.message);
      setPool(null);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [poolId]);

  useEffect(() => {
    void loadPool();
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [loadPool]);

  const isAdmin = useCallback(
    (address: string) => {
      return pool?.admins.includes(address) ?? false;
    },
    [pool]
  );

  const refresh = useCallback(() => {
    void loadPool();
  }, [loadPool]);

  return { pool, loading, error, errorCode, isAdmin, refresh };
}
