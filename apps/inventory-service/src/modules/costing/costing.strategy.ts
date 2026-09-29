import { Decimal } from '@hvac/money';
import { ValidationError } from '@hvac/errors';

export type CostingMethod = 'FIFO' | 'WEIGHTED_AVERAGE';

export interface StockBatch {
  quantity: number;
  unitCost: string | Decimal;
  receivedAt: Date | string;
}

export interface CostingInput {
  quantityRequested: number;
  availableBatches: StockBatch[];
  currentWeightedAverageCost?: string | Decimal;
}

export interface CostingResult {
  totalCost: string;
  unitCost: string;
  consumedBatches: Array<{ quantity: number; unitCost: string }>;
  remainingBatches: StockBatch[];
}

export interface InventoryCostingStrategy {
  calculateCost(input: CostingInput): Promise<CostingResult>;
}

export class FifoCostingStrategy implements InventoryCostingStrategy {
  public async calculateCost(input: CostingInput): Promise<CostingResult> {
    if (input.quantityRequested <= 0) {
      throw new ValidationError('Requested quantity must be positive');
    }

    // Sort batches by received date ascending (oldest first)
    const sortedBatches = [...input.availableBatches]
      .filter((b) => b.quantity > 0)
      .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());

    const totalAvailable = sortedBatches.reduce((acc, b) => acc + b.quantity, 0);
    if (totalAvailable < input.quantityRequested) {
      throw new ValidationError(`Insufficient inventory for costing: requested ${input.quantityRequested}, available ${totalAvailable}`);
    }

    let remainingToFulfill = input.quantityRequested;
    let totalCostDecimal = new Decimal(0);
    const consumedBatches: Array<{ quantity: number; unitCost: string }> = [];
    const remainingBatches: StockBatch[] = [];

    for (const batch of sortedBatches) {
      if (remainingToFulfill === 0) {
        remainingBatches.push({ ...batch });
        continue;
      }

      const take = Math.min(batch.quantity, remainingToFulfill);
      const batchCost = new Decimal(batch.unitCost.toString());
      totalCostDecimal = totalCostDecimal.add(batchCost.times(take));

      consumedBatches.push({
        quantity: take,
        unitCost: batchCost.toFixed(2),
      });

      remainingToFulfill -= take;

      if (batch.quantity > take) {
        remainingBatches.push({
          quantity: batch.quantity - take,
          unitCost: batch.unitCost,
          receivedAt: batch.receivedAt,
        });
      }
    }

    const unitCost = totalCostDecimal.dividedBy(input.quantityRequested).toFixed(2);

    return {
      totalCost: totalCostDecimal.toFixed(2),
      unitCost,
      consumedBatches,
      remainingBatches,
    };
  }
}

export class WeightedAverageCostingStrategy implements InventoryCostingStrategy {
  public async calculateCost(input: CostingInput): Promise<CostingResult> {
    if (input.quantityRequested <= 0) {
      throw new ValidationError('Requested quantity must be positive');
    }

    const totalAvailable = input.availableBatches.reduce((acc, b) => acc + b.quantity, 0);
    if (totalAvailable < input.quantityRequested) {
      throw new ValidationError(`Insufficient inventory for costing: requested ${input.quantityRequested}, available ${totalAvailable}`);
    }

    // Calculate weighted average unit cost across all available batches
    let totalValuation = new Decimal(0);
    for (const batch of input.availableBatches) {
      const batchCost = new Decimal(batch.unitCost.toString());
      totalValuation = totalValuation.add(batchCost.times(batch.quantity));
    }

    const avgUnitCostDecimal = totalAvailable > 0
      ? totalValuation.dividedBy(totalAvailable)
      : new Decimal(input.currentWeightedAverageCost ? input.currentWeightedAverageCost.toString() : 0);

    const totalCostDecimal = avgUnitCostDecimal.times(input.quantityRequested);

    // Proportionally deduct from batches
    let remainingToFulfill = input.quantityRequested;
    const consumedBatches: Array<{ quantity: number; unitCost: string }> = [];
    const remainingBatches: StockBatch[] = [];

    for (const batch of input.availableBatches) {
      if (remainingToFulfill === 0) {
        remainingBatches.push({ ...batch });
        continue;
      }

      const take = Math.min(batch.quantity, remainingToFulfill);
      consumedBatches.push({
        quantity: take,
        unitCost: avgUnitCostDecimal.toFixed(2),
      });

      remainingToFulfill -= take;

      if (batch.quantity > take) {
        remainingBatches.push({
          quantity: batch.quantity - take,
          unitCost: batch.unitCost,
          receivedAt: batch.receivedAt,
        });
      }
    }

    return {
      totalCost: totalCostDecimal.toFixed(2),
      unitCost: avgUnitCostDecimal.toFixed(2),
      consumedBatches,
      remainingBatches,
    };
  }
}

export function getCostingStrategy(method: CostingMethod = 'FIFO'): InventoryCostingStrategy {
  switch (method) {
    case 'WEIGHTED_AVERAGE':
      return new WeightedAverageCostingStrategy();
    case 'FIFO':
    default:
      return new FifoCostingStrategy();
  }
}
