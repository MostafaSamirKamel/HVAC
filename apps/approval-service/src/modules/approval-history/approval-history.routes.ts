import { Router } from 'express';
import { ApprovalHistoryController } from './approval-history.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const approvalHistoryRoutes: Router = Router();

approvalHistoryRoutes.use(requireInternalAuth);

approvalHistoryRoutes.get(
  '/requests/:requestId/history',
  requirePermission('approvals:view'),
  ApprovalHistoryController.getHistory
);
