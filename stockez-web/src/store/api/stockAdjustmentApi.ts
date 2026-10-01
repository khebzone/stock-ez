import { baseApi } from './baseApi';

export const stockAdjustmentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBatchesForAdjustment: builder.query<any, string>({
      query: (productId) => `/stock-adjustments/batches?productId=${productId}`,
      providesTags: ['StockAdjustment', 'Product'],
    }),
    adjustStock: builder.mutation<any, { batchId: string; type: string; quantity: number; reason?: string }>({
      query: (body) => ({ url: '/stock-adjustments', method: 'POST', body }),
      invalidatesTags: ['StockAdjustment', 'Product', 'Purchase'],
    }),
    getAllAdjustments: builder.query<any, void>({
      query: () => '/stock-adjustments/all',
      providesTags: ['StockAdjustment'],
    }),
    listAdjustments: builder.query<any, { page?: number; size?: number }>({
      query: ({ page = 0, size = 20 } = {}) => `/stock-adjustments?page=${page}&size=${size}`,
      providesTags: ['StockAdjustment'],
    }),
  }),
});

export const {
  useGetBatchesForAdjustmentQuery,
  useLazyGetBatchesForAdjustmentQuery,
  useAdjustStockMutation,
  useGetAllAdjustmentsQuery,
  useListAdjustmentsQuery,
} = stockAdjustmentApi;
