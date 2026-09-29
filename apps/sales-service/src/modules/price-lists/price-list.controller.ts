import { Request, Response, NextFunction } from 'express';
import { PriceListService } from './price-list.service.js';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';

const CreatePriceListSchema = z.object({
  name: z.string().min(2, 'Price list name is required'),
  currency: z.string().default('EGP'),
  items: z.array(
    z.object({
      productId: z.string().min(1, 'Product ID is required'),
      price: z.union([z.number(), z.string()]),
      minQuantity: z.number().int().positive().optional(),
    }),
  ).min(1, 'At least one item is required in the price list'),
  isDefault: z.boolean().optional(),
});

export class PriceListController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreatePriceListSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const priceList = await PriceListService.createPriceList({
        companyId,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: priceList,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const lists = await PriceListService.listPriceLists(companyId);
      res.status(200).json({
        success: true,
        data: lists,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const priceList = await PriceListService.getPriceListById(companyId, req.params.priceListId);
      res.status(200).json({
        success: true,
        data: priceList,
      });
    } catch (err) {
      next(err);
    }
  }
}
