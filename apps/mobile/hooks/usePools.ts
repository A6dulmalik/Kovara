import { useState, useEffect, useCallback, useRef } from "react";
import type { Pool } from "../../../packages/sdk/src/types";
import { IndexerError } from "../../../packages/sdk/src/errors";
import type { IndexerErrorCode } from "../components/states/ErrorState";
import { mapIndexerError } from "../utils/mapIndexerError";

const MOCK_POOLS: Pool[] = [
  {
    pool_id: "pool-1",
    token: "USDC",
    balance: BigInt("50000"),
    admins: ["GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
    threshold: 1,
  },
  {
    pool_id: "pool-2",
    token: "EUR",
    balance: BigInt("100000"),
    admins: [
      "GXYZ9876543210ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      "GDEF5678901234ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    ],
    threshold: 2,
  },
  {
    pool_id: "pool-3",
    token: "BRL",
    balance: BigInt("25000"),
    admins: ["GHIJ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
    threshold: 1,
  },
];

/** Simulated indexer fetch that respects AbortSignal (MO-002). */
function fetchPoolsMock(signal?: AbortSignal): Promise<Pool[]> {
  return new Promise<Pool[]>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new IndexerError("Indexer request was aborted or timed out", 0));
      return;
    }

    const timer = setTimeout(() => {
      if (signal?.aborted) {
        reject(new IndexerError("Indexer request was aborted or timed out", 0));
        return;
      }
      resolve(MOCK_POOLS);
    }, 300);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new IndexerError("Indexer request was aborted or timed out", 0));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export interface UsePoolsReturn {
  pools: Pool[];
  loading: boolean;
  error: string | null;
  errorCode: IndexerErrorCode | undefined;
  refresh: () => void;
}

export function usePools(): UsePoolsReturn {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<IndexerErrorCode | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  const loadPools = useCallback(async () => {
    // Cancel any in-flight request before starting a new one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setErrorCode(undefined);

    try {
      const result = await fetchPoolsMock(controller.signal);
      if (controller.signal.aborted) return;
      setPools(result);
    } catch (err) {
      // Ignore abort errors from unmount / superseded loads — not user-facing.
      if (controller.signal.aborted) return;
      if (err instanceof IndexerError && err.statusCode === 0 && /abort/i.test(err.message)) {
        return;
      }
      const mapped = mapIndexerError(err, "Failed to load pools. Please try again.");
      setErrorCode(mapped.statusCode);
      setError(mapped.message);
      setPools([]);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadPools();
    return () => {
      // MO-002: cancel on unmount so the artificial timeout cannot fire after unmount.
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [loadPools]);

  const refresh = useCallback(() => {
    void loadPools();
  }, [loadPools]);

  return { pools, loading, error, errorCode, refresh };
}
