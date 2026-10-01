import { baseApi } from './baseApi';

export const customerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCustomers: builder.query<any, void>({
      query: () => `/customers/all`,
      providesTags: ['Customer'],
    }),
    getCustomersPaged: builder.query<any, { page: number; size: number; search?: string; routeId?: string; placeId?: string }>({
      query: ({ page, size, search = '', routeId, placeId }) => {
        const params = new URLSearchParams({ page: String(page), size: String(size), search });
        if (routeId) params.set('routeId', routeId);
        if (placeId) params.set('placeId', placeId);
        return `/customers?${params}`;
      },
      providesTags: ['Customer'],
    }),
    getCustomer: builder.query<any, string>({
      query: (id) => `/customers/${id}`,
      providesTags: ['Customer'],
    }),
    createCustomer: builder.mutation<any, any>({
      query: (body) => ({ url: '/customers', method: 'POST', body }),
      invalidatesTags: ['Customer'],
    }),
    updateCustomer: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({ url: `/customers/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Customer'],
    }),
    deleteCustomer: builder.mutation<any, string>({
      query: (id) => ({ url: `/customers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Customer'],
    }),
    reorderCustomers: builder.mutation<any, { placeId: string; customerIds: string[] }>({
      query: ({ placeId, customerIds }) => ({ url: `/customers/by-place/${placeId}/reorder`, method: 'PUT', body: { customerIds } }),
      invalidatesTags: ['Customer'],
    }),
    getCustomerOutstanding: builder.query<any, string>({
      query: (id) => `/customers/${id}/outstanding`,
      providesTags: ['Customer'],
    }),
  }),
});

export const {
  useGetCustomersQuery,
  useGetCustomersPagedQuery,
  useGetCustomerQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
  useReorderCustomersMutation,
  useGetCustomerOutstandingQuery,
} = customerApi;
