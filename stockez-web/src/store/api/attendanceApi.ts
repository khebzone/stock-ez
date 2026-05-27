import { baseApi } from './baseApi';

export const attendanceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAttendanceSettings: builder.query<any, void>({
      query: () => '/attendance/settings',
      providesTags: ['AttendanceSettings'],
    }),
    saveAttendanceSettings: builder.mutation<any, any>({
      query: (body) => ({ url: '/attendance/settings', method: 'POST', body }),
      invalidatesTags: ['AttendanceSettings'],
    }),
    getTodayStatus: builder.query<any, void>({
      query: () => '/attendance/today-status',
      providesTags: ['Attendance'],
    }),
    checkIn: builder.mutation<any, { latitude: number; longitude: number }>({
      query: (body) => ({ url: '/attendance/check-in', method: 'POST', body }),
      invalidatesTags: ['Attendance'],
    }),
    checkOut: builder.mutation<any, void>({
      query: () => ({ url: '/attendance/check-out', method: 'POST', body: {} }),
      invalidatesTags: ['Attendance'],
    }),
    getAttendanceByDate: builder.query<any, string>({
      query: (date) => `/attendance/by-date?date=${date}`,
      providesTags: ['Attendance'],
    }),
    getAttendanceByRange: builder.query<any, { from: string; to: string }>({
      query: ({ from, to }) => `/attendance/by-range?from=${from}&to=${to}`,
      providesTags: ['Attendance'],
    }),
    getAttendanceByUser: builder.query<any, { userId: string; from: string; to: string }>({
      query: ({ userId, from, to }) => `/attendance/by-user?userId=${userId}&from=${from}&to=${to}`,
      providesTags: ['Attendance'],
    }),
  }),
});

export const {
  useGetAttendanceSettingsQuery,
  useSaveAttendanceSettingsMutation,
  useGetTodayStatusQuery,
  useCheckInMutation,
  useCheckOutMutation,
  useGetAttendanceByDateQuery,
  useGetAttendanceByRangeQuery,
  useGetAttendanceByUserQuery,
} = attendanceApi;
