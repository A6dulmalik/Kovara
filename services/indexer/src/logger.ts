const recentLogs = new Map<string, number>();
const DEDUP_WINDOW_MS = 60_000;

function logKey(level: string, message: string): string {
  return `${level}:${message}`;
}

function shouldLog(key: string): boolean {
  const now = Date.now();
  const lastLog = recentLogs.get(key);
  if (lastLog && now - lastLog < DEDUP_WINDOW_MS) {
    return false;
  }
  recentLogs.set(key, now);
  if (recentLogs.size > 1000) {
    const oldest = now - 120_000;
    for (const [k, t] of recentLogs.entries()) {
      if (t < oldest) recentLogs.delete(k);
    }
  }
  return true;
}

export const logger = {
  info(message: string, ...args: unknown[]): void {
    if (shouldLog(logKey("info", message))) {
      console.log(`[indexer] ${message}`, ...args);
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (shouldLog(logKey("warn", message))) {
      console.warn(`[indexer] ${message}`, ...args);
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (shouldLog(logKey("error", message))) {
      console.error(`[indexer] ${message}`, ...args);
    }
  },

  always(message: string, ...args: unknown[]): void {
    console.log(`[indexer] ${message}`, ...args);
  },
};