import { Request, Response, NextFunction } from 'express';
import { CashSaleSagaOrchestrator, InventoryClientAdapter, FinanceClientAdapter } from './cash-sale.saga.js';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';

const ExecuteCashSaleSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  branchId: z.string().min(1, 'Branch ID is required'),
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'BANK_TRANSFER']).default('CASH'),
  treasuryId: z.string().min(1, 'Treasury ID is required'),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Product ID is required'),
        productName: z.string().min(1, 'Product Name is required'),
        quantity: z.number().int().positive('Quantity must be a positive integer'),
        unitPrice: z.union([z.number(), z.string()]),
        discountAmount: z.union([z.number(), z.string()]).optional(),
        serialNumbers: z.array(z.string()).optional(),
      }),
    )
    .min(1, 'Order must contain at least one item'),
  notes: z.string().optional(),
});

export class CashSaleController {
  constructor(
    private readonly inventoryAdapter: InventoryClientAdapter,
    private readonly financeAdapter: FinanceClientAdapter,
  ) {}

  execute = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = ExecuteCashSaleSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const orchestrator = new CashSaleSagaOrchestrator(
        this.inventoryAdapter,
        this.financeAdapter,
      );

      const correlationId = (req.headers['x-correlation-id'] as string) || undefined;

      const result = await orchestrator.execute(
        {
          companyId,
          saleType: 'CASH',
          salesRepresentativeId: req.authContext?.userId || 'unknown',
          ...parsed.data,
        },
        correlationId,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}
