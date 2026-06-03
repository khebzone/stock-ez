import { baseApi } from './baseApi';

export const roleApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRoles: builder.query<any, void>({
      query: () => '/roles',
      providesTags: ['Role'],
    }),
    getRoleSummaries: builder.query<any, void>({
      query: () => '/roles/summary',
      providesTags: ['Role'],
    }),
    createRole: builder.mutation<any, any>({
      query: (body) => ({ url: '/roles', method: 'POST', body }),
      invalidatesTags: ['Role'],
    }),
    updateRole: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({ url: `/roles/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Role'],
    }),
    deleteRole: builder.mutation<any, string>({
      query: (id) => ({ url: `/roles/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Role', 'User'],
    }),
  }),
});

export const {
  useGetRolesQuery,
  useGetRoleSummariesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
} = roleApi;
