import { baseApi } from './baseApi';

export const purchaseApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllPurchases: builder.query<any, void>({
      query: () => '/purchases/all',
      providesTags: ['Purchase'],
    }),
    getPurchases: builder.query<any, { page?: number; size?: number; status?: string; supplierName?: string; invoiceNumber?: string; from?: string; to?: string }>({
      query: (params = {}) => {
        const { page = 0, size = 20, status, supplierName, invoiceNumber, from, to } = params;
        const q = new URLSearchParams({ page: String(page), size: String(size) });
        if (status) q.set('status', status);
        if (supplierName) q.set('supplierName', supplierName);
        if (invoiceNumber) q.set('invoiceNumber', invoiceNumber);
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
      invalidatesTags: ['Purchase', 'Product', 'PurchaseDraft'],
    }),
    updatePurchase: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({ url: `/purchases/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Purchase'],
    }),
    updatePurchaseBill: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({ url: `/purchases/${id}/bill`, method: 'PUT', body }),
      invalidatesTags: ['Purchase', 'Product', 'SupplierPayment'],
    }),
    voidPurchase: builder.mutation<any, string>({
      query: (id) => ({ url: `/purchases/${id}/void`, method: 'POST' }),
      invalidatesTags: ['Purchase', 'Product', 'SupplierPayment'],
    }),
    updateBatchRates: builder.mutation<any, { id: string; minSaleRate: number; maxSaleRate: number; expiryDate?: string }>({
      query: ({ id, ...body }) => ({ url: `/purchases/batches/${id}/rates`, method: 'PUT', body }),
      invalidatesTags: ['Purchase', 'Product'],
    }),
    getBatchesByProduct: builder.query<any, string>({
      query: (productId) => `/purchases/batches/product/${productId}`,
      providesTags: ['Purchase', 'Product'],
    }),
    getNearExpiryAlerts: builder.query<any, { days?: number }>({
      query: ({ days = 30 } = {}) => `/purchases/alerts/near-expiry?days=${days}`,
      providesTags: ['Purchase'],
    }),
    getAllBatches: builder.query<any, { status?: string; brand?: string; search?: string; page?: number; size?: number }>({
      query: ({ status = 'active', brand, search, page = 0, size = 50 } = {}) => {
        const q = new URLSearchParams({ status, page: String(page), size: String(size) });
        if (brand) q.set('brand', brand);
        if (search) q.set('search', search);
        return `/purchases/batches?${q}`;
      },
      providesTags: ['Purchase'],
    }),
    getUnpaidPurchaseEntries: builder.query<any, string>({
      query: (supplierName) => `/supplier-payments/unpaid-entries?supplierName=${encodeURIComponent(supplierName)}`,
      providesTags: ['SupplierPayment'],
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
    getPurchaseDrafts: builder.query<any, void>({
      query: () => '/purchase-drafts',
      providesTags: ['PurchaseDraft'],
    }),
    getPurchaseDraft: builder.query<any, string>({
      query: (id) => `/purchase-drafts/${id}`,
      providesTags: ['PurchaseDraft'],
    }),
    savePurchaseDraft: builder.mutation<any, { id?: string; body: any }>({
      query: ({ id, body }) => id
        ? { url: `/purchase-drafts/${id}`, method: 'PUT', body }
        : { url: '/purchase-drafts', method: 'POST', body },
      invalidatesTags: ['PurchaseDraft'],
    }),
    deletePurchaseDraft: builder.mutation<any, string>({
      query: (id) => ({ url: `/purchase-drafts/${id}`, method: 'DELETE' }),
      invalidatesTags: ['PurchaseDraft'],
    }),
    getPurchaseAudit: builder.query<any, string>({
      query: (id) => `/purchases/${id}/audit`,
      providesTags: ['Purchase'],
    }),
  }),
});

export const {
  useUpdateBatchRatesMutation,
  useGetUnpaidPurchaseEntriesQuery,
  useGetAllPurchasesQuery,
  useGetPurchasesQuery,
  useGetPurchaseQuery,
  useCreatePurchaseMutation,
  useUpdatePurchaseMutation,
  useUpdatePurchaseBillMutation,
  useVoidPurchaseMutation,
  useGetBatchesByProductQuery,
  useGetNearExpiryAlertsQuery,
  useGetAllBatchesQuery,
  useGetSupplierPaymentSummariesQuery,
  useGetSupplierPaymentsQuery,
  useCreateSupplierPaymentMutation,
  useDeleteSupplierPaymentMutation,
  useGetPurchaseAuditQuery,
  useGetPurchaseDraftsQuery,
  useLazyGetPurchaseDraftQuery,
  useSavePurchaseDraftMutation,
  useDeletePurchaseDraftMutation,
} = purchaseApi;
