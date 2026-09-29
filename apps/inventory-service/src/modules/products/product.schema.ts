import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ProductDocument extends Document {
  companyId: string;
  productId: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  modelNumber?: string;
  coolingCapacityBtu?: number;
  horsepower?: string;
  refrigerantType?: string;
  basePrice: mongoose.Types.Decimal128;
  costPrice: mongoose.Types.Decimal128;
  isSerialized: boolean;
  minStockLevel: number;
  isActive: boolean;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export const ProductSchema = new Schema<ProductDocument>(
  {
    companyId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    modelNumber: { type: String, trim: true },
    coolingCapacityBtu: { type: Number },
    horsepower: { type: String, trim: true },
    refrigerantType: { type: String, trim: true },
    basePrice: { type: Schema.Types.Decimal128, required: true },
    costPrice: { type: Schema.Types.Decimal128, required: true },
    isSerialized: { type: Boolean, default: true },
    minStockLevel: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    schemaVersion: { type: Number, default: 1, required: true },
  },
  {
    timestamps: true,
    collection: 'products',
  },
);

// Rule 5: Tenant-aware unique indexes
ProductSchema.index({ companyId: 1, sku: 1 }, { unique: true });
ProductSchema.index({ companyId: 1, productId: 1 }, { unique: true });
ProductSchema.index({ companyId: 1, brand: 1, category: 1 });

export const ProductModel: Model<ProductDocument> =
  mongoose.models.Product || mongoose.model<ProductDocument>('Product', ProductSchema);
