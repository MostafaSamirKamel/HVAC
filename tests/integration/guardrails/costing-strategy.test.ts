import { describe, it, expect } from 'vitest';
import { getCostingStrategy } from '../../../apps/inventory-service/src/modules/costing/index.js';
import { ValidationError } from '@hvac/errors';

describe('Phase 17: Inventory Costing Strategies - FIFO & Weighted Average (Blueprint v2.0 Section 21)', () => {
  const sampleBatches = [
    { quantity: 10, unitCost: '100.00', receivedAt: '2026-01-10T00:00:00Z' }, // Older
    { quantity: 20, unitCost: '120.00', receivedAt: '2026-02-15T00:00:00Z' }, // Newer
    { quantity: 15, unitCost: '150.00', receivedAt: '2026-03-20T00:00:00Z' }, // Newest
  ];

  describe('FIFO Costing Strategy', () => {
    const fifo = getCostingStrategy('FIFO');

    it('should consume oldest batches first and calculate exact COGS', async () => {
      // Request 15 units: 10 units @ 100.00 = 1000, 5 units @ 120.00 = 600 -> Total = 1600.00
      const result = await fifo.calculateCost({
        quantityRequested: 15,
        availableBatches: sampleBatches,
      });

      expect(result.totalCost).toBe('1600.00');
      expect(result.unitCost).toBe('106.67');
      expect(result.consumedBatches).toHaveLength(2);
      expect(result.consumedBatches[0]).toEqual({ quantity: 10, unitCost: '100.00' });
      expect(result.consumedBatches[1]).toEqual({ quantity: 5, unitCost: '120.00' });

      // Remaining: 15 units of second batch @ 120, 15 units of third batch @ 150
      expect(result.remainingBatches).toHaveLength(2);
      expect(result.remainingBatches[0].quantity).toBe(15);
      expect(result.remainingBatches[1].quantity).toBe(15);
    });

    it('should throw ValidationError if requested quantity exceeds total stock', async () => {
      await expect(
        fifo.calculateCost({
          quantityRequested: 50, // Total available is 45
          availableBatches: sampleBatches,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Weighted Average Costing Strategy', () => {
    const weightedAvg = getCostingStrategy('WEIGHTED_AVERAGE');

    it('should calculate weighted average unit cost across all batches', async () => {
      // Total valuation = (10 * 100) + (20 * 120) + (15 * 150) = 1000 + 2400 + 2250 = 5650.00
      // Total quantity = 45
      // Avg unit cost = 5650 / 45 = 125.555... -> 125.56
      // For 10 units: 10 * 125.5555... = 1255.56
      const result = await weightedAvg.calculateCost({
        quantityRequested: 10,
        availableBatches: sampleBatches,
      });

      expect(result.unitCost).toBe('125.56');
      expect(result.totalCost).toBe('1255.56');
    });
  });
});
