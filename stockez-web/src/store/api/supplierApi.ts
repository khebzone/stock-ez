import { baseApi } from './baseApi';

export const supplierApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSuppliers: builder.query<any, { search?: string }>({
      query: ({ search } = {}) => search?.trim()
        ? `/suppliers?search=${encodeURIComponent(search.trim())}&size=100`
        : `/suppliers?size=100`,
      providesTags: ['Supplier'],
    }),
    getSupplier: builder.query<any, string>({
      query: (id) => `/suppliers/${id}`,
      providesTags: ['Supplier'],
    }),
    createSupplier: builder.mutation<any, any>({
      query: (body) => ({ url: '/suppliers', method: 'POST', body }),
      invalidatesTags: ['Supplier'],
    }),
    updateSupplier: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({ url: `/suppliers/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Supplier'],
    }),
    deleteSupplier: builder.mutation<any, string>({
      query: (id) => ({ url: `/suppliers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Supplier'],
    }),
    importSuppliers: builder.mutation<any, FormData>({
      query: (formData) => ({ url: '/suppliers/import', method: 'POST', body: formData }),
      invalidatesTags: ['Supplier'],
    }),
    getCompanyProfile: builder.query<any, void>({
      query: () => '/tenants/profile',
      providesTags: ['CompanyProfile'],
    }),
    updateCompanyProfile: builder.mutation<any, any>({
      query: (body) => ({ url: '/tenants/profile', method: 'PUT', body }),
      invalidatesTags: ['CompanyProfile'],
    }),
  }),
});

export const {
  useGetSuppliersQuery,
  useGetSupplierQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation,
  useImportSuppliersMutation,
  useGetCompanyProfileQuery,
  useUpdateCompanyProfileMutation,
} = supplierApi;
