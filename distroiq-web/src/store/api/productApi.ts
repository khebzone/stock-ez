import { baseApi } from './baseApi';

export const productApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query<any, { page?: number; size?: number; search?: string; category?: string }>({
      query: ({ page = 0, size = 50, search, category } = {}) => {
        const params = new URLSearchParams({ page: String(page), size: String(size) });
        if (search) params.append('search', search);
        if (category) params.append('category', category);
        return `/products?${params}`;
      },
      providesTags: ['Product'],
    }),
    getProduct: builder.query<any, string>({
      query: (id) => `/products/${id}`,
      providesTags: ['Product'],
    }),
    getCategories: builder.query<any, void>({
      query: () => '/products/categories',
      providesTags: ['Product'],
    }),
    getBrands: builder.query<any, void>({
      query: () => '/products/brands',
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
  useGetProductsQuery,
  useGetProductQuery,
  useGetCategoriesQuery,
  useGetBrandsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
} = productApi;
