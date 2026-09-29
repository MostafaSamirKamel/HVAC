import { Router } from 'express';
import { ApprovalRuleController } from './approval-rule.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const approvalRuleRoutes: Router = Router();

approvalRuleRoutes.use(requireInternalAuth);

approvalRuleRoutes.post('/', requirePermission('approvals:rules:manage'), ApprovalRuleController.create);
approvalRuleRoutes.get('/', requirePermission('approvals:rules:view'), ApprovalRuleController.list);
approvalRuleRoutes.get('/:ruleId', requirePermission('approvals:rules:view'), ApprovalRuleController.getById);
approvalRuleRoutes.put('/:ruleId', requirePermission('approvals:rules:manage'), ApprovalRuleController.update);
approvalRuleRoutes.delete('/:ruleId', requirePermission('approvals:rules:manage'), ApprovalRuleController.delete);
