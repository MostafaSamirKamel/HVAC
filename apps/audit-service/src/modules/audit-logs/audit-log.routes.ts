import { Router } from 'express';
import { AuditLogController } from './audit-log.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const auditLogRoutes: Router = Router();

auditLogRoutes.use(requireInternalAuth);

auditLogRoutes.get('/', requirePermission('audit:view'), AuditLogController.query);
auditLogRoutes.get('/history/:aggregateType/:aggregateId', requirePermission('audit:view'), AuditLogController.getEntityHistory);
auditLogRoutes.post('/', requirePermission('audit:write'), AuditLogController.record);
