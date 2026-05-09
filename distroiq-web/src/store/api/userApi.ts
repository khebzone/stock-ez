import { baseApi } from './baseApi';

export const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<any, void>({
      query: () => '/users',
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
    changePassword: builder.mutation<any, { oldPassword: string; newPassword: string }>({
      query: (body) => ({ url: '/users/change-password', method: 'POST', body }),
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useChangePasswordMutation,
} = userApi;
