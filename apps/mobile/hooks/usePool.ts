import { useState, useEffect, useCallback, useRef } from "react";
import type { Pool } from "../../../packages/sdk/src/types";
import { IndexerError } from "../../../packages/sdk/src/errors";
import type { IndexerErrorCode } from "../components/states/ErrorState";
import { mapIndexerError } from "../utils/mapIndexerError";

const MOCK_POOLS: Record<string, Pool> = {
  "pool-1": {
    pool_id: "pool-1",
    token: "USDC",
    balance: BigInt("50000"),
    admins: ["GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
    threshold: 1,
  },
  "pool-2": {
    pool_id: "pool-2",
    token: "EUR",
    balance: BigInt("100000"),
    admins: [
      "GXYZ9876543210ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      "GDEF5678901234ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    ],
    threshold: 2,
  },
  "pool-3": {
    pool_id: "pool-3",
    token: "BRL",
    balance: BigInt("25000"),
    admins: ["GHIJ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
    threshold: 1,
  },
};

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

    try {
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
