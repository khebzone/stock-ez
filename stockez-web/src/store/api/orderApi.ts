import { baseApi } from './baseApi';

export const orderApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getOrders: builder.query<any, { status?: string; page?: number; size?: number; from?: string; to?: string }>({
      query: ({ status, page = 0, size = 20, from, to } = {}) => {
        const params = new URLSearchParams({ page: String(page), size: String(size) });
        if (status) params.append('status', status);
        if (from) params.append('from', from);
        if (to) params.append('to', to);
        return `/orders?${params}`;
      },
      providesTags: ['Order'],
    }),
    getMyOrders: builder.query<any, void>({
      query: () => '/orders/my-orders',
      providesTags: ['Order'],
    }),
    getMyDeliveries: builder.query<any, void>({
      query: () => '/orders/my-deliveries',
      providesTags: ['Order'],
    }),
    getOrder: builder.query<any, string>({
      query: (id) => `/orders/${id}`,
      providesTags: ['Order'],
    }),
    createOrder: builder.mutation<any, any>({
      query: (body) => ({ url: '/orders', method: 'POST', body }),
      invalidatesTags: ['Order'],
    }),
    updateOrder: builder.mutation<any, { id: string; items: any[]; notes?: string }>({
      query: ({ id, items, notes }) => ({ url: `/orders/${id}`, method: 'PUT', body: { items, notes } }),
      invalidatesTags: ['Order'],
    }),
    approveOrder: builder.mutation<any, string>({
      query: (id) => ({ url: `/orders/${id}/approve`, method: 'POST' }),
      invalidatesTags: ['Order'],
    }),
    cancelOrder: builder.mutation<any, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({ url: `/orders/${id}/cancel`, method: 'POST', body: { reason } }),
      invalidatesTags: ['Order'],
    }),
    assignDelivery: builder.mutation<any, { id: string; deliveryPersonId: string }>({
      query: ({ id, deliveryPersonId }) => ({ url: `/orders/${id}/assign-delivery`, method: 'POST', body: { deliveryPersonId } }),
      invalidatesTags: ['Order'],
    }),
    dispatchOrder: builder.mutation<any, string>({
      query: (id) => ({ url: `/orders/${id}/dispatch`, method: 'POST' }),
      invalidatesTags: ['Order'],
    }),
    markDelivered: builder.mutation<any, string>({
      query: (id) => ({ url: `/orders/${id}/deliver`, method: 'POST' }),
      invalidatesTags: ['Order'],
    }),
    verifyItems: builder.mutation<any, { id: string; items: { itemId: string; verifiedQuantity: number }[] }>({
      query: ({ id, items }) => ({ url: `/orders/${id}/verify-items`, method: 'POST', body: { items } }),
      invalidatesTags: ['Order'],
    }),
    startPreparing: builder.mutation<any, string>({
      query: (id) => ({ url: `/orders/${id}/start-preparing`, method: 'POST' }),
      invalidatesTags: ['Order'],
    }),
    markPrepared: builder.mutation<any, string>({
      query: (id) => ({ url: `/orders/${id}/mark-prepared`, method: 'POST' }),
      invalidatesTags: ['Order'],
    }),
    getRoutePicklist: builder.query<any, string>({
      query: (date) => `/orders/route-picklist?date=${date}`,
      providesTags: ['Order'],
    }),
    routeStartPreparing: builder.mutation<any, { routeId: string; date: string }>({
      query: (body) => ({ url: '/orders/route-start-preparing', method: 'POST', body }),
      invalidatesTags: ['Order'],
    }),
    routeMarkPrepared: builder.mutation<any, { routeId: string; date: string }>({
      query: (body) => ({ url: '/orders/route-mark-prepared', method: 'POST', body }),
      invalidatesTags: ['Order'],
    }),
  }),
});

export const {
  useGetOrdersQuery,
  useGetMyOrdersQuery,
  useGetMyDeliveriesQuery,
  useGetOrderQuery,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useApproveOrderMutation,
  useCancelOrderMutation,
  useAssignDeliveryMutation,
  useDispatchOrderMutation,
  useMarkDeliveredMutation,
  useVerifyItemsMutation,
  useStartPreparingMutation,
  useMarkPreparedMutation,
  useGetRoutePicklistQuery,
  useRouteStartPreparingMutation,
  useRouteMarkPreparedMutation,
} = orderApi;
