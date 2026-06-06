import { baseApi } from './baseApi';

export const tenantApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTenants: builder.query<any, { page?: number; size?: number } | void>({
      query: (params) => {
        const page = (params as any)?.page ?? 0;
        const size = (params as any)?.size ?? 200;
        return `/tenants?page=${page}&size=${size}`;
      },
      providesTags: ['Tenant'],
    }),
    getTenantStats: builder.query<any, void>({
      query: () => '/tenants/stats',
      providesTags: ['Tenant'],
    }),
    createTenant: builder.mutation<any, any>({
      query: (body) => ({ url: '/tenants', method: 'POST', body }),
      invalidatesTags: ['Tenant'],
    }),
    updateTenant: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({ url: `/tenants/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Tenant'],
    }),
    suspendTenant: builder.mutation<any, string>({
      query: (id) => ({ url: `/tenants/${id}/suspend`, method: 'POST' }),
      invalidatesTags: ['Tenant'],
    }),
    activateTenant: builder.mutation<any, string>({
      query: (id) => ({ url: `/tenants/${id}/activate`, method: 'POST' }),
      invalidatesTags: ['Tenant'],
    }),
    setReadOnly: builder.mutation<any, string>({
      query: (id) => ({ url: `/tenants/${id}/set-read-only`, method: 'POST' }),
      invalidatesTags: ['Tenant'],
    }),
    extendTrial: builder.mutation<any, { id: string; days: number }>({
      query: ({ id, days }) => ({ url: `/tenants/${id}/extend-trial`, method: 'POST', body: { days } }),
      invalidatesTags: ['Tenant'],
    }),
  }),
});

export const {
  useGetTenantsQuery,
  useGetTenantStatsQuery,
  useCreateTenantMutation,
  useUpdateTenantMutation,
  useSuspendTenantMutation,
  useActivateTenantMutation,
  useSetReadOnlyMutation,
  useExtendTrialMutation,
} = tenantApi;
