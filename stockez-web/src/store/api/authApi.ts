import { baseApi } from './baseApi';
import { getTenantSlug } from '../../utils/tenant';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => {
        const slug = getTenantSlug();
        return {
          url: '/auth/login',
          method: 'POST',
          body: credentials,
          headers: slug ? { 'X-Tenant-Slug': slug } : {},
        };
      },
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
