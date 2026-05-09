import { baseApi } from './baseApi';

export const paymentMethodApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPaymentMethods: builder.query<any, void>({
      query: () => '/payment-methods',
      providesTags: ['PaymentMethod'],
    }),
    createPaymentMethod: builder.mutation<any, { name: string; mode: string; sortOrder?: number }>({
      query: (body) => ({ url: '/payment-methods', method: 'POST', body }),
      invalidatesTags: ['PaymentMethod'],
    }),
    deletePaymentMethod: builder.mutation<any, string>({
      query: (id) => ({ url: `/payment-methods/${id}`, method: 'DELETE' }),
      invalidatesTags: ['PaymentMethod'],
    }),
  }),
});

export const {
  useGetPaymentMethodsQuery,
  useCreatePaymentMethodMutation,
  useDeletePaymentMethodMutation,
} = paymentMethodApi;
