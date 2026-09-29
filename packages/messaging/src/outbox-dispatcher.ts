import { OutboxRepository } from '@hvac/database';
import { EventPublisher } from './publisher.js';
import { createLogger } from '@hvac/logger';

const logger = createLogger({ serviceName: 'messaging:outbox-dispatcher' });

export class OutboxDispatcher {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private shouldStop = false;

  constructor(
    private readonly publisher: EventPublisher,
    private readonly intervalMs = 1000,
    private readonly batchSize = 50,
  ) {}

  start(): void {
    if (this.timer) return;
    logger.info({ intervalMs: this.intervalMs }, 'Outbox Dispatcher started');
    this.timer = setInterval(() => {
      this.processBatch().catch((err) => {
        logger.error({ err }, 'Error in outbox processing loop');
      });
    }, this.intervalMs);
  }

  async stop(): Promise<void> {
    this.shouldStop = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Wait for in-flight processing to complete
    while (this.isProcessing) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    logger.info('Outbox Dispatcher stopped');
  }

  /**
   * Immediately processes all pending outbox events.
   * Useful for shutdown flushing or integration testing.
   */
  async processBatch(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const events = await OutboxRepository.fetchPendingEvents(this.batchSize);
      if (events.length === 0) return 0;

      logger.debug({ count: events.length }, 'Processing pending outbox events');

      let publishedCount = 0;
      for (const eventDoc of events) {
        if (this.shouldStop) break;

        const claimed = await OutboxRepository.markAsPublishing(eventDoc.eventId);
        if (!claimed) continue;

        try {
          await this.publisher.publish({
            metadata: eventDoc.metadata as any,
            payload: eventDoc.payload,
          });

          await OutboxRepository.markAsPublished(eventDoc.eventId);
          publishedCount++;
        } catch (pubErr) {
          logger.error({ err: pubErr, eventId: eventDoc.eventId }, 'Outbox publish error');
          await OutboxRepository.recordFailure(eventDoc.eventId, pubErr as Error);
        }
      }

      return publishedCount;
    } finally {
      this.isProcessing = false;
    }
  }
}
