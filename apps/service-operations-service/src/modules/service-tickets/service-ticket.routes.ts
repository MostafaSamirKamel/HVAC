import { Router } from 'express';
import { ServiceTicketController } from './service-ticket.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const serviceTicketRoutes: Router = Router();

serviceTicketRoutes.use(requireInternalAuth);

serviceTicketRoutes.post('/', ServiceTicketController.create);
serviceTicketRoutes.get('/', ServiceTicketController.list);
serviceTicketRoutes.get('/:id', ServiceTicketController.getById);
serviceTicketRoutes.post('/:id/assign', ServiceTicketController.assignToWorkOrder);
serviceTicketRoutes.post('/:id/resolve', ServiceTicketController.resolve);
serviceTicketRoutes.post('/:id/close', ServiceTicketController.close);
