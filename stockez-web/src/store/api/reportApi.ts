import { baseApi } from './baseApi';

export const reportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAgingReport: builder.query<any, void>({
      query: () => '/reports/aging',
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
  }),
});

export const {
  useGetAgingReportQuery,
  useGetSalesAnalysisQuery,
  useGetCustomerLedgerQuery,
  useGetVendorLedgerQuery,
  useGetTargetsQuery,
  useCreateTargetMutation,
} = reportApi;
