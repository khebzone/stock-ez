import { baseApi } from './baseApi';

export type LocationStatus = 'VERIFIED' | 'FAR' | 'NO_SHOP_PIN' | 'GPS_UNAVAILABLE';
export type VisitOutcome =
  | 'ORDER_PLACED' | 'COUNTER_SALE' | 'PAYMENT_COLLECTED'
  | 'DELIVERED' | 'NO_ORDER' | 'SHOP_CLOSED';

export interface Visit {
  id: string;
  customerId: string;
  customerName: string;
  userId: string;
  userName: string;
  visitedAt: string;
  outcome: VisitOutcome;
  distanceFromShopM: number | null;
  locationStatus: LocationStatus;
  latitude: number | null;
  longitude: number | null;
  reason: string | null;
  orderNumber: string | null;
  orderAmount: number | null;
}

export interface TrailPoint {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  recordedAt: string;
  source: 'FOREGROUND' | 'ACTION' | 'BACKGROUND';
}

export interface LiveStaff {
  userId: string;
  fullName: string;
  dutyRole: string;
  routeName: string | null;
  checkedIn: boolean;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastSeenAt: string | null;
  minutesSinceLastSeen: number | null;
  stale: boolean;
  shopsVisited: number;
  shopsOnRoute: number;
  ordersPlaced: number;
  verifiedAtShop: number;
  flaggedFarFromShop: number;
}

export interface LiveBoard {
  trackingEnabled: boolean;
  stalenessMinutes: number;
  staff: LiveStaff[];
}

export interface StaffDay {
  userId: string;
  fullName: string;
  routeName: string | null;
  shopsOnRoute: number;
  shopsVisited: number;
  verifiedAtShop: number;
  flaggedFarFromShop: number;
  noLocation: number;
  trail: TrailPoint[];
  visits: Visit[];
}

export interface TrackingSettings {
  locationTrackingEnabled: boolean;
  locationPingIntervalSeconds: number;
  trackOnlyWhenCheckedIn: boolean;
  locationRetentionDays: number;
}

export const trackingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTrackingSettings: builder.query<{ data: TrackingSettings }, void>({
      query: () => '/tracking/settings',
      providesTags: ['TrackingSettings'],
    }),

    saveTrackingSettings: builder.mutation<{ data: TrackingSettings }, TrackingSettings>({
      query: (body) => ({ url: '/tracking/settings', method: 'POST', body }),
      invalidatesTags: ['TrackingSettings'],
    }),

    getLiveBoard: builder.query<{ data: LiveBoard }, string | undefined>({
      query: (date) => (date ? `/tracking/live?date=${date}` : '/tracking/live'),
      providesTags: ['Tracking'],
    }),

    getStaffDay: builder.query<{ data: StaffDay }, { userId: string; date?: string }>({
      query: ({ userId, date }) =>
        date ? `/tracking/staff/${userId}/day?date=${date}` : `/tracking/staff/${userId}/day`,
      providesTags: ['Tracking'],
    }),

    getCustomerVisits: builder.query<{ data: Visit[] }, string>({
      query: (customerId) => `/tracking/customers/${customerId}/visits`,
      providesTags: ['Tracking'],
    }),

    getMyVisitsToday: builder.query<{ data: string[] }, void>({
      query: () => '/tracking/visits/today',
      providesTags: ['Tracking'],
    }),

    logNoOrderVisit: builder.mutation<unknown, {
      customerId: string;
      routeAllocationId?: string;
      latitude?: number;
      longitude?: number;
      accuracyM?: number;
      reason?: string;
    }>({
      query: (body) => ({ url: '/tracking/visits/no-order', method: 'POST', body }),
      invalidatesTags: ['Tracking'],
    }),

    sendPing: builder.mutation<
      { data: { accepted: boolean; reason: string | null; nextPingSeconds: number } },
      { latitude: number; longitude: number; accuracyM?: number }
    >({
      query: (body) => ({ url: '/tracking/ping', method: 'POST', body }),
    }),
  }),
});

export const {
  useGetTrackingSettingsQuery,
  useSaveTrackingSettingsMutation,
  useGetLiveBoardQuery,
  useGetStaffDayQuery,
  useGetCustomerVisitsQuery,
  useGetMyVisitsTodayQuery,
  useLogNoOrderVisitMutation,
  useSendPingMutation,
} = trackingApi;
