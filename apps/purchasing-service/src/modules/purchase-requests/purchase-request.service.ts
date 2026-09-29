import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { NotFoundError, ValidationError } from '@hvac/errors';
import { Money } from '@hvac/money';
import { OutboxRepository, withTransaction } from '@hvac/database';
import {
  PurchaseRequestCreatedEvent,
  PurchaseRequestApprovedEvent,
} from '@hvac/event-contracts';
import {
  PurchaseRequestModel,
  IPurchaseRequest,
  IPurchaseRequestItem,
  PurchaseRequestPriority,
  PurchaseRequestStatus,
} from './purchase-request.model.js';
import { PurchaseOrderService } from '../purchase-orders/purchase-order.service.js';
import { IPurchaseOrder } from '../purchase-orders/purchase-order.model.js';

export interface CreatePurchaseRequestItemInput {
  productId: string;
  productName: string;
  requestedQuantity: number;
  estimatedUnitCost: number | string;
  purpose?: string;
}

export interface CreatePurchaseRequestInput {
  companyId: string;
  branchId: string;
  department: string;
  requestedBy: string;
  priority?: PurchaseRequestPriority;
  requiredDate?: Date;
  items: CreatePurchaseRequestItemInput[];
  currency?: string;
  notes?: string;
  status?: 'DRAFT' | 'SUBMITTED';
}

