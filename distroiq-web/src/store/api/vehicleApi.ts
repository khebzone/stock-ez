import { baseApi } from './baseApi';

export const vehicleApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getVehicles: builder.query<any, void>({
      query: () => '/vehicles',
      providesTags: ['Vehicle'],
    }),
    getActiveVehicles: builder.query<any, void>({
      query: () => '/vehicles/active',
      providesTags: ['Vehicle'],
    }),
    getInsuranceAlerts: builder.query<any, number | void>({
      query: (days = 30) => `/vehicles/insurance-alerts?days=${days}`,
      providesTags: ['Vehicle'],
    }),
    createVehicle: builder.mutation<any, any>({
      query: (body) => ({ url: '/vehicles', method: 'POST', body }),
      invalidatesTags: ['Vehicle'],
    }),
    updateVehicle: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({ url: `/vehicles/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Vehicle'],
    }),
    deleteVehicle: builder.mutation<any, string>({
      query: (id) => ({ url: `/vehicles/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Vehicle'],
    }),
  }),
});

export const {
  useGetVehiclesQuery,
  useGetActiveVehiclesQuery,
  useGetInsuranceAlertsQuery,
  useCreateVehicleMutation,
  useUpdateVehicleMutation,
  useDeleteVehicleMutation,
} = vehicleApi;
