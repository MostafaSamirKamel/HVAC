import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { JournalEntryService } from './journal-entry.service.js';
import { JournalEntryModel } from './journal-entry.model.js';

const CreateJournalEntrySchema = z.object({
  sourceModule: z.enum(['SALES', 'PURCHASING', 'TREASURY', 'PAYROLL', 'MANUAL']).default('MANUAL'),
  sourceReferenceId: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  entryDate: z.string().datetime().optional().transform((v) => (v ? new Date(v) : undefined)),
  lines: z
    .array(
      z.object({
        accountId: z.string().min(1, 'Account ID is required'),
        accountCode: z.string().min(1, 'Account Code is required'),
        accountName: z.string().min(1, 'Account Name is required'),
        debit: z.union([z.number(), z.string()]).default(0),
        credit: z.union([z.number(), z.string()]).default(0),
        description: z.string().optional(),
        branchId: z.string().optional(),
        costCenterId: z.string().optional(),
      })
    )
    .min(2, 'Journal entry requires at least 2 lines (debit & credit)'),
  currency: z.string().default('EGP'),
});

const ReverseJournalEntrySchema = z.object({
  reason: z.string().min(1, 'Reversal reason is required'),
});

export class JournalEntryController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreateJournalEntrySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const entry = await JournalEntryService.createAndPostEntry({
        companyId,
        ...parsed.data,
        postedBy: req.authContext?.userId || 'unknown',
      });

      res.status(201).json({
        success: true,
        data: entry,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const entry = await JournalEntryService.getEntryById(companyId, req.params.id);

      res.json({
        success: true,
        data: entry,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const status = req.query.status as string | undefined;
      const sourceModule = req.query.sourceModule as string | undefined;

      const query: Record<string, unknown> = { companyId };
      if (status) query.status = status;
      if (sourceModule) query.sourceModule = sourceModule;

      const entries = await JournalEntryModel.find(query).sort({ entryDate: -1 }).limit(100);

      res.json({
        success: true,
        data: entries,
      });
    } catch (err) {
      next(err);
    }
  }

  static async reverse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = ReverseJournalEntrySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const reversal = await JournalEntryService.reverseJournalEntry(
        companyId,
        req.params.id,
        parsed.data.reason,
        req.authContext?.userId || 'unknown'
      );

      res.json({
        success: true,
        message: 'Journal entry reversed successfully',
        data: reversal,
      });
    } catch (err) {
      next(err);
    }
  }
}
