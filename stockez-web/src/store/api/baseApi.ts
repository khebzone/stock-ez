import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { getGeoFix } from '../../utils/geoPosition';
import { CLIENT_ID } from '../../utils/clientId';

export const API_TAG_TYPES = ['User', 'Role', 'Tenant', 'Product', 'Order', 'Customer', 'Route', 'Payment', 'ProductMaster', 'PaymentMethod', 'Purchase', 'PurchaseEntry', 'Target', 'Vehicle', 'Supplier', 'CompanyProfile', 'WorkflowSettings', 'Expense', 'SupplierPayment', 'Attendance', 'AttendanceSettings', 'Incentive', 'StockAdjustment', 'Notification', 'Tracking', 'TrackingSettings'] as const;

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${import.meta.env.VITE_API_URL || ''}/api/v1`,
  prepareHeaders: (headers) => {
    const token    = localStorage.getItem('token');
    const tenantId = localStorage.getItem('tenantId');
    const userId   = localStorage.getItem('userId');
    if (token)    headers.set('authorization', `Bearer ${token}`);
    if (tenantId) headers.set('X-Tenant-Id', tenantId);
    if (userId)   headers.set('X-User-Id', userId);
    headers.set('X-Client-Id', CLIENT_ID);

    // Carried on every request so billing, collection and delivery endpoints record where the
    // staff member was without each one needing a coordinate field in its payload.
    const fix = getGeoFix();
    if (fix) {
      headers.set('X-Geo-Lat', String(fix.latitude));
      headers.set('X-Geo-Lng', String(fix.longitude));
      if (fix.accuracyM != null) headers.set('X-Geo-Acc', String(fix.accuracyM));
    }
    return headers;
  },
});

const forceLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('tenantId');
  localStorage.removeItem('userId');
  localStorage.removeItem('user');
  const tenant = new URLSearchParams(window.location.search).get('tenant')?.split('/')[0].trim();
  window.location.href = tenant ? `/login?tenant=${tenant}` : '/login';
};

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args, api, extraOptions,
) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      const refreshResult = await rawBaseQuery(
        { url: '/auth/refresh', method: 'POST', body: { refreshToken } },
        api,
        extraOptions,
      );
      const refreshData = refreshResult.data as any;
      if (refreshData?.data?.accessToken) {
        localStorage.setItem('token', refreshData.data.accessToken);
        if (refreshData.data.refreshToken) {
          localStorage.setItem('refreshToken', refreshData.data.refreshToken);
        }
        // /auth/refresh recomputes permissions fresh from the DB on every call — persist them
        // so a role's permission changes take effect on the next token refresh instead of
        // requiring the user to log out and back in.
        if (refreshData.data.user) {
          localStorage.setItem('user', JSON.stringify(refreshData.data.user));
        }
        // Retry the original request with the new token
        result = await rawBaseQuery(args, api, extraOptions);
      } else {
        forceLogout();
      }
    } else {
      forceLogout();
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'baseApi',
  baseQuery: baseQueryWithReauth,
  refetchOnFocus: false,
  refetchOnReconnect: false,
  tagTypes: [...API_TAG_TYPES],
  endpoints: () => ({}),
});
