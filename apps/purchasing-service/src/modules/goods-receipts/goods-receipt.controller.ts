import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { GoodsReceiptService } from './goods-receipt.service.js';

const ReceiveGoodsSchema = z.object({
  purchaseOrderId: z.string().min(1, 'Purchase Order ID is required'),
  warehouseId: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Product ID is required'),
        receivedQuantity: z.number().int().positive('Quantity must be positive'),
        unitCost: z.union([z.number(), z.string()]),
        serialNumbers: z.array(z.string()).optional(),
      })
    )
    .min(1, 'Receipt must contain at least one item'),
  notes: z.string().optional(),
});

export class GoodsReceiptController {
  static async receive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = ReceiveGoodsSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const receipt = await GoodsReceiptService.receiveGoods({
        companyId,
        ...parsed.data,
        receivedBy: req.authContext?.userId || 'unknown',
      });

      res.status(201).json({
        success: true,
        data: receipt,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const receipt = await GoodsReceiptService.getReceiptById(companyId, req.params.id);

      res.json({
        success: true,
        data: receipt,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const receipts = await GoodsReceiptService.listReceipts(
        companyId,
        req.query.purchaseOrderId as string | undefined
      );

      res.json({
        success: true,
        data: receipts,
      });
    } catch (err) {
      next(err);
    }
  }
}
