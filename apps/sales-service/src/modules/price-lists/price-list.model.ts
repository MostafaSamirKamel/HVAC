import mongoose, { Schema, Document, Model } from 'mongoose';

export interface PriceListItem {
  productId: string;
  price: mongoose.Types.Decimal128;
  minQuantity?: number;
}

export interface PriceListDocument extends Document {
  companyId: string;
  priceListId: string;
  name: string;
  currency: string;
  items: PriceListItem[];
  isDefault: boolean;
  isActive: boolean;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const PriceListItemSchema = new Schema<PriceListItem>(
  {
    productId: { type: String, required: true },
    price: { type: Schema.Types.Decimal128, required: true },
    minQuantity: { type: Number, default: 1 },
  },
  { _id: false },
);

export const PriceListSchema = new Schema<PriceListDocument>(
  {
    companyId: { type: String, required: true, index: true },
    priceListId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    currency: { type: String, required: true, default: 'EGP' },
    items: [PriceListItemSchema],
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    schemaVersion: { type: Number, default: 1, required: true },
  },
  {
    timestamps: true,
    collection: 'price_lists',
  },
);

// Rule 5: Tenant-aware unique index
PriceListSchema.index({ companyId: 1, name: 1 }, { unique: true });
PriceListSchema.index({ companyId: 1, priceListId: 1 }, { unique: true });

export const PriceListModel: Model<PriceListDocument> =
  mongoose.models.PriceList || mongoose.model<PriceListDocument>('PriceList', PriceListSchema);
