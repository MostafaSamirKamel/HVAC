import { FinanceClientAdapter } from '../../sagas/cash-sale/cash-sale.saga.js';
import { getServiceEndpoints } from '@hvac/config';

export class HttpFinanceAdapter implements FinanceClientAdapter {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = getServiceEndpoints().finance;
  }

  async collectPayment(params: any): Promise<{ paymentId: string; receiptNumber: string }> {
    return {
      paymentId: `pay_${Math.random().toString(36).substring(2, 9)}`,
      receiptNumber: `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    };
  }

  async refundPayment(params: any): Promise<{ refundId: string }> {
    return { refundId: `ref_${Math.random().toString(36).substring(2, 9)}` };
  }

  async postJournalEntry(params: any): Promise<{ journalEntryId: string }> {
    return { journalEntryId: `je_${Math.random().toString(36).substring(2, 9)}` };
  }
}
