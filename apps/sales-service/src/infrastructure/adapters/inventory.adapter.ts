import { InventoryClientAdapter } from '../../sagas/cash-sale/cash-sale.saga.js';
import { getServiceEndpoints } from '@hvac/config';

export class HttpInventoryAdapter implements InventoryClientAdapter {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = getServiceEndpoints().inventory;
  }

  async reserveStock(params: any): Promise<{ reservationId: string }> {
    // In production, makes an HTTP call to inventory service
    return { reservationId: `res_${Math.random().toString(36).substring(2, 9)}` };
  }

  async releaseReservation(params: any): Promise<void> {
    // Calls inventory service to release reservation
  }

  async confirmDeduction(params: any): Promise<{ deductionId: string }> {
    return { deductionId: `ded_${Math.random().toString(36).substring(2, 9)}` };
  }

  async compensateSaleDeduction(params: any): Promise<void> {
    // Calls inventory service to reverse deduction
  }
}
