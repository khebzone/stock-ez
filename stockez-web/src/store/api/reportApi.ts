import { baseApi } from './baseApi';

export const reportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDailyReport: builder.query<any, string>({
      query: (date) => `/reports/daily?date=${date}`,
      providesTags: ['Order', 'Payment'],
    }),
    getAgingReport: builder.query<any, string>({
      query: (asOfDate) => `/reports/aging?asOfDate=${asOfDate}`,
      providesTags: ['Order'],
    }),
    getSalesAnalysis: builder.query<any, { from: string; to: string; groupBy: string }>({
      query: ({ from, to, groupBy }) => `/reports/sales-analysis?from=${from}&to=${to}&groupBy=${groupBy}`,
      providesTags: ['Order'],
    }),
    getCustomerLedger: builder.query<any, { customerId: string; from: string; to: string }>({
      query: ({ customerId, from, to }) => `/reports/ledger/customer/${customerId}?from=${from}&to=${to}`,
      providesTags: ['Order', 'Payment'],
    }),
    getCustomerHistory: builder.query<any, { customerId: string; from: string; to: string }>({
      query: ({ customerId, from, to }) => `/reports/history/customer/${customerId}?from=${from}&to=${to}`,
      providesTags: ['Order', 'Payment'],
    }),
    getSupplierHistory: builder.query<any, { supplierName: string; from: string; to: string }>({
      query: ({ supplierName, from, to }) =>
        `/reports/history/supplier?supplierName=${encodeURIComponent(supplierName)}&from=${from}&to=${to}`,
      providesTags: ['Purchase'],
    }),
    getVendorLedger: builder.query<any, { from: string; to: string }>({
      query: ({ from, to }) => `/reports/ledger/vendors?from=${from}&to=${to}`,
      providesTags: ['Purchase'],
    }),
    getTargets: builder.query<any, { month: number; year: number }>({
      query: ({ month, year }) => `/targets?month=${month}&year=${year}`,
      providesTags: ['Target'],
    }),
    createTarget: builder.mutation<any, any>({
      query: (body) => ({ url: '/targets', method: 'POST', body }),
      invalidatesTags: ['Target'],
    }),
    getClosingStock: builder.query<any, void>({
      query: () => '/reports/closing-stock',
      providesTags: ['Purchase'],
    }),
    getDeadStock: builder.query<any, { days?: number; brand?: string; category?: string }>({
      query: ({ days = 30, brand, category } = {}) => {
        const params = new URLSearchParams();
        params.append('days', String(days));
        if (brand) params.append('brand', brand);
        if (category) params.append('category', category);
        return `/reports/dead-stock?${params}`;
      },
      providesTags: ['Order'],
    }),
    getSalesmanDeadStock: builder.query<any, { days?: number; salesPersonId?: string }>({
      query: ({ days = 30, salesPersonId } = {}) => {
        const params = new URLSearchParams({ days: String(days) });
        if (salesPersonId) params.append('salesPersonId', salesPersonId);
        return `/reports/salesman-dead-stock?${params}`;
      },
      providesTags: ['Order'],
    }),
    getSalesRegister: builder.query<any, { from: string; to: string }>({
      query: ({ from, to }) => `/reports/sales-register?from=${from}&to=${to}`,
      providesTags: ['Order'],
    }),
    getPurchaseRegister: builder.query<any, { from: string; to: string }>({
      query: ({ from, to }) => `/reports/purchase-register?from=${from}&to=${to}`,
      providesTags: ['Purchase'],
    }),
    getGstr1: builder.query<any, { from: string; to: string }>({
      query: ({ from, to }) => `/reports/gstr1?from=${from}&to=${to}`,
      providesTags: ['Order', 'Customer', 'Product'],
    }),
    getCollectionDetail: builder.query<any, { from: string; to: string }>({
      query: ({ from, to }) => `/reports/collection-detail?from=${from}&to=${to}`,
      providesTags: ['Payment'],
    }),
    getCustomerSales: builder.query<any, { from: string; to: string }>({
      query: ({ from, to }) => `/reports/customer-sales?from=${from}&to=${to}`,
      providesTags: ['Order'],
    }),
    getCustomerItemReport: builder.query<any, { customerId: string; from: string; to: string }>({
      query: ({ customerId, from, to }) => `/reports/customer-item?customerId=${customerId}&from=${from}&to=${to}`,
      providesTags: ['Order'],
    }),
    getRouteItemReport: builder.query<any, { routeId?: string; from: string; to: string }>({
      query: ({ routeId, from, to }) => {
        const params = new URLSearchParams({ from, to });
        if (routeId) params.append('routeId', routeId);
        return `/reports/route-item?${params}`;
      },
      providesTags: ['Order'],
    }),
    getItemHistory: builder.query<any, { productId: string; customerId?: string; from: string; to: string }>({
      query: ({ productId, customerId, from, to }) => {
        const params = new URLSearchParams({ productId, from, to });
        if (customerId) params.append('customerId', customerId);
        return `/reports/item-history?${params}`;
      },
      providesTags: ['Order'],
    }),
    getRouteOutstanding: builder.query<any, { asOfDate?: string }>({
      query: ({ asOfDate } = {}) => `/reports/route-outstanding${asOfDate ? `?asOfDate=${asOfDate}` : ''}`,
      providesTags: ['Order'],
    }),
  }),
});

export const {
  useGetDailyReportQuery,
  useGetAgingReportQuery,
  useGetSalesAnalysisQuery,
  useGetCustomerLedgerQuery,
  useGetCustomerHistoryQuery,
  useGetSupplierHistoryQuery,
  useGetVendorLedgerQuery,
  useGetTargetsQuery,
  useCreateTargetMutation,
  useGetClosingStockQuery,
  useGetDeadStockQuery,
  useGetSalesmanDeadStockQuery,
  useGetSalesRegisterQuery,
  useGetGstr1Query,
  useGetPurchaseRegisterQuery,
  useGetCollectionDetailQuery,
  useGetCustomerSalesQuery,
  useGetCustomerItemReportQuery,
  useGetRouteItemReportQuery,
  useGetItemHistoryQuery,
  useGetRouteOutstandingQuery,
} = reportApi;
