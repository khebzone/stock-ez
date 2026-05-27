import { baseApi } from './baseApi';

export const expenseApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExpenseCategories: builder.query<any, void>({
      query: () => '/expenses/categories',
      providesTags: ['Expense'],
    }),
    createExpenseCategory: builder.mutation<any, { name: string }>({
      query: (body) => ({ url: '/expenses/categories', method: 'POST', body }),
      invalidatesTags: ['Expense'],
    }),
    deleteExpenseCategory: builder.mutation<any, string>({
      query: (id) => ({ url: `/expenses/categories/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Expense'],
    }),
    getExpenses: builder.query<any, { from?: string; to?: string; categoryId?: string }>({
      query: ({ from, to, categoryId } = {}) => {
        const params = new URLSearchParams();
        if (from) params.append('from', from);
        if (to) params.append('to', to);
        if (categoryId) params.append('categoryId', categoryId);
        return `/expenses?${params.toString()}`;
      },
      providesTags: ['Expense'],
    }),
    getExpenseSummary: builder.query<any, void>({
      query: () => '/expenses/summary',
      providesTags: ['Expense'],
    }),
    createExpense: builder.mutation<any, any>({
      query: (body) => ({ url: '/expenses', method: 'POST', body }),
      invalidatesTags: ['Expense'],
    }),
    updateExpense: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({ url: `/expenses/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Expense'],
    }),
    deleteExpense: builder.mutation<any, string>({
      query: (id) => ({ url: `/expenses/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Expense'],
    }),
  }),
});

export const {
  useGetExpenseCategoriesQuery,
  useCreateExpenseCategoryMutation,
  useDeleteExpenseCategoryMutation,
  useGetExpensesQuery,
  useGetExpenseSummaryQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
} = expenseApi;
