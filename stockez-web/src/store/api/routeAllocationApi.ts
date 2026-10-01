import { baseApi } from './baseApi';

export const routeAllocationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllocationsForDate: builder.query<any, string>({
      query: (date) => `/route-allocations/date/${date}`,
      providesTags: () => [{ type: 'Route', id: 'ALLOCATIONS' }],
    }),
    getAllocation: builder.query<any, { routeId: string; date: string }>({
      query: ({ routeId, date }) => `/route-allocations/route/${routeId}/date/${date}`,
      providesTags: () => [{ type: 'Route', id: 'ALLOCATIONS' }],
    }),
    allocateRoute: builder.mutation<any, any>({
      query: (body) => ({ url: '/route-allocations', method: 'POST', body }),
      invalidatesTags: () => [{ type: 'Route', id: 'ALLOCATIONS' }],
    }),
    allocateSales: builder.mutation<any, any>({
      query: (body) => ({ url: '/route-allocations/sales', method: 'POST', body }),
      invalidatesTags: () => [{ type: 'Route', id: 'ALLOCATIONS' }],
    }),
    allocateDelivery: builder.mutation<any, any>({
      query: (body) => ({ url: '/route-allocations/delivery', method: 'POST', body }),
      invalidatesTags: () => [{ type: 'Route', id: 'ALLOCATIONS' }],
    }),
    allocateWarehouse: builder.mutation<any, any>({
      query: (body) => ({ url: '/route-allocations/warehouse', method: 'POST', body }),
      invalidatesTags: () => [{ type: 'Route', id: 'ALLOCATIONS' }],
    }),
    getMyTodayAllocation: builder.query<any, void>({
      query: () => '/route-allocations/my-today',
      providesTags: () => [{ type: 'Route', id: 'MY_ALLOCATION' }],
    }),
    getGatePassOptions: builder.query<any, void>({
      query: () => '/route-allocations/gate-pass-options',
      providesTags: () => [{ type: 'Route', id: 'GATE_PASS_OPTIONS' }],
    }),
    getFieldActivity: builder.query<any, string>({
      query: (date) => `/route-allocations/monitor?date=${date}`,
      providesTags: () => [{ type: 'Route', id: 'MONITOR' }],
    }),
    getDeliveryRouteSummary: builder.query<any, string>({
      query: (date) => `/route-allocations/delivery-summary?date=${date}`,
      providesTags: () => [{ type: 'Route', id: 'ALLOCATIONS' }],
    }),
    getWarehouseSummary: builder.query<any, string>({
      query: (date) => `/route-allocations/warehouse-summary?date=${date}`,
      providesTags: () => [{ type: 'Route', id: 'ALLOCATIONS' }],
    }),
    dispatchPackedOrders: builder.mutation<any, string>({
      query: (allocationId) => ({ url: `/route-allocations/${allocationId}/dispatch`, method: 'POST' }),
      invalidatesTags: () => [{ type: 'Route', id: 'ALLOCATIONS' }, { type: 'Route', id: 'MONITOR' }],
    }),
    markSalesComplete: builder.mutation<any, string>({
      query: (allocationId) => ({ url: `/route-allocations/${allocationId}/complete-sales`, method: 'POST' }),
      invalidatesTags: () => [{ type: 'Route', id: 'ALLOCATIONS' }, { type: 'Route', id: 'MONITOR' }, { type: 'Route', id: 'MY_ALLOCATION' }],
    }),
    markDeliveryComplete: builder.mutation<any, string | { allocationId: string; force?: boolean }>({
      query: (arg) => {
        const allocationId = typeof arg === 'string' ? arg : arg.allocationId;
        const force = typeof arg === 'string' ? false : !!arg.force;
        return { url: `/route-allocations/${allocationId}/complete-delivery${force ? '?force=true' : ''}`, method: 'POST' };
      },
      invalidatesTags: () => [{ type: 'Route', id: 'ALLOCATIONS' }, { type: 'Route', id: 'MONITOR' }, { type: 'Route', id: 'MY_ALLOCATION' }],
    }),
    markWarehouseComplete: builder.mutation<any, string>({
      query: (allocationId) => ({ url: `/route-allocations/${allocationId}/complete-warehouse`, method: 'POST' }),
      invalidatesTags: () => [{ type: 'Route', id: 'ALLOCATIONS' }, { type: 'Route', id: 'MONITOR' }, { type: 'Route', id: 'MY_ALLOCATION' }],
    }),
  }),
});

export const {
  useGetAllocationsForDateQuery,
  useGetAllocationQuery,
  useAllocateRouteMutation,
  useAllocateSalesMutation,
  useAllocateDeliveryMutation,
  useAllocateWarehouseMutation,
  useGetMyTodayAllocationQuery,
  useGetGatePassOptionsQuery,
  useGetFieldActivityQuery,
  useGetDeliveryRouteSummaryQuery,
  useGetWarehouseSummaryQuery,
  useDispatchPackedOrdersMutation,
  useMarkSalesCompleteMutation,
  useMarkDeliveryCompleteMutation,
  useMarkWarehouseCompleteMutation,
} = routeAllocationApi;
