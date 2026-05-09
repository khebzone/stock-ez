import { baseApi } from './baseApi';

export const purchaseApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPurchases: builder.query<any, { page?: number; size?: number; supplierName?: string; from?: string; to?: string }>({
      query: (params = {}) => {
        const { page = 0, size = 20, supplierName, from, to } = params;
        const q = new URLSearchParams({ page: String(page), size: String(size) });
        if (supplierName) q.set('supplierName', supplierName);
        if (from) q.set('from', from);
        if (to) q.set('to', to);
        return `/purchases?${q}`;
      },
      providesTags: ['Purchase'],
    }),
    getPurchase: builder.query<any, string>({
      query: (id) => `/purchases/${id}`,
      providesTags: ['Purchase'],
    }),
    createPurchase: builder.mutation<any, any>({
      query: (body) => ({ url: '/purchases', method: 'POST', body }),
      invalidatesTags: ['Purchase', 'Product'],
    }),
    updatePurchase: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({ url: `/purchases/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Purchase'],
    }),
    getBatchesByProduct: builder.query<any, string>({
      query: (productId) => `/purchases/batches/product/${productId}`,
      providesTags: ['Purchase', 'Product'],
    }),
    getNearExpiryAlerts: builder.query<any, { days?: number }>({
      query: ({ days = 30 } = {}) => `/purchases/alerts/near-expiry?days=${days}`,
      providesTags: ['Purchase'],
    }),
    getAllBatches: builder.query<any, { status?: string; page?: number; size?: number }>({
      query: ({ status = 'active', page = 0, size = 50 } = {}) =>
        `/purchases/batches?status=${status}&page=${page}&size=${size}`,
      providesTags: ['Purchase'],
    }),
    getSupplierPaymentSummaries: builder.query<any, void>({
      query: () => '/supplier-payments/summaries',
      providesTags: ['SupplierPayment'],
    }),
    getSupplierPayments: builder.query<any, { supplierName?: string }>({
      query: ({ supplierName } = {}) => {
        const q = new URLSearchParams();
        if (supplierName) q.set('supplierName', supplierName);
        return `/supplier-payments?${q}`;
      },
      providesTags: ['SupplierPayment'],
    }),
    createSupplierPayment: builder.mutation<any, any>({
      query: (body) => ({ url: '/supplier-payments', method: 'POST', body }),
      invalidatesTags: ['SupplierPayment'],
    }),
    deleteSupplierPayment: builder.mutation<any, string>({
      query: (id) => ({ url: `/supplier-payments/${id}`, method: 'DELETE' }),
      invalidatesTags: ['SupplierPayment'],
    }),
    getPurchaseAudit: builder.query<any, string>({
      query: (id) => `/purchases/${id}/audit`,
      providesTags: ['Purchase'],
    }),
  }),
});

export const {
  useGetPurchasesQuery,
  useGetPurchaseQuery,
  useCreatePurchaseMutation,
  useUpdatePurchaseMutation,
  useGetBatchesByProductQuery,
  useGetNearExpiryAlertsQuery,
  useGetAllBatchesQuery,
  useGetSupplierPaymentSummariesQuery,
  useGetSupplierPaymentsQuery,
  useCreateSupplierPaymentMutation,
  useDeleteSupplierPaymentMutation,
  useGetPurchaseAuditQuery,
} = purchaseApi;
