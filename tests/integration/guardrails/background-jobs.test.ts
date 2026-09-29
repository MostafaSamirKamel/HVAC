import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobManager, JOB_NAMES } from '../../../packages/jobs/src/index.js';

describe('Phase 16: Distributed Background Jobs & Scheduler (Blueprint v2.0 Section 49 & 54)', () => {
  let jobManager: JobManager;

  beforeEach(async () => {
    jobManager = new JobManager();
    await jobManager.start();
  });

  afterEach(async () => {
    await jobManager.stop();
  });

  it('should register handler and execute overdue installment detection job', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    jobManager.registerHandler(JOB_NAMES.DETECT_OVERDUE_INSTALLMENTS, handler);

    const jobId = await jobManager.enqueue(JOB_NAMES.DETECT_OVERDUE_INSTALLMENTS, {
      companyId: 'comp_cairo_hvac',
      batchSize: 50,
    });

    expect(jobId).toBeDefined();

    // Allow event loop to process setImmediate
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(handler).toHaveBeenCalledTimes(1);
    const calledPayload = handler.mock.calls[0][0];
    expect(calledPayload.name).toBe(JOB_NAMES.DETECT_OVERDUE_INSTALLMENTS);
    expect(calledPayload.companyId).toBe('comp_cairo_hvac');
    expect(calledPayload.data.batchSize).toBe(50);
  });

  it('should guarantee job idempotency and ignore duplicate jobId', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    jobManager.registerHandler(JOB_NAMES.CLEANUP_EXPIRED_RESERVATIONS, handler);

    const fixedJobId = 'cleanup-reservations-2026-09-27-1200';

    // First enqueue
    await jobManager.enqueue(
      JOB_NAMES.CLEANUP_EXPIRED_RESERVATIONS,
      { companyId: 'comp_cairo_hvac' },
      { jobId: fixedJobId }
    );

    // Duplicate enqueue with same ID
    await jobManager.enqueue(
      JOB_NAMES.CLEANUP_EXPIRED_RESERVATIONS,
      { companyId: 'comp_cairo_hvac' },
      { jobId: fixedJobId }
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Must be executed exactly once
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should retry failed job up to maxAttempts with backoff', async () => {
    let callCount = 0;
    const failingThenSucceedingHandler = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error(`Transient failure attempt ${callCount}`);
      }
    });

    jobManager.registerHandler(JOB_NAMES.LOW_STOCK_DETECTION, failingThenSucceedingHandler);

    await jobManager.enqueue(
      JOB_NAMES.LOW_STOCK_DETECTION,
      { threshold: 10 },
      { maxAttempts: 3, backoffMs: 20 }
    );

    // Wait for retries
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(callCount).toBe(3);
  });

  it('should drain in-flight jobs and shut down cleanly', async () => {
    let jobFinished = false;
    jobManager.registerHandler(JOB_NAMES.OUTBOX_PUBLISHER, async () => {
      await new Promise((r) => setTimeout(r, 60));
      jobFinished = true;
    });

    await jobManager.enqueue(JOB_NAMES.OUTBOX_PUBLISHER, { limit: 100 });

    // Initiate stop while job is in-flight
    await jobManager.stop();

    expect(jobFinished).toBe(true);
    expect(jobManager.isHealthy()).toBe(false);
  });
});
