import mongoose, { Schema, Document, Model } from 'mongoose';

export type TicketCategory = 'INSTALLATION' | 'BREAKDOWN' | 'PERIODIC_MAINTENANCE' | 'COMPLAINT';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
export type TicketStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface IServiceTicket extends Document {
  companyId: string;
  ticketId: string;
  ticketNumber: string;
  customerId: string;
  customerAddressId: string;
  branchId: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  title: string;
  description: string;
  reportedBy: string;
  assignedWorkOrderId?: string;
  resolvedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceTicketSchema = new Schema<IServiceTicket>(
  {
    companyId: { type: String, required: true, index: true },
    ticketId: { type: String, required: true, unique: true },
    ticketNumber: { type: String, required: true },
    customerId: { type: String, required: true, index: true },
    customerAddressId: { type: String, required: true },
    branchId: { type: String, required: true, index: true },
    category: {
      type: String,
      required: true,
      enum: ['INSTALLATION', 'BREAKDOWN', 'PERIODIC_MAINTENANCE', 'COMPLAINT'],
    },
    priority: {
      type: String,
      required: true,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'],
      default: 'MEDIUM',
    },
    status: {
      type: String,
      required: true,
      enum: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    reportedBy: { type: String, required: true },
    assignedWorkOrderId: { type: String },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'service_tickets',
  }
);

// Multi-tenant unique index on ticket number
ServiceTicketSchema.index({ companyId: 1, ticketNumber: 1 }, { unique: true });
ServiceTicketSchema.index({ companyId: 1, customerId: 1, status: 1 });

export const ServiceTicketModel: Model<IServiceTicket> =
  mongoose.models.ServiceTicket ||
  mongoose.model<IServiceTicket>('ServiceTicket', ServiceTicketSchema);
