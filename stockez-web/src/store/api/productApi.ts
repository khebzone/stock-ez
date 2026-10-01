import { baseApi } from './baseApi';

export const productApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllProducts: builder.query<any, void>({
      query: () => '/products/all',
      providesTags: ['Product'],
    }),
    getProducts: builder.query<any, { page?: number; size?: number; search?: string; categoryId?: string; brandId?: string }>({
      query: ({ page = 0, size = 20, search, categoryId, brandId } = {}) => {
        const params = new URLSearchParams({ page: String(page), size: String(size) });
        if (search) params.append('search', search);
        if (categoryId) params.append('categoryId', categoryId);
        if (brandId) params.append('brandId', brandId);
        return `/products?${params}`;
      },
      providesTags: ['Product'],
    }),
    getProduct: builder.query<any, string>({
      query: (id) => `/products/${id}`,
      providesTags: ['Product'],
    }),
    createProduct: builder.mutation<any, any>({
      query: (body) => ({ url: '/products', method: 'POST', body }),
      invalidatesTags: ['Product'],
    }),
    updateProduct: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({ url: `/products/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Product'],
    }),
    deleteProduct: builder.mutation<any, string>({
      query: (id) => ({ url: `/products/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Product'],
    }),
  }),
});

export const {
  useGetAllProductsQuery,
  useGetProductsQuery,
  useGetProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
} = productApi;
