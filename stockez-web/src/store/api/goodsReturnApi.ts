import { baseApi } from './baseApi';

export const goodsReturnApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listGoodsReturns: builder.query<any, { page?: number; size?: number }>({
      query: ({ page = 0, size = 20 } = {}) => `/goods-returns?page=${page}&size=${size}`,
      providesTags: ['Order', 'Product'],
    }),
    getGoodsReturn: builder.query<any, string>({
      query: (id) => `/goods-returns/${id}`,
      providesTags: ['Order'],
    }),
    createGoodsReturn: builder.mutation<any, any>({
      query: (body) => ({ url: '/goods-returns', method: 'POST', body }),
      invalidatesTags: ['Order', 'Product', 'Purchase'],
    }),
    getPendingRefunds: builder.query<any, void>({
      query: () => '/goods-returns/pending-refunds',
      providesTags: ['Order', 'Payment'],
    }),
    getCustomerRefunds: builder.query<any, void>({
      query: () => '/goods-returns/customer-refunds',
      providesTags: ['Order', 'Payment'],
    }),
    getSupplierClaims: builder.query<any, void>({
      query: () => '/goods-returns/supplier-claims',
      providesTags: ['Order', 'Payment'],
    }),
    getMyReturnHistory: builder.query<any, string>({
      query: (date) => `/goods-returns/my-history?date=${date}`,
      providesTags: ['Order'],
    }),
    processRefund: builder.mutation<any, {
      id: string;
      paymentMode?: string;
      refundDate: string;
      settlementMode?: 'CASH_REFUND' | 'ADJUST_AGAINST_BILL' | 'GOODS_REPLACED' | 'REJECTED';
      supplierRefNumber?: string;
      replacementExpiryDate?: string;
      notes?: string;
      acceptedItems?: { itemId: string; acceptedQty: number }[];
      acceptedAmount?: number;
    }>({
      query: ({ id, ...body }) => ({ url: `/goods-returns/${id}/process-refund`, method: 'POST', body }),
      // A settled claim changes the supplier payable, and GOODS_REPLACED puts stock back.
      invalidatesTags: ['Order', 'Payment', 'Product', 'Purchase', 'SupplierPayment'],
    }),
    getDebitNote: builder.query<any, string>({
      query: (id) => `/goods-returns/${id}/debit-note`,
      providesTags: ['Order'],
    }),
    getReturnedQtyByOrder: builder.query<any, string>({
      query: (orderId) => `/goods-returns/returned-qty/order/${orderId}`,
      providesTags: ['Order'],
    }),
    getReturnsByOrder: builder.query<any, string>({
      query: (orderId) => `/goods-returns/by-order/${orderId}`,
      providesTags: ['Order'],
    }),
    getPendingVerification: builder.query<any, void>({
      query: () => '/goods-returns/pending-verification',
      providesTags: ['Order', 'Product'],
    }),
    getWarehouseReturnHistory: builder.query<any, { from: string; to: string }>({
      query: ({ from, to }) => `/goods-returns/warehouse-history?from=${from}&to=${to}`,
      providesTags: ['Order', 'Product'],
    }),
    verifyGoodsReturn: builder.mutation<any, { id: string; items: { itemId: string; receivedQty: number; damagedQty?: number }[] }>({
      query: ({ id, items }) => ({ url: `/goods-returns/${id}/verify-receipt`, method: 'POST', body: { items } }),
      invalidatesTags: ['Order', 'Product'],
    }),
    cancelGoodsReturn: builder.mutation<any, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/goods-returns/${id}/cancel`, method: 'POST', body: { reason } }),
      invalidatesTags: ['Order', 'Product'],
    }),
    getClaimableBatches: builder.query<any, number>({
      query: (days) => `/goods-returns/expiry-claims/claimable?days=${days}`,
      providesTags: ['Product', 'Purchase'],
    }),
    getExpiryClaims: builder.query<any, void>({
      query: () => '/goods-returns/expiry-claims',
      providesTags: ['Order', 'Payment'],
    }),
    getExpiryWriteOffs: builder.query<any, { from: string; to: string }>({
      query: ({ from, to }) => `/goods-returns/expiry-claims/write-offs?from=${from}&to=${to}`,
      providesTags: ['Order', 'Payment'],
    }),
    createExpiryClaim: builder.mutation<any, {
      supplierName: string;
      claimDate: string;
      reason?: string;
      items: { batchId: string; quantity: number }[];
    }>({
      query: (body) => ({ url: '/goods-returns/expiry-claims', method: 'POST', body }),
      invalidatesTags: ['Order', 'Payment', 'Product', 'Purchase'],
    }),
  }),
});

export const {
  useListGoodsReturnsQuery,
  useGetGoodsReturnQuery,
  useCreateGoodsReturnMutation,
  useGetPendingRefundsQuery,
  useGetCustomerRefundsQuery,
  useGetSupplierClaimsQuery,
  useGetMyReturnHistoryQuery,
  useProcessRefundMutation,
  useGetDebitNoteQuery,
  useGetReturnedQtyByOrderQuery,
  useGetReturnsByOrderQuery,
  useGetPendingVerificationQuery,
  useGetWarehouseReturnHistoryQuery,
  useVerifyGoodsReturnMutation,
  useCancelGoodsReturnMutation,
  useGetClaimableBatchesQuery,
  useGetExpiryClaimsQuery,
  useGetExpiryWriteOffsQuery,
  useCreateExpiryClaimMutation,
} = goodsReturnApi;
