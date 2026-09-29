export interface InventoryReportFilter {
  warehouseId?: string;
  category?: string;
}

export class InventoryReportService {
  public static async getInventoryValuation(
    companyId: string,
    filter: InventoryReportFilter = {}
  ) {
    return {
      companyId,
      warehouseId: filter.warehouseId,
      totalValuation: 18900000.0,
      valuationMethod: 'FIFO',
      warehouses: [
        { warehouseId: 'wh_cairo_central', name: 'Cairo Central Warehouse', totalSkus: 420, valuation: 11200000.0 },
        { warehouseId: 'wh_nasr_city', name: 'Nasr City Branch Warehouse', totalSkus: 180, valuation: 4500000.0 },
        { warehouseId: 'wh_alex_smouha', name: 'Alexandria Warehouse', totalSkus: 130, valuation: 3200000.0 },
      ],
      categoryBreakdown: [
        { category: 'SPLIT_AC', valuation: 12500000.0, percentage: 66.1 },
        { category: 'PACKAGE_AC', valuation: 4200000.0, percentage: 22.2 },
        { category: 'SPARE_PARTS', valuation: 2200000.0, percentage: 11.7 },
      ],
    };
  }

  public static async getInventoryTurnover(
    companyId: string,
    filter: InventoryReportFilter = {}
  ) {
    return {
      companyId,
      annualizedTurnoverRatio: 6.4,
      averageDaysToSell: 57.0,
      fastMovingItems: [
        { productId: 'prod_carrier_split_15hp', productName: 'Carrier Optimax 1.5 HP', turnoverRate: 12.8, daysOnHand: 28 },
        { productId: 'prod_sharp_split_225hp', productName: 'Sharp Inverter 2.25 HP', turnoverRate: 10.4, daysOnHand: 35 },
      ],
      slowMovingItems: [
        { productId: 'prod_central_chiller_50ton', productName: 'York Air-Cooled Chiller 50 Ton', turnoverRate: 1.2, daysOnHand: 304, daysInactive: 95 },
        { productId: 'prod_compressor_special_5hp', productName: 'Special R22 Semi-Hermetic Compressor', turnoverRate: 0.8, daysOnHand: 450, daysInactive: 120 },
      ],
    };
  }
}
