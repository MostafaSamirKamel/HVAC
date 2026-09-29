import { Request, Response, NextFunction } from 'express';
import { StockReservationService } from './stock-reservation.service.js';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';

const ReserveStockSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  items: z.array(
    z.object({
      productId: z.string().min(1, 'Product ID is required'),
      quantity: z.number().int().positive('Quantity must be a positive integer'),
      serialNumbers: z.array(z.string()).optional(),
    }),
  ).min(1, 'At least one item is required'),
});

const ReleaseReservationSchema = z.object({
  reservationId: z.string().min(1, 'Reservation ID is required'),
  orderId: z.string().min(1, 'Order ID is required'),
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  items: z.array(
    z.object({
      productId: z.string().min(1, 'Product ID is required'),
      quantity: z.number().int().positive('Quantity must be a positive integer'),
      serialNumbers: z.array(z.string()).optional(),
    }),
  ).min(1),
  reason: z.string().min(1, 'Release reason is required'),
});

const ConfirmDeductionSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  items: z.array(
    z.object({
      productId: z.string().min(1, 'Product ID is required'),
      quantity: z.number().int().positive('Quantity must be a positive integer'),
      serialNumbers: z.array(z.string()).optional(),
    }),
  ).min(1),
});

export class StockReservationController {
  static async reserve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = ReserveStockSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const result = await StockReservationService.reserveStock({
        companyId,
        orderId: parsed.data.orderId,
        warehouseId: parsed.data.warehouseId,
        items: parsed.data.items,
        performedBy: req.authContext?.userId || 'system',
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async release(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = ReleaseReservationSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      await StockReservationService.releaseReservation({
        companyId,
        reservationId: parsed.data.reservationId,
        orderId: parsed.data.orderId,
        warehouseId: parsed.data.warehouseId,
        items: parsed.data.items,
        reason: parsed.data.reason,
        performedBy: req.authContext?.userId || 'system',
      });

      res.status(200).json({
        success: true,
        message: 'Reservation released successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  static async confirmDeduction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = ConfirmDeductionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const result = await StockReservationService.confirmDeduction({
        companyId,
        orderId: parsed.data.orderId,
        warehouseId: parsed.data.warehouseId,
        invoiceId: parsed.data.invoiceId,
        items: parsed.data.items,
        performedBy: req.authContext?.userId || 'system',
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
