import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICustomerAddress extends Document {
  companyId: string;
  addressId: string;
  customerId: string;
  title: string;
  governorate: string;
  city: string;
  street: string;
  buildingNumber?: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
  };
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerAddressSchema = new Schema<ICustomerAddress>(
  {
    companyId: { type: String, required: true, index: true },
    addressId: { type: String, required: true, unique: true },
    customerId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    governorate: { type: String, required: true },
    city: { type: String, required: true },
    street: { type: String, required: true },
    buildingNumber: { type: String },
    floor: { type: String },
    apartment: { type: String },
    landmark: { type: String },
    gpsCoordinates: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    isDefault: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: 'customer_addresses',
  }
);

CustomerAddressSchema.index({ companyId: 1, customerId: 1 });

export const CustomerAddressModel: Model<ICustomerAddress> =
  mongoose.models.CustomerAddress ||
  mongoose.model<ICustomerAddress>('CustomerAddress', CustomerAddressSchema);
