import { randomUUID } from 'crypto';
import { createLogger } from '@hvac/logger';
import { IJobManager, JobName, JobHandler, JobPayload, JobOptions } from './types.js';

const logger = createLogger({ serviceName: 'jobs:manager' });

export class JobManager implements IJobManager {
  private readonly handlers = new Map<JobName, JobHandler>();
  private readonly processedJobIds = new Set<string>();
  private readonly activeJobs = new Set<string>();
  private readonly scheduledIntervals = new Set<NodeJS.Timeout>();
  private isRunning = false;
  private isDraining = false;

  public registerHandler<T = any>(name: JobName, handler: JobHandler<T>): void {
    if (this.handlers.has(name)) {
      logger.warn({ jobName: name }, 'Overwriting existing job handler');
    }
    this.handlers.set(name, handler);
    logger.info({ jobName: name }, 'Registered background job handler');
  }

  public async enqueue<T = any>(name: JobName, data: T, options?: JobOptions): Promise<string> {
    const jobId = options?.jobId || randomUUID();

    // Idempotency check: if jobId was already queued or processed, skip duplicate
    if (this.processedJobIds.has(jobId)) {
      logger.info({ jobId, jobName: name }, 'Job with ID already queued or processed; skipping duplicate (Idempotency)');
      return jobId;
    }

    const payload: JobPayload<T> = {
      jobId,
      name,
      companyId: (data as any)?.companyId,
      data,
      timestamp: new Date().toISOString(),
      attemptsMade: 0,
    };

    this.processedJobIds.add(jobId);
    this.activeJobs.add(jobId);

    const delay = options?.delayMs || 0;
    if (delay > 0) {
      const timer = setTimeout(() => {
        this.scheduledIntervals.delete(timer);
        if (this.isRunning && !this.isDraining) {
          this.executeJob(payload, options?.maxAttempts || 3, options?.backoffMs || 1000).catch(() => {});
        } else {
          this.activeJobs.delete(jobId);
        }
      }, delay);
      this.scheduledIntervals.add(timer);
    } else {
      if (this.isRunning && !this.isDraining) {
        // Execute asynchronously
        setImmediate(() => {
          this.executeJob(payload, options?.maxAttempts || 3, options?.backoffMs || 1000).catch(() => {});
        });
      } else {
        this.activeJobs.delete(jobId);
      }
    }

    return jobId;
  }

  public async scheduleCron<T = any>(name: JobName, _cronExpression: string, data?: T): Promise<void> {
    // For local and background processing, interval-based triggering every 60s simulates cron
    const intervalMs = 60 * 1000;
    const timer = setInterval(() => {
      if (this.isRunning && !this.isDraining) {
        const periodicId = `${name}-${Math.floor(Date.now() / intervalMs)}`;
        this.enqueue(name, data || ({} as T), { jobId: periodicId }).catch(() => {});
      }
    }, intervalMs);

    this.scheduledIntervals.add(timer);
    logger.info({ jobName: name }, 'Registered scheduled periodic job');
  }

  public async start(): Promise<void> {
    this.isRunning = true;
    this.isDraining = false;
    logger.info('Background job manager started');
  }

  public async stop(): Promise<void> {
    logger.info('Draining background jobs and stopping scheduler');
    this.isDraining = true;

    // Clear all scheduled intervals & timeouts
    for (const timer of this.scheduledIntervals) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.scheduledIntervals.clear();

    // Wait up to 5 seconds for in-flight jobs to complete
    const startWait = Date.now();
    while (this.activeJobs.size > 0 && Date.now() - startWait < 5000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    this.isRunning = false;
    logger.info('Background job manager stopped cleanly');
  }

  public isHealthy(): boolean {
    return this.isRunning && !this.isDraining;
  }

  public getActiveJobCount(): number {
    return this.activeJobs.size;
  }

  private async executeJob<T>(payload: JobPayload<T>, maxAttempts: number, backoffMs: number): Promise<void> {
    const handler = this.handlers.get(payload.name);
    if (!handler) {
      logger.warn({ jobName: payload.name }, 'No handler registered for background job');
      return;
    }

    this.activeJobs.add(payload.jobId);

    try {
      while (payload.attemptsMade < maxAttempts) {
        try {
          payload.attemptsMade++;
          await handler(payload);
          logger.info({ jobId: payload.jobId, jobName: payload.name }, 'Job executed successfully');
          return;
        } catch (err) {
          logger.error({ err, jobId: payload.jobId, attempt: payload.attemptsMade, maxAttempts }, 'Error executing job attempt');
          if (payload.attemptsMade >= maxAttempts) {
            logger.error({ jobId: payload.jobId, jobName: payload.name }, 'Job permanently failed after maximum attempts');
            return;
          }
          // Backoff wait
          await new Promise((resolve) => setTimeout(resolve, backoffMs * payload.attemptsMade));
        }
      }
    } finally {
      this.activeJobs.delete(payload.jobId);
    }
  }

  public clear(): void {
    for (const timer of this.scheduledIntervals) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.scheduledIntervals.clear();
    this.processedJobIds.clear();
    this.activeJobs.clear();
    this.handlers.clear();
  }
}

export const defaultJobManager = new JobManager();
