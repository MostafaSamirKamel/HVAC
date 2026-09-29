import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

export const authRoutes: Router = Router();

authRoutes.post('/login', AuthController.login);
authRoutes.post('/refresh', AuthController.refresh);
authRoutes.post('/logout', AuthController.logout);
authRoutes.get('/me', authenticate, AuthController.me);
