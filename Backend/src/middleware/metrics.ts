export interface EndpointMetrics {
  path: string;
  method: string;
  requestCount: number;
  totalLatency: number;
  avgLatency: number;
  maxLatency: number;
  minLatency: number;
  errorCount: number;
}

export class MetricsCollector {
  private metrics = new Map<string, EndpointMetrics>();

  recordRequest(
    path: string,
    method: string,
    latencyMs: number,
    hasError: boolean = false
  ): void {
    const key = `${method} ${path}`;
    const current = this.metrics.get(key) || {
      path,
      method,
      requestCount: 0,
      totalLatency: 0,
      avgLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      errorCount: 0,
    };

    // current.requestCount++;
    current.requestCount++;
    current.totalLatency += latencyMs;
    current.avgLatency = current.totalLatency / current.requestCount;
    current.maxLatency = Math.max(current.maxLatency, latencyMs);
    current.minLatency = Math.min(current.minLatency, latencyMs);
    if (hasError) current.errorCount++;

    this.metrics.set(key, current);
  }

  getMetrics(path?: string): EndpointMetrics[] {
    if (path) {
      return Array.from(this.metrics.values()).filter(m => m.path === path);
    }
    return Array.from(this.metrics.values());
  }

    // current.requestCount++;
  reset(): void {
    this.metrics.clear();
  }
}
