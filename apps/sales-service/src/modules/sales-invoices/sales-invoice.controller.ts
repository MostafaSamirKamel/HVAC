import { Request, Response, NextFunction } from 'express';
import { SalesInvoiceService } from './sales-invoice.service.js';
import { SalesInvoiceModel } from './sales-invoice.model.js';
import { ForbiddenError } from '@hvac/errors';

export class SalesInvoiceController {
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const invoice = await SalesInvoiceService.getInvoiceById(companyId, req.params.invoiceId);
      res.status(200).json({
        success: true,
        data: invoice,
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
      const query: Record<string, unknown> = { companyId };
      if (status) query.status = status;

      const invoices = await SalesInvoiceModel.find(query).sort({ issuedAt: -1 }).exec();
      res.status(200).json({
        success: true,
        data: invoices,
      });
    } catch (err) {
      next(err);
    }
  }
}
