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
    getMyTodayAllocation: builder.query<any, void>({
      query: () => '/route-allocations/my-today',
      providesTags: () => [{ type: 'Route', id: 'MY_ALLOCATION' }],
    }),
    getFieldActivity: builder.query<any, string>({
      query: (date) => `/route-allocations/monitor?date=${date}`,
      providesTags: () => [{ type: 'Route', id: 'MONITOR' }],
    }),
  }),
});

export const {
  useGetAllocationsForDateQuery,
  useGetAllocationQuery,
  useAllocateRouteMutation,
  useAllocateSalesMutation,
  useAllocateDeliveryMutation,
  useGetMyTodayAllocationQuery,
  useGetFieldActivityQuery,
} = routeAllocationApi;
