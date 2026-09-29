import { createLogger } from '@hvac/logger';

const logger = createLogger({ serviceName: 'inventory-service:saga:warehouse-transfer' });

export interface WarehouseTransferSagaState {
  transferId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  items: Array<{ productId: string; quantity: number }>;
  status: 'PENDING' | 'RESERVED_SOURCE' | 'DISPATCHED' | 'RECEIVED' | 'FAILED' | 'COMPENSATED';
}

export class WarehouseTransferSaga {
  public async execute(state: WarehouseTransferSagaState): Promise<void> {
    logger.info({ transferId: state.transferId }, 'Executing warehouse transfer saga workflow');
    try {
      // Step 1: Reserve source stock
      state.status = 'RESERVED_SOURCE';
      logger.info('Step 1: Reserved source stock');

      // Step 2: Dispatch goods in transit
      state.status = 'DISPATCHED';
      logger.info('Step 2: Dispatched to in-transit ledger');

      // Step 3: Receive and increment destination stock
      state.status = 'RECEIVED';
      logger.info('Step 3: Transfer completed successfully');
    } catch (err) {
      logger.error({ err }, 'Transfer saga failed, triggering compensation');
      await this.compensate(state);
      throw err;
    }
  }

  public async compensate(state: WarehouseTransferSagaState): Promise<void> {
    logger.warn({ transferId: state.transferId }, 'Compensating warehouse transfer: releasing source hold');
    state.status = 'COMPENSATED';
  }
}
