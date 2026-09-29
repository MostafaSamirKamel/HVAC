import { Router } from 'express';
import { StockReservationController } from './stock-reservation.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const stockReservationRoutes: Router = Router();

stockReservationRoutes.use(requireInternalAuth);

stockReservationRoutes.post('/reserve', requirePermission('inventory:stock:adjust'), StockReservationController.reserve);
stockReservationRoutes.post('/release', requirePermission('inventory:stock:adjust'), StockReservationController.release);
stockReservationRoutes.post('/deduct', requirePermission('inventory:stock:adjust'), StockReservationController.confirmDeduction);
