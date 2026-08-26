import { useState, useEffect, useCallback, useRef } from "react";
import type { Pool } from "../utils/indexerClient";
import { listPools as fetchPoolsFromIndexer } from "../utils/indexerClient";
import type { Pool } from "../../../packages/sdk/src/types";
import { IndexerError } from "../../../packages/sdk/src/errors";
import type { IndexerErrorCode } from "../components/states/ErrorState";
import { mapIndexerError } from "../utils/mapIndexerError";

const PAGE_SIZE = 20;

const RENDERABLE_ERROR_CODES: ReadonlySet<IndexerErrorCode> = new Set([
  400, 401, 403, 404, 429, 500, 502, 503, 504,
]);

function clampStatusCode(raw: number | undefined): IndexerErrorCode {
  if (typeof raw === "number" && RENDERABLE_ERROR_CODES.has(raw as IndexerErrorCode)) {
    return raw as IndexerErrorCode;
  }
  return 500;
}

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
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

/**
 * Paginated pool list backed by the indexer API.
 * Additional pages append without duplicates; hasMore reflects end-of-list.
 */
export function usePools(): UsePoolsReturn {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<IndexerErrorCode | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const load = useCallback(async (offset: number, replace: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
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
      const { pools: fetched, hasMore: more } = await fetchPoolsFromIndexer(PAGE_SIZE, offset, {});

      setPools((prev) => {
        if (replace) {
          seenIdsRef.current = new Set(fetched.map((p) => p.pool_id));
          return fetched;
        }

        const next = [...prev];
        for (const pool of fetched) {
          if (!seenIdsRef.current.has(pool.pool_id)) {
            seenIdsRef.current.add(pool.pool_id);
            next.push(pool);
          }
        }
        return next;
      });

      setHasMore(more);
      if (fetched.length > 0) {
        offsetRef.current = offset + fetched.length;
      } else if (replace) {
        offsetRef.current = 0;
      }
    } catch (e) {
      if (e instanceof IndexerError) {
        setErrorCode(clampStatusCode(e.statusCode));
        setError(e.message);
      } else {
        setError("Failed to load pools. Please try again.");
        setErrorCode(500);
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
      setLoading(false);
      loadingRef.current = false;
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    offsetRef.current = 0;
    seenIdsRef.current = new Set();
    void load(0, true);
  }, [load]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      void load(offsetRef.current, false);
    }
  }, [loading, hasMore, load]);

  const refresh = useCallback(() => {
    offsetRef.current = 0;
    seenIdsRef.current = new Set();
    void load(0, true);
  }, [load]);
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

  return { pools, loading, error, errorCode, hasMore, loadMore, refresh };
}
