import { baseApi } from './baseApi';

export const salesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyAllocation: builder.query<any, void>({
      query: () => '/sales/my-allocation',
      providesTags: ['Route'],
    }),
    getMyCustomers: builder.query<any, void>({
      query: () => '/sales/my-customers',
      providesTags: ['Customer'],
    }),
  }),
});

export const { useGetMyAllocationQuery, useGetMyCustomersQuery } = salesApi;
