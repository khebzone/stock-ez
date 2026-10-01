import { baseApi } from './baseApi';

export const supplierApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSuppliers: builder.query<any, void>({
      query: () => `/suppliers/all`,
      providesTags: ['Supplier'],
    }),
    getSuppliersPaged: builder.query<any, { page: number; size: number; search?: string }>({
      query: ({ page, size, search = '' }) => `/suppliers?page=${page}&size=${size}&search=${encodeURIComponent(search)}`,
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
    uploadCompanyLogo: builder.mutation<any, FormData>({
      query: (formData) => ({ url: '/upload/image', method: 'POST', body: formData }),
    }),
    getWorkflowSettings: builder.query<any, void>({
      query: () => '/tenants/settings',
      providesTags: ['WorkflowSettings'],
    }),
    updateWorkflowSettings: builder.mutation<any, any>({
      query: (body) => ({ url: '/tenants/settings', method: 'PUT', body }),
      invalidatesTags: ['WorkflowSettings'],
    }),
  }),
});

export const {
  useGetSuppliersQuery,
  useGetSuppliersPagedQuery,
  useGetSupplierQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation,
  useImportSuppliersMutation,
  useGetCompanyProfileQuery,
  useUpdateCompanyProfileMutation,
  useUploadCompanyLogoMutation,
  useGetWorkflowSettingsQuery,
  useUpdateWorkflowSettingsMutation,
} = supplierApi;
