import mongoose, { Schema, Document, Model } from 'mongoose';

export type WorkOrderStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'DISPATCHED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type ServiceType = 'INSTALLATION' | 'MAINTENANCE' | 'REPAIR' | 'WARRANTY_INSPECTION';

export interface ISparePartUsage {
  productId: string;
  productName: string;
  quantity: number;
}

export interface IWorkOrder extends Document {
  companyId: string;
  workOrderId: string;
  orderNumber: string;
  ticketId?: string;
  customerId: string;
  addressId: string;
  branchId: string;
  technicianId?: string;
  serviceType: ServiceType;
  status: WorkOrderStatus;
  scheduledDate: Date;
  estimatedDurationHours: number;
  actualStartTime?: Date;
  actualEndTime?: Date;
  sparePartsUsed: ISparePartUsage[];
  installedSerialNumbers: string[];
  notes?: string;
  customerSignature?: string;
  customerRating?: number;
  customerFeedback?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SparePartUsageSchema = new Schema<ISparePartUsage>(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
  },
  { _id: false }
);

const WorkOrderSchema = new Schema<IWorkOrder>(
  {
    companyId: { type: String, required: true, index: true },
    workOrderId: { type: String, required: true, unique: true },
    orderNumber: { type: String, required: true },
    ticketId: { type: String, index: true },
    customerId: { type: String, required: true, index: true },
    addressId: { type: String, required: true },
    branchId: { type: String, required: true, index: true },
    technicianId: { type: String, index: true },
    serviceType: {
      type: String,
      required: true,
      enum: ['INSTALLATION', 'MAINTENANCE', 'REPAIR', 'WARRANTY_INSPECTION'],
    },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'SCHEDULED', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'DRAFT',
    },
    scheduledDate: { type: Date, required: true },
    estimatedDurationHours: { type: Number, default: 2 },
    actualStartTime: { type: Date },
    actualEndTime: { type: Date },
    sparePartsUsed: { type: [SparePartUsageSchema], default: [] },
    installedSerialNumbers: { type: [String], default: [] },
    notes: { type: String },
    customerSignature: { type: String },
    customerRating: { type: Number, min: 1, max: 5 },
    customerFeedback: { type: String },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'work_orders',
  }
);

// Multi-tenant unique index on order number
WorkOrderSchema.index({ companyId: 1, orderNumber: 1 }, { unique: true });
WorkOrderSchema.index({ companyId: 1, technicianId: 1, scheduledDate: 1 });
WorkOrderSchema.index({ companyId: 1, status: 1 });

export const WorkOrderModel: Model<IWorkOrder> =
  mongoose.models.WorkOrder || mongoose.model<IWorkOrder>('WorkOrder', WorkOrderSchema);
