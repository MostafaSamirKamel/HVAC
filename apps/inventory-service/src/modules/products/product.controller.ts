import { Request, Response, NextFunction } from 'express';
import { ProductService } from './product.service.js';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';

const CreateProductSchema = z.object({
  sku: z.string().min(2, 'SKU is required'),
  name: z.string().min(2, 'Product name is required'),
  brand: z.string().min(2, 'Brand is required'),
  category: z.string().min(2, 'Category is required'),
  modelNumber: z.string().optional(),
  coolingCapacityBtu: z.number().optional(),
  horsepower: z.string().optional(),
  refrigerantType: z.string().optional(),
  basePrice: z.union([z.number(), z.string()]),
  costPrice: z.union([z.number(), z.string()]),
  isSerialized: z.boolean().optional(),
  minStockLevel: z.number().optional(),
});

export class ProductController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreateProductSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const product = await ProductService.createProduct({
        companyId,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: product,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const brand = req.query.brand as string | undefined;
      const category = req.query.category as string | undefined;
      const search = req.query.search as string | undefined;

      const products = await ProductService.listProducts(companyId, { brand, category, search });
      res.status(200).json({
        success: true,
        data: products,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const product = await ProductService.getProductById(companyId, req.params.productId);
      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (err) {
      next(err);
    }
  }
}
