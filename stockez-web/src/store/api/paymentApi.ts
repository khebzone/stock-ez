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
    getOutstandingSummary: builder.query<any, void>({
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
    getSalesmanOutstanding: builder.query<any, void>({
      query: () => '/payments/salesman-outstanding',
      providesTags: ['Payment', 'Order'],
    }),
    getRouteOutstanding: builder.query<any, void>({
      query: () => '/payments/route-outstanding',
      providesTags: ['Payment', 'Order'],
    }),
    getInstruments: builder.query<any, void>({
      query: () => '/payments/instruments',
      providesTags: ['Payment'],
    }),
    depositInstrument: builder.mutation<any, { id: string; depositDate?: string; depositBank?: string }>({
      query: ({ id, ...body }) => ({ url: `/payments/${id}/deposit`, method: 'POST', body }),
      invalidatesTags: ['Payment'],
    }),
    realiseInstrument: builder.mutation<any, { id: string; realisedDate?: string }>({
      query: ({ id, ...body }) => ({ url: `/payments/${id}/realise`, method: 'POST', body }),
      invalidatesTags: ['Payment', 'Order'],
    }),
    bounceInstrument: builder.mutation<any, { id: string; bounceReason: string; bankCharges?: number }>({
      query: ({ id, ...body }) => ({ url: `/payments/${id}/bounce`, method: 'POST', body }),
      invalidatesTags: ['Payment', 'Order'],
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
  useGetOutstandingSummaryQuery,
  useGetCustomerOrdersQuery,
  useGetCustomerPaymentHistoryQuery,
  useGetSalesmanOutstandingQuery,
  useGetRouteOutstandingQuery,
  useGetInstrumentsQuery,
  useDepositInstrumentMutation,
  useRealiseInstrumentMutation,
  useBounceInstrumentMutation,
} = paymentApi;
