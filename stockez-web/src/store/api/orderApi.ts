import { baseApi } from './baseApi';

export const orderApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getAllOrders: builder.query<any, { status?: string; deliveredByMe?: boolean } | void>({
      query: (params) => {
        const q = new URLSearchParams();
        if (params?.status) q.append('status', params.status);
        if (params?.deliveredByMe) q.append('deliveredByMe', 'true');
        const qs = q.toString();
        return qs ? `/orders/all?${qs}` : '/orders/all';
      },
      providesTags: ['Order'],
    }),
    getOrders: builder.query<any, { status?: string; page?: number; size?: number; from?: string; to?: string; salesPersonId?: string; routeId?: string; search?: string }>({
      query: ({ status, page = 0, size = 20, from, to, salesPersonId, routeId, search } = {}) => {
        const params = new URLSearchParams({ page: String(page), size: String(size) });
        if (status) params.append('status', status);
        if (from) params.append('from', from);
        if (to) params.append('to', to);
        if (salesPersonId) params.append('salesPersonId', salesPersonId);
        if (routeId) params.append('routeId', routeId);
        if (search && search.trim()) params.append('search', search.trim());
        return `/orders?${params}`;
      },
      providesTags: ['Order'],
    }),
    getMyOrders: builder.query<any, void>({
      query: () => '/orders/my-orders',
      providesTags: ['Order'],
    }),
    getOrderSalespersons: builder.query<any, void>({
      query: () => '/orders/salespersons',
      providesTags: ['Order'],
    }),
    getMyDeliveries: builder.query<any, void>({
      query: () => '/orders/my-deliveries',
      providesTags: ['Order'],
    }),
    getMyDeliveryHistory: builder.query<any, string>({
      query: (date) => `/orders/my-delivery-history?date=${date}`,
      providesTags: ['Order', 'Payment'],
    }),
    getOrder: builder.query<any, string>({
      query: (id) => `/orders/${id}`,
      providesTags: ['Order'],
    }),
    getDeliveryRunInvoices: builder.query<any, string>({
      query: (allocationId) => `/orders/delivery-run/${allocationId}/invoices`,
      providesTags: ['Order'],
    }),
    createOrder: builder.mutation<any, any>({
      query: (body) => ({ url: '/orders', method: 'POST', body }),
      invalidatesTags: ['Order', 'Product'],
    }),
    updateOrder: builder.mutation<any, { id: string; items: any[]; notes?: string; overallDiscountType?: string | null; overallDiscountValue?: number | null }>({
      query: ({ id, items, notes, overallDiscountType, overallDiscountValue }) => ({ url: `/orders/${id}`, method: 'PUT', body: { items, notes, overallDiscountType, overallDiscountValue } }),
      invalidatesTags: ['Order', 'Product'],
    }),
    changeOrderStatus: builder.mutation<any, { id: string; status: string; notes?: string }>({
      query: ({ id, status, notes }) => ({ url: `/orders/${id}/status`, method: 'POST', body: { status, notes } }),
      invalidatesTags: ['Order', 'Product'],
    }),
    approveOrder: builder.mutation<any, string>({
      query: (id) => ({ url: `/orders/${id}/approve`, method: 'POST' }),
      invalidatesTags: ['Order', 'Product'],
    }),
    approveOrdersBatch: builder.mutation<any, string[]>({
      query: (orderIds) => ({ url: '/orders/approve-batch', method: 'POST', body: { orderIds } }),
      invalidatesTags: ['Order', 'Product'],
    }),
    cancelOrder: builder.mutation<any, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({ url: `/orders/${id}/cancel`, method: 'POST', body: { reason } }),
      invalidatesTags: ['Order', 'Product'],
    }),
    deleteOpeningBalance: builder.mutation<any, string>({
      query: (id) => ({ url: `/orders/${id}/opening-balance`, method: 'DELETE' }),
      invalidatesTags: ['Order', 'Payment'],
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
    returnToWarehouse: builder.mutation<any, string>({
      query: (id) => ({ url: `/orders/${id}/return-to-warehouse`, method: 'POST' }),
      invalidatesTags: ['Order'],
    }),
    markShopClosed: builder.mutation<any, string>({
      query: (id) => ({ url: `/orders/${id}/shop-closed`, method: 'POST' }),
      invalidatesTags: ['Order'],
    }),
    confirmWarehouseReturn: builder.mutation<any, { id: string; items: { itemId: string; receivedQty: number }[] }>({
      query: ({ id, items }) => ({ url: `/orders/${id}/confirm-warehouse-return`, method: 'POST', body: { items } }),
      invalidatesTags: ['Order'],
    }),
    adjustDeliveredPrice: builder.mutation<any, { id: string; items: { itemId: string; unitPrice: number; discountPercent?: number; discountAmount?: number }[]; overallDiscountType?: string | null; overallDiscountValue?: number | null }>({
      query: ({ id, items, overallDiscountType, overallDiscountValue }) => ({ url: `/orders/${id}/adjust-delivered-price`, method: 'POST', body: { items, overallDiscountType, overallDiscountValue } }),
      invalidatesTags: ['Order'],
    }),
    verifyItems: builder.mutation<any, { id: string; items: { itemId: string; verifiedQuantity: number }[] }>({
      query: ({ id, items }) => ({ url: `/orders/${id}/verify-items`, method: 'POST', body: { items } }),
      invalidatesTags: ['Order'],
    }),
    startPacking: builder.mutation<any, string>({
      query: (id) => ({ url: `/orders/${id}/start-packing`, method: 'POST' }),
      invalidatesTags: ['Order'],
    }),
    markPacked: builder.mutation<any, string>({
      query: (id) => ({ url: `/orders/${id}/mark-packed`, method: 'POST' }),
      invalidatesTags: ['Order'],
    }),
    getRoutePicklist: builder.query<any, string>({
      query: (date) => `/orders/route-picklist?date=${date}`,
      providesTags: ['Order'],
    }),
    getRoutePicklistHistory: builder.query<any, string>({
      query: (date) => `/orders/route-picklist-history?date=${date}`,
      providesTags: ['Order'],
    }),
    getMyWarehouseTasks: builder.query<any, string>({
      query: (date) => `/orders/my-warehouse-tasks?date=${date}`,
      providesTags: ['Order'],
    }),
    routeStartPacking: builder.mutation<any, { routeId: string; date: string }>({
      query: (body) => ({ url: '/orders/route-start-packing', method: 'POST', body }),
      invalidatesTags: ['Order'],
    }),
    routeMarkPacked: builder.mutation<any, { routeId: string; date: string }>({
      query: (body) => ({ url: '/orders/route-mark-packed', method: 'POST', body }),
      invalidatesTags: ['Order'],
    }),
    counterSale: builder.mutation<any, any>({
      query: (body) => ({ url: '/orders/counter-sale', method: 'POST', body }),
      invalidatesTags: ['Order', 'Product'],
    }),
    getCustomerLastPrices: builder.query<any, string>({
      query: (customerId) => `/orders/customer-last-prices?customerId=${customerId}`,
      providesTags: ['Order'],
    }),
    getWarehouseReturns: builder.query<any, void>({
      query: () => `/orders/warehouse-returns`,
      providesTags: ['Order'],
    }),
  }),
});

