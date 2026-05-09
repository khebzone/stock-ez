import { baseApi } from './baseApi';

export const routeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRoutes: builder.query<any, void>({
      query: () => '/routes',
      providesTags: ['Route'],
    }),
    getRoute: builder.query<any, string>({
      query: (id) => `/routes/${id}`,
      providesTags: ['Route'],
    }),
    getMyRoute: builder.query<any, void>({
      query: () => '/routes/my-route',
      providesTags: ['Route'],
    }),
    getRoutePlan: builder.query<any, string>({
      query: (id) => `/routes/${id}/plan`,
      providesTags: ['Route'],
    }),
    createRoute: builder.mutation<any, any>({
      query: (body) => ({ url: '/routes', method: 'POST', body }),
      invalidatesTags: ['Route'],
    }),
    addPlace: builder.mutation<any, { routeId: string; data: any }>({
      query: ({ routeId, data }) => ({ url: `/routes/${routeId}/places`, method: 'POST', body: data }),
      invalidatesTags: ['Route'],
    }),
    reorderPlaces: builder.mutation<any, { routeId: string; placeIds: string[] }>({
      query: ({ routeId, placeIds }) => ({ url: `/routes/${routeId}/places/reorder`, method: 'PUT', body: { placeIds } }),
      invalidatesTags: ['Route'],
    }),
    assignSalesPerson: builder.mutation<any, { routeId: string; salesPersonId: string }>({
      query: ({ routeId, salesPersonId }) => ({ url: `/routes/${routeId}/assign`, method: 'POST', body: { salesPersonId } }),
      invalidatesTags: ['Route'],
    }),
    updateRoute: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({ url: `/routes/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Route'],
    }),
    updatePlace: builder.mutation<any, { routeId: string; placeId: string; data: any }>({
      query: ({ routeId, placeId, data }) => ({ url: `/routes/${routeId}/places/${placeId}`, method: 'PUT', body: data }),
      invalidatesTags: ['Route'],
    }),
    deleteRoute: builder.mutation<any, string>({
      query: (id) => ({ url: `/routes/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Route'],
    }),
  }),
});

export const {
  useGetRoutesQuery,
  useGetRouteQuery,
  useGetMyRouteQuery,
  useGetRoutePlanQuery,
  useCreateRouteMutation,
  useUpdateRouteMutation,
  useUpdatePlaceMutation,
  useAddPlaceMutation,
  useReorderPlacesMutation,
  useAssignSalesPersonMutation,
  useDeleteRouteMutation,
} = routeApi;
