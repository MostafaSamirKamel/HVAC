import { Router } from 'express';
import { InstallmentScheduleController } from './installment-schedule.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const installmentScheduleRoutes: Router = Router();

installmentScheduleRoutes.use(requireInternalAuth);

installmentScheduleRoutes.get('/', InstallmentScheduleController.list);
installmentScheduleRoutes.get('/:id', InstallmentScheduleController.getById);
