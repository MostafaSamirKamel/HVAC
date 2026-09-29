import { randomUUID } from 'crypto';
import { ClientSession } from 'mongoose';
import { NotFoundError, ValidationError } from '@hvac/errors';
import { OutboxRepository, withTransaction } from '@hvac/database';
import { WorkOrderScheduledEvent, WorkOrderCompletedEvent } from '@hvac/event-contracts';
import {
  WorkOrderModel,
  IWorkOrder,
  WorkOrderStatus,
  ServiceType,
  ISparePartUsage,
} from './work-order.model.js';
import { ServiceTicketModel } from '../service-tickets/service-ticket.model.js';

export interface CreateWorkOrderInput {
  companyId: string;
  ticketId?: string;
  customerId: string;
  addressId: string;
  branchId: string;
  technicianId?: string;
  serviceType: ServiceType;
  scheduledDate: Date;
  estimatedDurationHours?: number;
  notes?: string;
}

export interface CompleteWorkOrderInput {
  companyId: string;
  workOrderId: string;
  technicianId: string;
  installedSerialNumbers?: string[];
  sparePartsUsed?: ISparePartUsage[];
  customerSignature?: string;
  customerRating?: number;
  customerFeedback?: string;
  notes?: string;
}

export class WorkOrderService {
  public static async createAndSchedule(
    input: CreateWorkOrderInput,
    existingSession?: ClientSession
  ): Promise<IWorkOrder> {
    const runner = async (session: ClientSession) => {
      const workOrderId = randomUUID();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `WO-${new Date().getFullYear()}-${randomSuffix}`;

      const [order] = await WorkOrderModel.create(
        [
          {
            companyId: input.companyId,
            workOrderId,
            orderNumber,
            ticketId: input.ticketId,
            customerId: input.customerId,
            addressId: input.addressId,
            branchId: input.branchId,
            technicianId: input.technicianId,
            serviceType: input.serviceType,
            status: 'SCHEDULED',
            scheduledDate: input.scheduledDate,
            estimatedDurationHours: input.estimatedDurationHours || 2,
            notes: input.notes,
          },
        ],
        { session }
      );

      // If associated with a ticket, update ticket status to ASSIGNED
      if (input.ticketId) {
        await ServiceTicketModel.updateOne(
          { companyId: input.companyId, ticketId: input.ticketId },
          { $set: { status: 'ASSIGNED', assignedWorkOrderId: workOrderId } },
          { session }
        );
      }

      // Outbox Event
      const event = new WorkOrderScheduledEvent(
        {
          workOrderId,
          orderNumber,
          ticketId: input.ticketId,
          customerId: input.customerId,
          addressId: input.addressId,
          technicianId: input.technicianId,
          serviceType: input.serviceType,
          scheduledDate: input.scheduledDate.toISOString(),
          branchId: input.branchId,
        },
        {
          companyId: input.companyId,
          branchId: input.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return order;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async startWorkOrder(
    companyId: string,
    workOrderId: string
  ): Promise<IWorkOrder> {
    const order = await WorkOrderModel.findOne({ companyId, workOrderId });
    if (!order) {
      throw new NotFoundError(`Work order ${workOrderId} not found`);
    }

    order.status = 'IN_PROGRESS';
    order.actualStartTime = new Date();
    await order.save();

    return order;
  }

  public static async completeWorkOrder(
    input: CompleteWorkOrderInput,
    existingSession?: ClientSession
  ): Promise<IWorkOrder> {
    const runner = async (session: ClientSession) => {
      const order = await WorkOrderModel.findOne({
        companyId: input.companyId,
        workOrderId: input.workOrderId,
      }).session(session);

      if (!order) {
        throw new NotFoundError(`Work order ${input.workOrderId} not found`);
      }

      if (order.status === 'COMPLETED') {
        return order; // Idempotent
      }

      const now = new Date();
      order.status = 'COMPLETED';
      order.actualEndTime = now;
      order.completedAt = now;
      order.technicianId = input.technicianId || order.technicianId;
      order.installedSerialNumbers = input.installedSerialNumbers || [];
      order.sparePartsUsed = input.sparePartsUsed || [];
      order.customerSignature = input.customerSignature;
      order.customerRating = input.customerRating;
      order.customerFeedback = input.customerFeedback;
      if (input.notes) order.notes = `${order.notes || ''} | ${input.notes}`;

      await order.save({ session });

      // If associated with a ticket, mark ticket RESOLVED
      if (order.ticketId) {
        await ServiceTicketModel.updateOne(
          { companyId: input.companyId, ticketId: order.ticketId },
          { $set: { status: 'RESOLVED', resolvedAt: now } },
          { session }
        );
      }

      // Outbox Event (triggers technician commission & inventory deduction downstream)
      const event = new WorkOrderCompletedEvent(
        {
          workOrderId: order.workOrderId,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          technicianId: input.technicianId,
          completedAt: now.toISOString(),
          installedSerialNumbers: input.installedSerialNumbers,
          sparePartsUsed: input.sparePartsUsed?.map((p) => ({
            productId: p.productId,
            quantity: p.quantity,
          })),
          branchId: order.branchId,
        },
        {
          companyId: input.companyId,
          branchId: order.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return order;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async getOrderById(companyId: string, workOrderId: string): Promise<IWorkOrder> {
    const order = await WorkOrderModel.findOne({ companyId, workOrderId });
    if (!order) {
      throw new NotFoundError(`Work order ${workOrderId} not found`);
    }
    return order;
  }

  public static async listOrders(
    companyId: string,
    filter: { branchId?: string; technicianId?: string; status?: WorkOrderStatus }
  ): Promise<IWorkOrder[]> {
    const query: Record<string, unknown> = { companyId };
    if (filter.branchId) query.branchId = filter.branchId;
    if (filter.technicianId) query.technicianId = filter.technicianId;
    if (filter.status) query.status = filter.status;

    return WorkOrderModel.find(query).sort({ scheduledDate: -1 });
  }
}
