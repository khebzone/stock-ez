import { baseApi } from './baseApi';

export const productMasterApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMasters: builder.query<any, string>({
      query: (type) => `/product-masters?type=${type}`,
      providesTags: (_r, _e, type) => [{ type: 'ProductMaster', id: type }],
    }),
    createMaster: builder.mutation<any, { type: string; name: string; value?: string; parentName?: string }>({
      query: (body) => ({ url: '/product-masters', method: 'POST', body }),
      invalidatesTags: (_r, _e, arg) => [{ type: 'ProductMaster', id: arg.type }],
    }),
    deleteMaster: builder.mutation<any, { id: string; type: string }>({
      query: ({ id }) => ({ url: `/product-masters/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, arg) => [{ type: 'ProductMaster', id: arg.type }],
    }),
  }),
});

export const {
  useGetMastersQuery,
  useCreateMasterMutation,
  useDeleteMasterMutation,
} = productMasterApi;
