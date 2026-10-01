import { baseApi } from './baseApi';

export const salesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyAllocation: builder.query<any, void>({
      query: () => '/sales/my-allocation',
      providesTags: ['Route'],
    }),
    getMyDeliveryAllocation: builder.query<any, void>({
      query: () => '/sales/my-delivery-allocation',
      providesTags: ['Route'],
    }),
    getMyCustomers: builder.query<any, void>({
      query: () => '/sales/my-customers',
      providesTags: ['Customer'],
    }),
    getMyHistory: builder.query<any, string>({
      query: (date) => `/sales/my-history?date=${date}`,
      providesTags: ['Order', 'Payment'],
    }),
  }),
});

export const { useGetMyAllocationQuery, useGetMyDeliveryAllocationQuery, useGetMyCustomersQuery, useGetMyHistoryQuery } = salesApi;
