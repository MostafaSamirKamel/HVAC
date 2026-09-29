import { randomUUID } from 'crypto';
import { ClientSession } from 'mongoose';
import { NotFoundError, ValidationError } from '@hvac/errors';
import { OutboxRepository, withTransaction } from '@hvac/database';
import {
  ServiceTicketCreatedEvent,
  ServiceTicketResolvedEvent,
} from '@hvac/event-contracts';
import {
  ServiceTicketModel,
  IServiceTicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from './service-ticket.model.js';

export interface CreateTicketInput {
  companyId: string;
  customerId: string;
  customerAddressId: string;
  branchId: string;
  category: TicketCategory;
  priority?: TicketPriority;
  title: string;
  description: string;
  reportedBy: string;
}

export class ServiceTicketService {
  public static async createTicket(
    input: CreateTicketInput,
    existingSession?: ClientSession
  ): Promise<IServiceTicket> {
    const runner = async (session: ClientSession) => {
      const ticketId = randomUUID();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const ticketNumber = `TCK-${new Date().getFullYear()}-${randomSuffix}`;

      const [ticket] = await ServiceTicketModel.create(
        [
          {
            companyId: input.companyId,
            ticketId,
            ticketNumber,
            customerId: input.customerId,
            customerAddressId: input.customerAddressId,
            branchId: input.branchId,
            category: input.category,
            priority: input.priority || 'MEDIUM',
            status: 'OPEN',
            title: input.title,
            description: input.description,
            reportedBy: input.reportedBy,
          },
        ],
        { session }
      );

      const event = new ServiceTicketCreatedEvent(
        {
          ticketId,
          ticketNumber,
          customerId: input.customerId,
          category: input.category,
          priority: ticket.priority,
          title: input.title,
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

      return ticket;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async assignToWorkOrder(
    companyId: string,
    ticketId: string,
    workOrderId: string,
    session?: ClientSession
  ): Promise<IServiceTicket> {
    const query = ServiceTicketModel.findOne({ companyId, ticketId });
    const ticket = session ? await query.session(session) : await query;

    if (!ticket) {
      throw new NotFoundError(`Service ticket ${ticketId} not found`);
    }

    ticket.assignedWorkOrderId = workOrderId;
    ticket.status = 'ASSIGNED';
    await ticket.save({ session });

    return ticket;
  }

  public static async resolveTicket(
    companyId: string,
    ticketId: string,
    existingSession?: ClientSession
  ): Promise<IServiceTicket> {
    const runner = async (session: ClientSession) => {
      const ticket = await ServiceTicketModel.findOne({ companyId, ticketId }).session(session);
      if (!ticket) {
        throw new NotFoundError(`Service ticket ${ticketId} not found`);
      }

      ticket.status = 'RESOLVED';
      ticket.resolvedAt = new Date();
      await ticket.save({ session });

      const event = new ServiceTicketResolvedEvent(
        {
          ticketId,
          ticketNumber: ticket.ticketNumber,
          customerId: ticket.customerId,
          resolvedAt: ticket.resolvedAt.toISOString(),
          branchId: ticket.branchId,
        },
        {
          companyId,
          branchId: ticket.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return ticket;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async closeTicket(
    companyId: string,
    ticketId: string,
    session?: ClientSession
  ): Promise<IServiceTicket> {
    const query = ServiceTicketModel.findOne({ companyId, ticketId });
    const ticket = session ? await query.session(session) : await query;
    if (!ticket) {
      throw new NotFoundError(`Service ticket ${ticketId} not found`);
    }

    ticket.status = 'CLOSED';
    ticket.closedAt = new Date();
    await ticket.save({ session });

    return ticket;
  }

  public static async getTicketById(
    companyId: string,
    ticketId: string
  ): Promise<IServiceTicket> {
    const ticket = await ServiceTicketModel.findOne({ companyId, ticketId });
    if (!ticket) {
      throw new NotFoundError(`Service ticket ${ticketId} not found`);
    }
    return ticket;
  }

  public static async listTickets(
    companyId: string,
    filter: {
      customerId?: string;
      branchId?: string;
      status?: TicketStatus;
      category?: TicketCategory;
    } = {}
  ): Promise<IServiceTicket[]> {
    const query: Record<string, unknown> = { companyId };
    if (filter.customerId) query.customerId = filter.customerId;
    if (filter.branchId) query.branchId = filter.branchId;
    if (filter.status) query.status = filter.status;
    if (filter.category) query.category = filter.category;

    return ServiceTicketModel.find(query).sort({ createdAt: -1 });
  }
}
