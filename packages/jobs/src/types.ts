export const JOB_NAMES = {
  DETECT_OVERDUE_INSTALLMENTS: 'detect-overdue-installments',
  SEND_DUE_REMINDERS: 'send-due-reminders',
  SUPPLIER_DUE_REMINDERS: 'supplier-due-reminders',
  LOW_STOCK_DETECTION: 'low-stock-detection',
  NOTIFICATION_DISPATCH: 'notification-dispatch',
  REPORT_EXPORT: 'report-export',
  PROJECTION_REBUILD: 'projection-rebuild',
  CLEANUP_EXPIRED_RESERVATIONS: 'cleanup-expired-reservations',
  OUTBOX_PUBLISHER: 'outbox-publisher',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

export interface JobPayload<T = Record<string, unknown>> {
  jobId: string;
  name: JobName;
  companyId?: string;
  data: T;
  timestamp: string;
  attemptsMade: number;
}

export interface JobOptions {
  jobId?: string;
  delayMs?: number;
  cron?: string;
  maxAttempts?: number;
  backoffMs?: number;
}

export type JobHandler<T = any> = (job: JobPayload<T>) => Promise<void>;

export interface IJobManager {
  registerHandler<T = any>(name: JobName, handler: JobHandler<T>): void;
  enqueue<T = any>(name: JobName, data: T, options?: JobOptions): Promise<string>;
  scheduleCron<T = any>(name: JobName, cronExpression: string, data?: T): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  isHealthy(): boolean;
  getActiveJobCount(): number;
}
