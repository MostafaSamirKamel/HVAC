import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { NotificationTemplateService } from './notification-template.service.js';

const CreateTemplateSchema = z.object({
  templateId: z.string().optional(),
  templateCode: z.string().min(1, 'Template code is required'),
  channel: z.enum(['SMS', 'WHATSAPP', 'EMAIL', 'IN_APP']),
  language: z.enum(['ar', 'en']).default('ar'),
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

const UpdateTemplateSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export class NotificationTemplateController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreateTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const template = await NotificationTemplateService.createTemplate({
        companyId,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: template,
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = UpdateTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const template = await NotificationTemplateService.updateTemplate(
        companyId,
        req.params.templateId,
        parsed.data
      );

      res.json({
        success: true,
        data: template,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const template = await NotificationTemplateService.getTemplateById(
        companyId,
        req.params.templateId
      );

      res.json({
        success: true,
        data: template,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const templates = await NotificationTemplateService.listTemplates(companyId, {
        channel: req.query.channel as any,
        templateCode: req.query.templateCode as string | undefined,
        isActive: req.query.isActive === undefined ? undefined : req.query.isActive === 'true',
      });

      res.json({
        success: true,
        data: templates,
      });
    } catch (err) {
      next(err);
    }
  }
}
