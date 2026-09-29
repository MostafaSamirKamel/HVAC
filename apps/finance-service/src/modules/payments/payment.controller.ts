import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { PaymentService } from './payment.service.js';
import { PaymentModel } from './payment.model.js';

const CollectPaymentSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  treasuryId: z.string().optional(),
  invoiceId: z.string().optional(),
  orderId: z.string().optional(),
  customerId: z.string().optional(),
  amount: z.union([z.number(), z.string()]),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE']).default('CASH'),
  currency: z.string().default('EGP'),
});

const PostInvoiceJournalSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  orderId: z.string().optional(),
  amount: z.union([z.number(), z.string()]),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE']).default('CASH'),
  currency: z.string().default('EGP'),
});

const RollbackPaymentSchema = z.object({
  paymentId: z.string().optional(),
  invoiceId: z.string().optional(),
  orderId: z.string().optional(),
  reason: z.string().optional(),
});

const RollbackJournalSchema = z.object({
  journalId: z.string().optional(),
  invoiceId: z.string().optional(),
  reason: z.string().optional(),
});

export class PaymentController {
  static async collect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CollectPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const payment = await PaymentService.collectPayment({
        companyId,
        ...parsed.data,
        collectedBy: req.authContext?.userId || 'unknown',
      });

      res.status(201).json({
        success: true,
        data: payment,
      });
    } catch (err) {
      next(err);
    }
  }

  static async postInvoiceJournal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = PostInvoiceJournalSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const result = await PaymentService.postInvoiceAccountingEntry({
        companyId,
        ...parsed.data,
        performedBy: req.authContext?.userId || 'unknown',
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async rollback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = RollbackPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const result = await PaymentService.rollbackPayment({
        companyId,
        ...parsed.data,
        performedBy: req.authContext?.userId || 'unknown',
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async rollbackJournal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = RollbackJournalSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const result = await PaymentService.rollbackJournalEntry({
        companyId,
        ...parsed.data,
        performedBy: req.authContext?.userId || 'unknown',
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const invoiceId = req.query.invoiceId as string | undefined;
      const orderId = req.query.orderId as string | undefined;

      const query: Record<string, unknown> = { companyId };
      if (invoiceId) query.invoiceId = invoiceId;
      if (orderId) query.orderId = orderId;

      const payments = await PaymentModel.find(query).sort({ collectedAt: -1 });

      res.json({
        success: true,
        data: payments,
      });
    } catch (err) {
      next(err);
    }
  }
}
