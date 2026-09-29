export interface MetricRecord {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: number;
}

export class MetricsCollector {
  private static metrics: MetricRecord[] = [];

  public static record(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics.push({
      name,
      value,
      tags,
      timestamp: Date.now(),
    });
  }

  public static flush(): MetricRecord[] {
    const records = [...this.metrics];
    this.metrics = [];
    return records;
  }
}
