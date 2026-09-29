import { Router } from 'express';
import { TreasuryController } from './treasury.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const treasuryRoutes: Router = Router();

treasuryRoutes.use(requireInternalAuth);

treasuryRoutes.post('/', TreasuryController.create);
treasuryRoutes.get('/', TreasuryController.list);
treasuryRoutes.get('/:id', TreasuryController.getById);
treasuryRoutes.get('/:id/history', TreasuryController.getLedgerHistory);
treasuryRoutes.post('/:id/movements', TreasuryController.recordMovement);
