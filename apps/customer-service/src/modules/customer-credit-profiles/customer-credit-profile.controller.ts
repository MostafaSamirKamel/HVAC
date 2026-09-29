import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { CustomerCreditProfileService } from './customer-credit-profile.service.js';

const UpsertCreditProfileSchema = z.object({
  creditRating: z.enum(['A', 'B', 'C', 'D', 'BLACKLISTED']).optional(),
  approvedCreditLimit: z.union([z.number(), z.string()]),
  paymentTermsDays: z.number().int().nonnegative().optional(),
  guarantees: z
    .object({
      bankGuarantee: z.boolean().optional(),
      chequeSecurity: z.boolean().optional(),
      promissoryNote: z.boolean().optional(),
    })
    .optional(),
  riskNotes: z.string().optional(),
});

const BlockCreditSchema = z.object({
  reason: z.string().min(1, 'Reason for blocking credit is required'),
});

export class CustomerCreditProfileController {
  static async upsert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const reviewedBy = req.authContext?.userId;
      if (!companyId || !reviewedBy) throw new ForbiddenError('Tenant and user context required');

      const parsed = UpsertCreditProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const profile = await CustomerCreditProfileService.upsertProfile({
        companyId,
        customerId: req.params.customerId,
        reviewedBy,
        ...parsed.data,
      });

      res.json({
        success: true,
        message: 'Customer credit profile updated',
        data: profile,
      });
    } catch (err) {
      next(err);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const profile = await CustomerCreditProfileService.getProfile(
        companyId,
        req.params.customerId
      );

      res.json({
        success: true,
        data: profile,
      });
    } catch (err) {
      next(err);
    }
  }

  static async block(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const blockedBy = req.authContext?.userId;
      if (!companyId || !blockedBy) throw new ForbiddenError('Tenant and user context required');

      const parsed = BlockCreditSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const profile = await CustomerCreditProfileService.blockCredit(
        companyId,
        req.params.customerId,
        parsed.data.reason,
        blockedBy
      );

      res.json({
        success: true,
        message: 'Customer credit blocked',
        data: profile,
      });
    } catch (err) {
      next(err);
    }
  }

  static async unblock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const unblockedBy = req.authContext?.userId;
      if (!companyId || !unblockedBy) throw new ForbiddenError('Tenant and user context required');

      const profile = await CustomerCreditProfileService.unblockCredit(
        companyId,
        req.params.customerId,
        unblockedBy
      );

      res.json({
        success: true,
        message: 'Customer credit unblocked',
        data: profile,
      });
    } catch (err) {
      next(err);
    }
  }

  static async evaluate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const amount = req.query.amount as string;
      if (!amount) throw new ValidationError('Amount query parameter is required');

      const evaluation = await CustomerCreditProfileService.evaluateCreditEligibility(
        companyId,
        req.params.customerId,
        amount
      );

      res.json({
        success: true,
        data: evaluation,
      });
    } catch (err) {
      next(err);
    }
  }
}
