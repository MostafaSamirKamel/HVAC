import { Router } from 'express';
import { ActivityHistoryController } from './activity-history.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const activityHistoryRoutes: Router = Router();

activityHistoryRoutes.use(requireInternalAuth);

activityHistoryRoutes.get('/summary', requirePermission('audit:view'), ActivityHistoryController.getSummary);
activityHistoryRoutes.get('/users/:userId', requirePermission('audit:view'), ActivityHistoryController.getUserTimeline);
activityHistoryRoutes.get('/branches/:branchId', requirePermission('audit:view'), ActivityHistoryController.getBranchTimeline);
