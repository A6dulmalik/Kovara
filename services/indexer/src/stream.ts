import { logger } from "./logger";

export interface RawEvent {
  type: string;
  ledger: number;
  ledgerClosedAt: string;
  contractId: string;
  id: string;
  pagingToken: string;
  topic: string[];
  value: string;
  txHash: string;
}

export interface StreamConfig {
  rpcUrl: string;
  contractId: string;
  startLedger: number;
  pollIntervalMs?: number;
}

export type EventHandler = (event: RawEvent) => Promise<void>;

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const MAX_EVENTS_PER_PAGE = 100;

async function fetchEvents(
  rpcUrl: string,
  contractId: string,
  startLedger: number,
  cursor?: string
): Promise<{ events: RawEvent[]; latestLedger: number }> {
  const body: Record<string, unknown> = {
    jsonrpc: "2.0",
    id: 1,
    method: "getEvents",
    params: {
      startLedger,
      filters: [
        {
          type: "contract",
          contractIds: [contractId],
        },
      ],
      pagination: {
        limit: MAX_EVENTS_PER_PAGE,
        ...(cursor ? { cursor } : {}),
      },
    },
  };

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as {
    result?: {
      events: RawEvent[];
      latestLedger: number;
    };
    error?: { message: string };
  };

  if (json.error) {
    throw new Error(`RPC error: ${json.error.message}`);
  }

  return {
    events: json.result?.events ?? [],
    latestLedger: json.result?.latestLedger ?? startLedger,
  };
}

export async function streamEvents(
  config: StreamConfig,
  handler: EventHandler,
  signal: AbortSignal
): Promise<void> {
  const pollMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  let cursor: string | undefined;
  let startLedger = config.startLedger;

  logger.always(`Starting from ledger ${startLedger}, contract=${config.contractId}`);

  while (!signal.aborted) {
    try {
      const { events, latestLedger } = await fetchEvents(
        config.rpcUrl,
        config.contractId,
        startLedger,
        cursor
      );

      for (const event of events) {
        if (signal.aborted) break;
        await handler(event);
        cursor = event.pagingToken;
      }

      if (events.length === MAX_EVENTS_PER_PAGE) {
        continue;
      }

      startLedger = latestLedger;
    } catch (err) {
      logger.error("Error fetching events:", err);
    }

    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, pollMs);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  logger.always("Stopped.");
}