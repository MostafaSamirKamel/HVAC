import { ClientSession } from 'mongoose';
import { NumberCounterModel } from '../models/counter.model.js';

export interface GenerateDocumentNumberParams {
  companyId: string;
  documentType: string;
  year?: number;
  branchId?: string;
  padding?: number;
  session?: ClientSession;
}

export async function generateDocumentNumber(params: GenerateDocumentNumberParams): Promise<string> {
  const year = params.year || new Date().getFullYear();
  const branchId = params.branchId || null;
  const padding = params.padding || 6;

  const counter = await NumberCounterModel.findOneAndUpdate(
    {
      companyId: params.companyId,
      documentType: params.documentType,
      year,
      branchId,
    },
    { $inc: { sequence: 1 } },
    {
      upsert: true,
      new: true,
      session: params.session,
      setDefaultsOnInsert: true,
    },
  );

  const seqStr = String(counter.sequence).padStart(padding, '0');
  return `${params.documentType}-${year}-${seqStr}`;
}
