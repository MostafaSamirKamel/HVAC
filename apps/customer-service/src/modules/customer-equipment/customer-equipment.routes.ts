import { Router } from 'express';
import { CustomerEquipmentController } from './customer-equipment.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const customerEquipmentRoutes: Router = Router();

customerEquipmentRoutes.use(requireInternalAuth);

customerEquipmentRoutes.post('/', CustomerEquipmentController.register);
customerEquipmentRoutes.get('/lookup-serial/:serialNumber', CustomerEquipmentController.getBySerial);
customerEquipmentRoutes.get('/customer/:customerId', CustomerEquipmentController.getByCustomer);
customerEquipmentRoutes.get('/:id', CustomerEquipmentController.getById);
customerEquipmentRoutes.post('/:id/service-history', CustomerEquipmentController.addServiceRecord);
customerEquipmentRoutes.get('/:id/warranty', CustomerEquipmentController.verifyWarranty);
