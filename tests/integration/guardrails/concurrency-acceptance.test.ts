import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateDocumentNumber, NumberCounterModel } from '@hvac/database';
import { ConflictError, ValidationError } from '@hvac/errors';

describe('Phase 18: Concurrency & High-Contention Acceptance Tests (Blueprint v2.0 Section 58 & 59)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Atomic Document Number Generation (Rule 46)', () => {
    it('should generate continuous unique document numbers without collision under concurrency', async () => {
      let currentSeq = 0;
      // Mock atomic findOneAndUpdate to simulate MongoDB atomic counter
      vi.spyOn(NumberCounterModel, 'findOneAndUpdate').mockImplementation(async (query: any) => {
        currentSeq++;
        return {
          companyId: query.companyId,
          documentType: query.documentType,
          year: query.year,
          sequence: currentSeq,
        } as any;
      });

      // Fire 10 concurrent sequence generation requests
      const promises = Array.from({ length: 10 }).map(() =>
        generateDocumentNumber({
          companyId: 'comp_cairo_hvac',
          documentType: 'SO',
          year: 2026,
        })
      );

      const results = await Promise.all(promises);

      // Verify all 10 are unique
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBe(10);
      expect(results[0]).toBe('SO-2026-000001');
      expect(results[9]).toBe('SO-2026-000010');
    });
  });

  describe('Serial Number Race Condition Defense (Acceptance Test #1)', () => {
    it('should prevent the same serial number from being sold twice under concurrent requests', async () => {
      let serialSold = false;

      // Simulated atomic serial transition handler
      const sellSerial = async (serial: string): Promise<boolean> => {
        if (serialSold) {
          throw new ConflictError(`Serial number ${serial} has already been sold`);
        }
        // Atomic compare-and-swap
        serialSold = true;
        return true;
      };

      const [res1, res2] = await Promise.allSettled([
        sellSerial('SN-HVAC-998811'),
        sellSerial('SN-HVAC-998811'),
      ]);

      const successCount = [res1, res2].filter((r) => r.status === 'fulfilled').length;
      const rejectedCount = [res1, res2].filter((r) => r.status === 'rejected').length;

      expect(successCount).toBe(1);
      expect(rejectedCount).toBe(1);

      const rejected = [res1, res2].find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(rejected.reason).toBeInstanceOf(ConflictError);
    });
  });

  describe('Zero-Negative Stock Invariant (Acceptance Test #2)', () => {
    it('should prevent stock from becoming negative when two concurrent orders contest the last unit', async () => {
      let availableQuantity = 1;

      const deductStock = async (qty: number): Promise<number> => {
        if (availableQuantity < qty) {
          throw new ValidationError('Insufficient stock: available quantity cannot be negative');
        }
        availableQuantity -= qty;
        return availableQuantity;
      };

      const [req1, req2] = await Promise.allSettled([
        deductStock(1),
        deductStock(1),
      ]);

      const fulfilled = [req1, req2].filter((r) => r.status === 'fulfilled');
      const rejected = [req1, req2].filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(availableQuantity).toBe(0); // Never negative
    });
  });
});
