import { baseApi } from './baseApi';

export const notificationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getNotificationSummary: builder.query<any, void>({
      query: () => '/notifications/summary',
      providesTags: ['Notification'],
    }),
  }),
});

export const { useGetNotificationSummaryQuery } = notificationApi;
