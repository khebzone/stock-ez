import { baseApi } from './baseApi';

export const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<any, { includeInactive?: boolean } | void>({
      query: (params) => {
        const includeInactive = typeof params === 'object' ? params?.includeInactive : false;
        return `/users?includeInactive=${includeInactive}`;
      },
      providesTags: ['User'],
    }),
    getUser: builder.query<any, string>({
      query: (id) => `/users/${id}`,
      providesTags: ['User'],
    }),
    createUser: builder.mutation<any, any>({
      query: (body) => ({ url: '/users', method: 'POST', body }),
      invalidatesTags: ['User'],
    }),
    updateUser: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({ url: `/users/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['User'],
    }),
    deleteUser: builder.mutation<any, string>({
      query: (id) => ({ url: `/users/${id}`, method: 'DELETE' }),
      invalidatesTags: ['User'],
    }),
    reactivateUser: builder.mutation<any, string>({
      query: (id) => ({ url: `/users/${id}/reactivate`, method: 'POST' }),
      invalidatesTags: ['User'],
    }),
    changePassword: builder.mutation<any, { oldPassword: string; newPassword: string }>({
      query: (body) => ({ url: '/users/change-password', method: 'POST', body }),
    }),
    getUserQuota: builder.query<any, void>({
      query: () => '/users/quota',
      providesTags: ['User'],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useReactivateUserMutation,
  useChangePasswordMutation,
  useGetUserQuotaQuery,
} = userApi;
