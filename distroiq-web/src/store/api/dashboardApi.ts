import { baseApi } from './baseApi';

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminDashboard: builder.query<any, void>({
      query: () => '/dashboard/admin',
    }),
    getSalesDashboard: builder.query<any, void>({
      query: () => '/dashboard/sales',
    }),
    getWarehouseDashboard: builder.query<any, void>({
      query: () => '/dashboard/warehouse',
    }),
    getSalesReport: builder.query<any, { from: string; to: string }>({
      query: ({ from, to }) => `/reports/sales-trend?from=${from}&to=${to}`,
    }),
    getCollectionReport: builder.query<any, { from: string; to: string }>({
      query: ({ from, to }) => `/reports/collections?from=${from}&to=${to}`,
    }),
  }),
});

export const {
  useGetAdminDashboardQuery,
  useGetSalesDashboardQuery,
  useGetWarehouseDashboardQuery,
  useGetSalesReportQuery,
  useGetCollectionReportQuery,
} = dashboardApi;
