import { ClientSession } from 'mongoose';
import { OutboxEventModel, OutboxEventDocument } from '../models/outbox.model.js';
import { DomainEvent } from '@hvac/event-contracts';

export class OutboxRepository {
  /**
   * Persists an event into the outbox within the caller's transaction session.
   */
  static async recordEvent(
    event: DomainEvent<unknown>,
    session?: ClientSession,
  ): Promise<OutboxEventDocument> {
    const [doc] = await OutboxEventModel.create(
      [
        {
          eventId: event.metadata.eventId,
          eventType: event.metadata.eventType,
          eventVersion: event.metadata.eventVersion,
          routingKey: event.metadata.routingKey,
          aggregateType: event.metadata.aggregateType,
          aggregateId: event.metadata.aggregateId,
          companyId: event.metadata.companyId,
          payload: event.payload as Record<string, unknown>,
          metadata: event.metadata as unknown as Record<string, unknown>,
          status: 'PENDING',
          retryCount: 0,
        },
      ],
      { session },
    );
    return doc;
  }

  /**
   * Fetches a batch of pending events to publish.
   */
  static async fetchPendingEvents(limit = 50): Promise<OutboxEventDocument[]> {
    return OutboxEventModel.find({
      status: { $in: ['PENDING', 'PUBLISHING'] },
      retryCount: { $lt: 5 },
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .exec();
  }

  /**
   * Atomically marks an event as publishing to prevent multiple dispatchers processing it.
   */
  static async markAsPublishing(eventId: string): Promise<boolean> {
    const result = await OutboxEventModel.updateOne(
      { eventId, status: 'PENDING' },
      { $set: { status: 'PUBLISHING' } },
    );
    return result.modifiedCount > 0;
  }

  /**
   * Marks an outbox event as successfully published.
   */
  static async markAsPublished(eventId: string): Promise<void> {
    await OutboxEventModel.updateOne(
      { eventId },
      {
        $set: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      },
    );
  }

  /**
   * Records a failure and increments retry count.
   */
  static async recordFailure(eventId: string, error: Error): Promise<void> {
    await OutboxEventModel.updateOne(
      { eventId },
      {
        $inc: { retryCount: 1 },
        $set: {
          lastError: error.message,
          status: 'PENDING', // Will be retried if retryCount < max
        },
      },
    );
  }
}
