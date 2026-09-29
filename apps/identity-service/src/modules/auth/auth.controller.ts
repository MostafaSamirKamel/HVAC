import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { z } from 'zod';
import { ValidationError } from '@hvac/errors';

const LoginSchema = z.object({
  companyId: z.string().min(1, 'companyId is required'),
  identifier: z.string().min(1, 'Email or username is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = LoginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
      const result = await AuthService.login(
        parsed.data.companyId,
        parsed.data.identifier,
        parsed.data.password,
        correlationId,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = RefreshSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
      const result = await AuthService.refresh(parsed.data.refreshToken, correlationId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = RefreshSchema.safeParse(req.body);
      if (parsed.success) {
        await AuthService.logout(parsed.data.refreshToken);
      }
      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  static async me(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      data: req.user,
    });
  }
}
