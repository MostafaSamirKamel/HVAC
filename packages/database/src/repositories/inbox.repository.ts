import { ClientSession } from 'mongoose';
import { InboxEventModel, InboxRetentionCategory } from '../models/inbox.model.js';

export class InboxRepository {
  /**
   * Checks if an event has already been processed by this consumer group.
   */
  static async isProcessed(eventId: string, consumerGroup: string): Promise<boolean> {
    const existing = await InboxEventModel.findOne({
      eventId,
      consumerGroup,
      status: 'PROCESSED',
    }).exec();
    return !!existing;
  }

  /**
   * Records a processed event idempotently.
   * If permanent is true, expiresAt is null (never deleted).
   * Otherwise expiresAt is set to now + ttlSeconds (e.g., 90 days).
   */
  static async markProcessed(params: {
    eventId: string;
    eventType: string;
    consumerGroup: string;
    companyId: string;
    retentionCategory?: InboxRetentionCategory;
    ttlDays?: number;
    session?: ClientSession;
  }): Promise<void> {
    const isPermanent = params.retentionCategory === 'PERMANENT';
    const expiresAt = isPermanent
      ? null
      : new Date(Date.now() + (params.ttlDays || 90) * 24 * 60 * 60 * 1000);

    await InboxEventModel.findOneAndUpdate(
      {
        eventId: params.eventId,
        consumerGroup: params.consumerGroup,
      },
      {
        $setOnInsert: {
          eventId: params.eventId,
          eventType: params.eventType,
          consumerGroup: params.consumerGroup,
          companyId: params.companyId,
          status: 'PROCESSED',
          retentionCategory: params.retentionCategory || 'STANDARD',
          processedAt: new Date(),
          expiresAt,
        },
      },
      {
        upsert: true,
        new: true,
        session: params.session,
      },
    );
  }
}