export const {
  useGetAllOrdersQuery,
  useGetOrdersQuery,
  useLazyGetOrdersQuery,
  useGetMyOrdersQuery,
  useGetMyDeliveriesQuery,
  useGetMyDeliveryHistoryQuery,
  useGetOrderSalespersonsQuery,
  useGetOrderQuery,
  useLazyGetDeliveryRunInvoicesQuery,
  useChangeOrderStatusMutation,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useApproveOrderMutation,
  useApproveOrdersBatchMutation,
  useCancelOrderMutation,
  useDeleteOpeningBalanceMutation,
  useAssignDeliveryMutation,
  useDispatchOrderMutation,
  useMarkDeliveredMutation,
  useReturnToWarehouseMutation,
  useMarkShopClosedMutation,
  useConfirmWarehouseReturnMutation,
  useAdjustDeliveredPriceMutation,
  useVerifyItemsMutation,
  useStartPackingMutation,
  useMarkPackedMutation,
  useGetRoutePicklistQuery,
  useGetRoutePicklistHistoryQuery,
  useGetMyWarehouseTasksQuery,
  useRouteStartPackingMutation,
  useRouteMarkPackedMutation,
  useCounterSaleMutation,
  useGetCustomerLastPricesQuery,
  useGetWarehouseReturnsQuery,
} = orderApi;
