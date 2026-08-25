import { useState, useEffect, useCallback } from "react";
import type { Pool } from "../utils/indexerClient";
import { getPoolById } from "../utils/indexerClient";
import { IndexerError } from "../../../packages/sdk/src/errors";
import type { IndexerErrorCode } from "../components/states/ErrorState";

const RENDERABLE_ERROR_CODES: ReadonlySet<IndexerErrorCode> = new Set([
  400, 401, 403, 404, 429, 500, 502, 503, 504,
]);

function clampStatusCode(raw: number | undefined): IndexerErrorCode {
  if (typeof raw === "number" && RENDERABLE_ERROR_CODES.has(raw as IndexerErrorCode)) {
    return raw as IndexerErrorCode;
  }
  return 500;
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

  const loadPool = useCallback(async () => {
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
      }
    } finally {
      setLoading(false);
    }
  }, [poolId]);

  useEffect(() => {
    loadPool();
  }, [loadPool]);

  const isAdmin = useCallback(
    (address: string) => {
      return pool?.admins.includes(address) ?? false;
    },
    [pool]
  );

  const refresh = useCallback(() => {
    loadPool();
  }, [loadPool]);

  return { pool, loading, error, errorCode, isAdmin, refresh };
}
