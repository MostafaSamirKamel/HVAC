import { Router } from 'express';
import { TechnicianController } from './technician.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const technicianRoutes: Router = Router();

technicianRoutes.use(requireInternalAuth);

technicianRoutes.post('/', requirePermission('technicians:create'), TechnicianController.create);
technicianRoutes.get('/', requirePermission('technicians:view'), TechnicianController.list);
technicianRoutes.get('/:id', requirePermission('technicians:view'), TechnicianController.getById);
technicianRoutes.post('/:id/commissions', requirePermission('technicians:commission'), TechnicianController.recordCommission);
technicianRoutes.post('/:id/settlements', requirePermission('technicians:settle'), TechnicianController.submitSettlement);
