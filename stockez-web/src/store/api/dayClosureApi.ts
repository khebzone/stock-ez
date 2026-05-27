import { baseApi } from './baseApi';

export const dayClosureApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTodayCounter: builder.query<any, void>({
      query: () => '/day-closure/today',
      providesTags: ['Payment'],
    }),
    closeDay: builder.mutation<any, { physicalCashEntered: number; notes?: string }>({
      query: (body) => ({ url: '/day-closure/close', method: 'POST', body }),
      invalidatesTags: ['Payment'],
    }),
    getDayClosureHistory: builder.query<any, void>({
      query: () => '/day-closure/history',
      providesTags: ['Payment'],
    }),
  }),
});

export const {
  useGetTodayCounterQuery,
  useCloseDayMutation,
  useGetDayClosureHistoryQuery,
} = dayClosureApi;
