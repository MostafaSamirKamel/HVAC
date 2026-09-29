import { Router } from 'express';
import { InstallmentRescheduleController } from './installment-reschedule.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const installmentRescheduleRoutes: Router = Router({ mergeParams: true });

installmentRescheduleRoutes.use(requireInternalAuth);

installmentRescheduleRoutes.get('/settle-early/preview', InstallmentRescheduleController.calculateSettlement);
installmentRescheduleRoutes.post('/settle-early', InstallmentRescheduleController.executeSettlement);
installmentRescheduleRoutes.post('/reschedule-tenor', InstallmentRescheduleController.rescheduleTenor);
