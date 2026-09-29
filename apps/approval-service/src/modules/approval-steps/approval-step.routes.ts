import { Router } from 'express';
import { ApprovalStepController } from './approval-step.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const approvalStepRoutes: Router = Router();

approvalStepRoutes.use(requireInternalAuth);

approvalStepRoutes.get(
  '/requests/:requestId/steps',
  requirePermission('approvals:view'),
  ApprovalStepController.getSteps
);

approvalStepRoutes.post(
  '/requests/:requestId/steps/:stepNumber/approve',
  requirePermission('approvals:action'),
  ApprovalStepController.approveStep
);

approvalStepRoutes.post(
  '/requests/:requestId/steps/:stepNumber/reject',
  requirePermission('approvals:action'),
  ApprovalStepController.rejectStep
);