export class PurchaseRequestService {
  public static async createRequest(
    input: CreatePurchaseRequestInput,
    existingSession?: ClientSession
  ): Promise<IPurchaseRequest> {
    if (!input.items || input.items.length === 0) {
      throw new ValidationError('Purchase request must contain at least one item');
    }

    const currency = input.currency || 'EGP';
    let totalEstimatedMoney = Money.from(0, currency);
    const mappedItems: IPurchaseRequestItem[] = [];

    for (const item of input.items) {
      if (item.requestedQuantity <= 0) {
        throw new ValidationError('Item requested quantity must be greater than zero');
      }

      const unitCost = Money.from(item.estimatedUnitCost, currency);
      const lineCost = unitCost.multiply(item.requestedQuantity);
      totalEstimatedMoney = totalEstimatedMoney.add(lineCost);

      mappedItems.push({
        productId: item.productId,
        productName: item.productName,
        requestedQuantity: item.requestedQuantity,
        estimatedUnitCost: mongoose.Types.Decimal128.fromString(unitCost.toFixed(2)),
        estimatedTotalCost: mongoose.Types.Decimal128.fromString(lineCost.toFixed(2)),
        purpose: item.purpose,
      });
    }

    const requestId = randomUUID();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const requestNumber = `PR-${new Date().getFullYear()}-${randomSuffix}`;
    const initialStatus = input.status || 'SUBMITTED';

    const runner = async (session: ClientSession) => {
      const [request] = await PurchaseRequestModel.create(
        [
          {
            companyId: input.companyId,
            branchId: input.branchId,
            requestId,
            requestNumber,
            department: input.department,
            requestedBy: input.requestedBy,
            priority: input.priority || 'MEDIUM',
            status: initialStatus,
            requiredDate: input.requiredDate,
            items: mappedItems,
            totalEstimatedAmount: mongoose.Types.Decimal128.fromString(
              totalEstimatedMoney.toFixed(2)
            ),
            currency,
            notes: input.notes,
          },
        ],
        { session }
      );

      if (initialStatus === 'SUBMITTED') {
        const event = new PurchaseRequestCreatedEvent(
          {
            requestId: request.requestId,
            requestNumber: request.requestNumber,
            branchId: request.branchId,
            department: request.department,
            requestedBy: request.requestedBy,
            priority: request.priority,
            totalEstimatedAmount: Money.from(
              request.totalEstimatedAmount.toString(),
              currency
            ).toNumber(),
            currency,
            items: request.items.map((i) => ({
              productId: i.productId,
              productName: i.productName,
              requestedQuantity: i.requestedQuantity,
              estimatedUnitCost: Money.from(i.estimatedUnitCost.toString(), currency).toNumber(),
            })),
          },
          {
            companyId: input.companyId,
            branchId: input.branchId,
            correlationId: randomUUID(),
            causationId: randomUUID(),
          }
        );

        await OutboxRepository.recordEvent(event, session);
      }

      return request;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async submitRequest(
    companyId: string,
    requestId: string,
    existingSession?: ClientSession
  ): Promise<IPurchaseRequest> {
    const runner = async (session: ClientSession) => {
      const request = await PurchaseRequestModel.findOne({ companyId, requestId }).session(session);
      if (!request) {
        throw new NotFoundError(`Purchase request ${requestId} not found`);
      }

      if (request.status !== 'DRAFT') {
        throw new ValidationError(`Cannot submit purchase request with status '${request.status}'`);
      }

      request.status = 'SUBMITTED';
      await request.save({ session });

      const event = new PurchaseRequestCreatedEvent(
        {
          requestId: request.requestId,
          requestNumber: request.requestNumber,
          branchId: request.branchId,
          department: request.department,
          requestedBy: request.requestedBy,
          priority: request.priority,
          totalEstimatedAmount: Money.from(
            request.totalEstimatedAmount.toString(),
            request.currency
          ).toNumber(),
          currency: request.currency,
          items: request.items.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            requestedQuantity: i.requestedQuantity,
            estimatedUnitCost: Money.from(i.estimatedUnitCost.toString(), request.currency).toNumber(),
          })),
        },
        {
          companyId,
          branchId: request.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return request;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async approveRequest(
    companyId: string,
    requestId: string,
    approvedBy: string,
    existingSession?: ClientSession
  ): Promise<IPurchaseRequest> {
    const runner = async (session: ClientSession) => {
      const request = await PurchaseRequestModel.findOne({ companyId, requestId }).session(session);
      if (!request) {
        throw new NotFoundError(`Purchase request ${requestId} not found`);
      }

      if (request.status !== 'SUBMITTED') {
        throw new ValidationError(`Cannot approve purchase request with status '${request.status}'`);
      }

      request.status = 'APPROVED';
      request.approvedBy = approvedBy;
      request.approvedAt = new Date();
      await request.save({ session });

      const event = new PurchaseRequestApprovedEvent(
        {
          requestId: request.requestId,
          requestNumber: request.requestNumber,
          branchId: request.branchId,
          approvedBy,
          approvedAt: request.approvedAt.toISOString(),
        },
        {
          companyId,
          branchId: request.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return request;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async rejectRequest(
    companyId: string,
    requestId: string,
    _rejectedBy: string,
    reason: string,
    session?: ClientSession
  ): Promise<IPurchaseRequest> {
    const query = PurchaseRequestModel.findOne({ companyId, requestId });
    const request = session ? await query.session(session) : await query;
    if (!request) {
      throw new NotFoundError(`Purchase request ${requestId} not found`);
    }

    if (request.status !== 'SUBMITTED') {
      throw new ValidationError(`Cannot reject purchase request with status '${request.status}'`);
    }

    request.status = 'REJECTED';
    request.rejectionReason = reason;
    await request.save({ session });

    return request;
  }

  public static async convertToPO(
    companyId: string,
    requestId: string,
    supplierId: string,
    warehouseId: string,
    createdBy: string,
    existingSession?: ClientSession
  ): Promise<{ request: IPurchaseRequest; purchaseOrder: IPurchaseOrder }> {
    const runner = async (session: ClientSession) => {
      const request = await PurchaseRequestModel.findOne({ companyId, requestId }).session(session);
      if (!request) {
        throw new NotFoundError(`Purchase request ${requestId} not found`);
      }

      if (request.status !== 'APPROVED') {
        throw new ValidationError(
          `Only APPROVED purchase requests can be converted to Purchase Orders. Current status: '${request.status}'`
        );
      }

      // Create Purchase Order from requested items
      const po = await PurchaseOrderService.createOrder(
        {
          companyId,
          supplierId,
          branchId: request.branchId,
          warehouseId,
          currency: request.currency,
          notes: `Converted from Purchase Request ${request.requestNumber}. Notes: ${request.notes || ''}`,
          createdBy,
          items: request.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.requestedQuantity,
            unitCost: item.estimatedUnitCost.toString(),
          })),
        },
        session
      );

      request.status = 'CONVERTED_TO_PO';
      request.purchaseOrderId = po.purchaseOrderId;
      await request.save({ session });

      return { request, purchaseOrder: po };
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async getRequestById(
    companyId: string,
    requestId: string
  ): Promise<IPurchaseRequest> {
    const request = await PurchaseRequestModel.findOne({ companyId, requestId });
    if (!request) {
      throw new NotFoundError(`Purchase request ${requestId} not found`);
    }
    return request;
  }

  public static async listRequests(
    companyId: string,
    filter: {
      branchId?: string;
      status?: PurchaseRequestStatus;
      department?: string;
      requestedBy?: string;
    } = {}
  ): Promise<IPurchaseRequest[]> {
    const query: Record<string, unknown> = { companyId };
    if (filter.branchId) query.branchId = filter.branchId;
    if (filter.status) query.status = filter.status;
    if (filter.department) query.department = filter.department;
    if (filter.requestedBy) query.requestedBy = filter.requestedBy;

    return PurchaseRequestModel.find(query).sort({ createdAt: -1 });
  }
}
