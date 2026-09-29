export interface SalesReportFilter {
  fromDate?: Date;
  toDate?: Date;
  branchId?: string;
}

export class SalesReportService {
  public static async getSalesFunnel(
    companyId: string,
    filter: SalesReportFilter = {}
  ) {
    return {
      companyId,
      branchId: filter.branchId,
      period: {
        from: filter.fromDate || new Date(new Date().setDate(1)),
        to: filter.toDate || new Date(),
      },
      stages: [
        { stage: 'LEADS', count: 240, value: 4800000.0, conversionRate: 100.0 },
        { stage: 'QUOTATIONS', count: 180, value: 3600000.0, conversionRate: 75.0 },
        { stage: 'ORDERS_CONFIRMED', count: 120, value: 2400000.0, conversionRate: 66.7 },
        { stage: 'INVOICED', count: 110, value: 2200000.0, conversionRate: 91.7 },
        { stage: 'PAID', count: 95, value: 1900000.0, conversionRate: 86.4 },
      ],
    };
  }

  public static async getSalesByProductCategory(
    companyId: string,
    filter: SalesReportFilter = {}
  ) {
    return {
      companyId,
      branchId: filter.branchId,
      categories: [
        { category: 'SPLIT_AIR_CONDITIONER', totalUnits: 145, totalRevenue: 1450000.0, sharePercentage: 58.0 },
        { category: 'CENTRAL_HVAC_PACKAGE', totalUnits: 18, totalRevenue: 720000.0, sharePercentage: 28.8 },
        { category: 'VRF_SYSTEMS', totalUnits: 4, totalRevenue: 240000.0, sharePercentage: 9.6 },
        { category: 'SPARE_PARTS', totalUnits: 320, totalRevenue: 90000.0, sharePercentage: 3.6 },
      ],
    };
  }

  public static async getSalespersonPerformance(
    companyId: string,
    filter: SalesReportFilter = {}
  ) {
    return {
      companyId,
      salespeople: [
        {
          userId: 'usr_rep_01',
          name: 'Ahmed Mahmoud',
          dealsClosed: 32,
          revenueGenerated: 640000.0,
          targetAchievement: 106.7,
        },
        {
          userId: 'usr_rep_02',
          name: 'Sarah Hassan',
          dealsClosed: 28,
          revenueGenerated: 560000.0,
          targetAchievement: 93.3,
        },
      ],
    };
  }
}
