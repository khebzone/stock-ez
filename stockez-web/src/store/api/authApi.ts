import { baseApi } from './baseApi';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      // Save tokens in the component on success
    }),
    refresh: builder.mutation({
      query: (body) => ({
        url: '/auth/refresh',
        method: 'POST',
        body,
      }),
    }),
    getMe: builder.query({
      query: () => '/auth/me',
    }),
  }),
});

export const { useLoginMutation, useRefreshMutation, useGetMeQuery } = authApi;
