import { baseApi } from './baseApi';

export const paymentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    collectPayment: builder.mutation<any, any>({
      query: (body) => ({ url: '/payments', method: 'POST', body }),
      invalidatesTags: ['Payment', 'Order'],
    }),
    getDailySummary: builder.query<any, { date?: string; personId?: string }>({
      query: ({ date, personId } = {}) => {
        const params = new URLSearchParams();
        if (date) params.append('date', date);
        if (personId) params.append('personId', personId);
        return `/payments/daily?${params}`;
      },
      providesTags: ['Payment'],
    }),
    getUnclearedPayments: builder.query<any, string>({
      query: (personId) => `/payments/uncleared/${personId}`,
      providesTags: ['Payment'],
    }),
    clearPayments: builder.mutation<any, { paymentIds: string[] }>({
      query: (body) => ({ url: '/payments/clear', method: 'POST', body }),
      invalidatesTags: ['Payment'],
    }),
    getOrderPayments: builder.query<any, string>({
      query: (orderId) => `/payments/order/${orderId}`,
      providesTags: ['Payment'],
    }),
    getMyDayCollections: builder.query<any, void>({
      query: () => '/payments/my-day',
      providesTags: ['Payment'],
    }),
    submitDayCollections: builder.mutation<any, void>({
      query: () => ({ url: '/payments/submit-day', method: 'POST' }),
      invalidatesTags: ['Payment'],
    }),
    getPendingVerifications: builder.query<any, void>({
      query: () => '/payments/pending-verification',
      providesTags: ['Payment'],
    }),
    getCustomerOutstanding: builder.query<any, void>({
      query: () => '/payments/customer-outstanding',
      providesTags: ['Payment', 'Order'],
    }),
    getCustomerOrders: builder.query<any, string>({
      query: (customerId) => `/payments/customer/${customerId}/orders`,
      providesTags: ['Payment', 'Order'],
    }),
    getCustomerPaymentHistory: builder.query<any, string>({
      query: (customerId) => `/payments/customer/${customerId}/history`,
      providesTags: ['Payment'],
    }),
  }),
});

export const {
  useCollectPaymentMutation,
  useGetDailySummaryQuery,
  useGetUnclearedPaymentsQuery,
  useClearPaymentsMutation,
  useGetOrderPaymentsQuery,
  useGetMyDayCollectionsQuery,
  useSubmitDayCollectionsMutation,
  useGetPendingVerificationsQuery,
  useGetCustomerOutstandingQuery,
  useGetCustomerOrdersQuery,
  useGetCustomerPaymentHistoryQuery,
} = paymentApi;
