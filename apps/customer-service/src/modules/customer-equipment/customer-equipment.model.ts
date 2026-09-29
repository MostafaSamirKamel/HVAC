import mongoose, { Schema, Document, Model } from 'mongoose';

export type EquipmentType = 'SPLIT' | 'CONCEALED' | 'VRF' | 'PACKAGE' | 'CHILLER' | 'OTHER';
export type WarrantyStatus = 'ACTIVE' | 'EXPIRED' | 'VOID';

export interface IServiceHistoryEntry {
  serviceDate: Date;
  workOrderId?: string;
  technicianId?: string;
  serviceType: string;
  description: string;
}

export interface ICustomerEquipment extends Document {
  companyId: string;
  branchId: string;
  equipmentId: string;
  customerId: string;
  addressId: string;
  serialNumber: string;
  brand: string;
  modelNumber?: string;
  equipmentType: EquipmentType;
  capacityHP?: number;
  capacityTonnage?: number;
  installationDate: Date;
  warrantyStartDate: Date;
  warrantyEndDate: Date;
  warrantyStatus: WarrantyStatus;
  lastServiceDate?: Date;
  serviceContractId?: string;
  serviceHistory: IServiceHistoryEntry[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceHistorySchema = new Schema<IServiceHistoryEntry>(
  {
    serviceDate: { type: Date, required: true },
    workOrderId: { type: String },
    technicianId: { type: String },
    serviceType: { type: String, required: true },
    description: { type: String, required: true },
  },
  { _id: false }
);

const CustomerEquipmentSchema = new Schema<ICustomerEquipment>(
  {
    companyId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    equipmentId: { type: String, required: true, unique: true },
    customerId: { type: String, required: true, index: true },
    addressId: { type: String, required: true, index: true },
    serialNumber: { type: String, required: true },
    brand: { type: String, required: true },
    modelNumber: { type: String },
    equipmentType: {
      type: String,
      required: true,
      enum: ['SPLIT', 'CONCEALED', 'VRF', 'PACKAGE', 'CHILLER', 'OTHER'],
      default: 'SPLIT',
    },
    capacityHP: { type: Number },
    capacityTonnage: { type: Number },
    installationDate: { type: Date, required: true },
    warrantyStartDate: { type: Date, required: true },
    warrantyEndDate: { type: Date, required: true },
    warrantyStatus: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'EXPIRED', 'VOID'],
      default: 'ACTIVE',
      index: true,
    },
    lastServiceDate: { type: Date },
    serviceContractId: { type: String },
    serviceHistory: { type: [ServiceHistorySchema], default: [] },
    notes: { type: String },
  },
  {
    timestamps: true,
    collection: 'customer_equipment',
  }
);

CustomerEquipmentSchema.index({ companyId: 1, serialNumber: 1 }, { unique: true });
CustomerEquipmentSchema.index({ companyId: 1, customerId: 1 });
CustomerEquipmentSchema.index({ companyId: 1, addressId: 1 });
CustomerEquipmentSchema.index({ companyId: 1, warrantyStatus: 1 });

export const CustomerEquipmentModel: Model<ICustomerEquipment> =
  mongoose.models.CustomerEquipment ||
  mongoose.model<ICustomerEquipment>('CustomerEquipment', CustomerEquipmentSchema);
