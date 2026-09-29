import { Router } from 'express';
import { ApprovalRequestController } from './approval-request.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const approvalRequestRoutes: Router = Router();

approvalRequestRoutes.use(requireInternalAuth);

approvalRequestRoutes.post('/', requirePermission('approvals:request'), ApprovalRequestController.create);
approvalRequestRoutes.get('/', requirePermission('approvals:view'), ApprovalRequestController.list);
approvalRequestRoutes.get('/:id', requirePermission('approvals:view'), ApprovalRequestController.getById);
approvalRequestRoutes.post('/:id/approve', requirePermission('approvals:action'), ApprovalRequestController.approve);
approvalRequestRoutes.post('/:id/reject', requirePermission('approvals:action'), ApprovalRequestController.reject);
approvalRequestRoutes.post('/:id/cancel', requirePermission('approvals:request'), ApprovalRequestController.cancel);
