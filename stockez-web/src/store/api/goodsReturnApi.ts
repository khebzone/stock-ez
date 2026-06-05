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
    processRefund: builder.mutation<any, { id: string; paymentMode: string; refundDate: string; notes?: string }>({
      query: ({ id, ...body }) => ({ url: `/goods-returns/${id}/process-refund`, method: 'POST', body }),
      invalidatesTags: ['Order', 'Payment', 'Product'],
    }),
  }),
});

export const {
  useListGoodsReturnsQuery,
  useGetGoodsReturnQuery,
  useCreateGoodsReturnMutation,
  useGetPendingRefundsQuery,
  useProcessRefundMutation,
} = goodsReturnApi;
