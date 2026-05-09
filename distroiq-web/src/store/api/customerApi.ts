import { baseApi } from './baseApi';

export const customerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCustomers: builder.query<any, { routeId?: string; placeId?: string; search?: string }>({
      query: ({ routeId, placeId, search } = {}) => {
        if (search?.trim()) return `/customers/search?q=${encodeURIComponent(search.trim())}&size=100`;
        if (placeId) return `/customers/by-place/${placeId}?size=100`;
        if (routeId) return `/customers/by-route/${routeId}?size=100`;
        // No filter — return all via search with empty q
        return `/customers/search?q=&size=200`;
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
  useGetCustomerQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
  useReorderCustomersMutation,
  useGetCustomerOutstandingQuery,
} = customerApi;
