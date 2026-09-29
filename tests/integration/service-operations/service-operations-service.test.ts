import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkOrderModel } from '../../../apps/service-operations-service/src/modules/work-orders/work-order.model.js';
import { WorkOrderService } from '../../../apps/service-operations-service/src/modules/work-orders/work-order.service.js';
import { WarrantyModel } from '../../../apps/service-operations-service/src/modules/warranties/warranty.model.js';
import { WarrantyService } from '../../../apps/service-operations-service/src/modules/warranties/warranty.service.js';
import { ServiceTicketModel } from '../../../apps/service-operations-service/src/modules/service-tickets/service-ticket.model.js';
import { ServiceTicketService } from '../../../apps/service-operations-service/src/modules/service-tickets/service-ticket.service.js';
import { OutboxEventModel } from '@hvac/database';
import { ConflictError } from '@hvac/errors';

describe('Phase 8: Service Operations Service Integration Tests', () => {
  const companyId = 'comp_cairo_hvac';
  const branchId = 'br_nasr_city';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Work Order Scheduling & Lifecycle', () => {
    it('should create and schedule work order and emit outbox event', async () => {
      const mockOrder = {
        companyId,
        workOrderId: 'wo_1001',
        orderNumber: 'WO-2026-1001',
        customerId: 'cust_ahmed_01',
        addressId: 'addr_cairo_01',
        branchId,
        serviceType: 'INSTALLATION',
        status: 'SCHEDULED',
        scheduledDate: new Date('2026-10-01T10:00:00Z'),
      };

      vi.spyOn(WorkOrderModel, 'create').mockResolvedValueOnce([mockOrder] as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const order = await WorkOrderService.createAndSchedule({
        companyId,
        customerId: 'cust_ahmed_01',
        addressId: 'addr_cairo_01',
        branchId,
        serviceType: 'INSTALLATION',
        scheduledDate: new Date('2026-10-01T10:00:00Z'),
        estimatedDurationHours: 3,
      });

      expect(order.status).toBe('SCHEDULED');
      expect(order.orderNumber).toBe('WO-2026-1001');
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should start and complete work order with spare parts and serials, emitting completion event', async () => {
      const mockOrder: any = {
        companyId,
        workOrderId: 'wo_1001',
        orderNumber: 'WO-2026-1001',
        customerId: 'cust_ahmed_01',
        branchId,
        status: 'SCHEDULED',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(WorkOrderModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockOrder),
      } as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const completed = await WorkOrderService.completeWorkOrder({
        companyId,
        workOrderId: 'wo_1001',
        technicianId: 'tech_mahmoud_01',
        installedSerialNumbers: ['SN-CR-999'],
        sparePartsUsed: [{ productId: 'part_copper_pipe', productName: 'Copper Pipe 5m', quantity: 1 }],
        customerRating: 5,
        customerFeedback: 'Excellent installation and clean work',
      });

      expect(completed.status).toBe('COMPLETED');
      expect(completed.customerRating).toBe(5);
      expect(mockOrder.save).toHaveBeenCalled();
      expect(outboxSpy).toHaveBeenCalled();
    });
  });

  describe('Warranty Registration & Active Coverage Lookup', () => {
    it('should register equipment warranty with machine and compressor dates', async () => {
      const mockWarranty = {
        companyId,
        warrantyId: 'war_1001',
        serialNumber: 'SN-CR-999',
        productId: 'prod_carrier_2.25',
        customerId: 'cust_ahmed_01',
        status: 'ACTIVE',
        machineExpiryDate: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000),
        compressorExpiryDate: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
      };

      vi.spyOn(WarrantyModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(null),
      } as any);
      vi.spyOn(WarrantyModel, 'create').mockResolvedValueOnce([mockWarranty] as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const warranty = await WarrantyService.registerWarranty({
        companyId,
        serialNumber: 'SN-CR-999',
        productId: 'prod_carrier_2.25',
        customerId: 'cust_ahmed_01',
        branchId,
      });

      expect(warranty.status).toBe('ACTIVE');
      expect(warranty.serialNumber).toBe('SN-CR-999');
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should reject duplicate warranty registration for the same serial number', async () => {
      vi.spyOn(WarrantyModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue({ serialNumber: 'SN-CR-999' }),
      } as any);

      await expect(
        WarrantyService.registerWarranty({
          companyId,
          serialNumber: 'SN-CR-999',
          productId: 'prod_carrier_2.25',
          customerId: 'cust_ahmed_01',
          branchId,
        })
      ).rejects.toThrow(ConflictError);
    });

    it('should accurately verify whether an AC unit is still covered under warranty', async () => {
      const now = new Date();
      const mockActiveWarranty = {
        companyId,
        serialNumber: 'SN-ACTIVE',
        status: 'ACTIVE',
        machineExpiryDate: new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000), // in 100 days
        compressorExpiryDate: new Date(now.getTime() + 500 * 24 * 60 * 60 * 1000),
      };

      vi.spyOn(WarrantyModel, 'findOne').mockResolvedValueOnce(mockActiveWarranty as any);

      const check = await WarrantyService.checkCoverage(companyId, 'SN-ACTIVE');
      expect(check.isValid).toBe(true);
      expect(check.isMachineCovered).toBe(true);
      expect(check.isCompressorCovered).toBe(true);
    });
  });

  describe('Customer Service Tickets & Breakdown Reporting', () => {
    it('should create emergency breakdown ticket and emit service.ticket.created event', async () => {
      const mockTicket = {
        companyId,
        ticketId: 'tck_1001',
        ticketNumber: 'TCK-2026-1001',
        customerId: 'cust_ahmed_01',
        customerAddressId: 'addr_cairo_01',
        branchId,
        category: 'BREAKDOWN',
        priority: 'EMERGENCY',
        title: 'Central Chiller compressor tripped unexpectedly',
        description: 'Chiller stopped cooling the server room, high ambient temperature',
        status: 'OPEN',
      };

      vi.spyOn(ServiceTicketModel, 'create').mockResolvedValueOnce([mockTicket] as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const ticket = await ServiceTicketService.createTicket({
        companyId,
        customerId: 'cust_ahmed_01',
        customerAddressId: 'addr_cairo_01',
        branchId,
        category: 'BREAKDOWN',
        priority: 'EMERGENCY',
        title: 'Central Chiller compressor tripped unexpectedly',
        description: 'Chiller stopped cooling the server room, high ambient temperature',
        reportedBy: 'usr_call_center_sarah',
      });

      expect(ticket.ticketNumber).toBe('TCK-2026-1001');
      expect(ticket.status).toBe('OPEN');
      expect(ticket.priority).toBe('EMERGENCY');
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should assign ticket to a work order and transition status to ASSIGNED', async () => {
      const mockTicket: any = {
        companyId,
        ticketId: 'tck_1001',
        status: 'OPEN',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(ServiceTicketModel, 'findOne').mockResolvedValueOnce(mockTicket);

      const assigned = await ServiceTicketService.assignToWorkOrder(
        companyId,
        'tck_1001',
        'wo_8888'
      );

      expect(assigned.status).toBe('ASSIGNED');
      expect(assigned.assignedWorkOrderId).toBe('wo_8888');
      expect(mockTicket.save).toHaveBeenCalled();
    });

    it('should resolve ticket and emit service.ticket.resolved event', async () => {
      const mockTicket: any = {
        companyId,
        ticketId: 'tck_1001',
        ticketNumber: 'TCK-2026-1001',
        customerId: 'cust_ahmed_01',
        branchId,
        status: 'ASSIGNED',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(ServiceTicketModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockTicket),
      } as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const resolved = await ServiceTicketService.resolveTicket(companyId, 'tck_1001');

      expect(resolved.status).toBe('RESOLVED');
      expect(mockTicket.save).toHaveBeenCalled();
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should close resolved service ticket', async () => {
      const mockTicket: any = {
        companyId,
        ticketId: 'tck_1001',
        status: 'RESOLVED',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(ServiceTicketModel, 'findOne').mockResolvedValueOnce(mockTicket);

      const closed = await ServiceTicketService.closeTicket(companyId, 'tck_1001');

      expect(closed.status).toBe('CLOSED');
      expect(mockTicket.save).toHaveBeenCalled();
    });
  });
});
