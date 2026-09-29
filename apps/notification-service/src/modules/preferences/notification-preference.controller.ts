import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { NotificationPreferenceService } from './notification-preference.service.js';

const UpdatePreferencesSchema = z.object({
  channels: z
    .object({
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
      whatsapp: z.boolean().optional(),
      inApp: z.boolean().optional(),
    })
    .optional(),
  optedOutTypes: z.array(z.string()).optional(),
  preferredLanguage: z.enum(['ar', 'en']).optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
});

export class NotificationPreferenceController {
  static async getMyPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const userId = req.authContext?.userId;
      if (!companyId || !userId) throw new ForbiddenError('Tenant and user context required');

      const preferences = await NotificationPreferenceService.getPreferences(companyId, userId);

      res.json({
        success: true,
        data: preferences,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateMyPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const userId = req.authContext?.userId;
      if (!companyId || !userId) throw new ForbiddenError('Tenant and user context required');

      const parsed = UpdatePreferencesSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const preferences = await NotificationPreferenceService.updatePreferences(
        companyId,
        userId,
        parsed.data
      );

      res.json({
        success: true,
        data: preferences,
      });
    } catch (err) {
      next(err);
    }
  }
}
