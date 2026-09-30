import mongoose, { ClientSession, Connection } from 'mongoose';
import { createLogger } from '@hvac/logger';

const logger = createLogger({ serviceName: 'database:transaction' });

export interface TransactionOptions {
  readPreference?: 'primary' | 'primaryPreferred' | 'secondary' | 'secondaryPreferred' | 'nearest';
  maxCommitTimeMS?: number;
}

/**
 * Executes an operation within a MongoDB multi-document transaction session.
 * Automatically commits on success and aborts/rollbacks on unhandled exception.
 * If connection is not active (e.g. In-memory unit test mocks), executes with mock session.
 */
export async function withTransaction<T>(
  operation: (session: ClientSession) => Promise<T>,
  connection?: Connection,
  options: TransactionOptions = {},
): Promise<T> {
  const conn = connection || mongoose.connection;

  // In test / mock mode where no live replica set is active
  if (conn.readyState !== 1) {
    const mockSession = {
      startTransaction: () => {},
      commitTransaction: async () => {},
      abortTransaction: async () => {},
      endSession: async () => {},
      inTransaction: () => false,
    } as unknown as ClientSession;
    return operation(mockSession);
  }

  // Check if connected MongoDB deployment supports multi-document transactions
  const client = conn.getClient() as unknown as { topology?: { description?: { type?: string } } };
  const topologyType = client?.topology?.description?.type;
  const isReplicaSetOrSharded = topologyType?.includes('ReplicaSet') || topologyType === 'Sharded';
  if (!isReplicaSetOrSharded) {
    // Standalone MongoDB (Single) does not support multi-document transactions
    return operation(undefined as unknown as ClientSession);
  }

  let session: ClientSession;
  try {
    session = await conn.startSession();
  } catch {
    return operation(undefined as unknown as ClientSession);
  }

  try {
    session.startTransaction({
      readConcern: { level: 'majority' },
      writeConcern: { w: 'majority', j: true },
      maxCommitTimeMS: options.maxCommitTimeMS || 10000,
    });

    const result = await operation(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    logger.warn({ err: error }, 'Transaction failed, aborting session...');
    if (session.inTransaction()) {
      await session.abortTransaction().catch((abortErr: unknown) => {
        logger.error({ err: abortErr }, 'Error aborting transaction');
      });
    }
    throw error;
  } finally {
    await session.endSession().catch(() => {});
  }
}
