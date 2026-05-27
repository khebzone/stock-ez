import { baseApi } from './baseApi';

export const importApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    importProducts: builder.mutation<any, FormData>({
      query: (formData) => ({ url: '/import/products', method: 'POST', body: formData }),
      invalidatesTags: ['Product'],
    }),
    importCustomers: builder.mutation<any, FormData>({
      query: (formData) => ({ url: '/import/customers', method: 'POST', body: formData }),
      invalidatesTags: ['Customer'],
    }),
    importSuppliers: builder.mutation<any, FormData>({
      query: (formData) => ({ url: '/import/suppliers', method: 'POST', body: formData }),
      invalidatesTags: ['Supplier'],
    }),
  }),
});

export const {
  useImportProductsMutation,
  useImportCustomersMutation,
  useImportSuppliersMutation,
} = importApi;
