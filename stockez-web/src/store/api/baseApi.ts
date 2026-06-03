import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${import.meta.env.VITE_API_URL || ''}/api/v1`,
  prepareHeaders: (headers) => {
    const token    = localStorage.getItem('token');
    const tenantId = localStorage.getItem('tenantId');
    const userId   = localStorage.getItem('userId');
    if (token)    headers.set('authorization', `Bearer ${token}`);
    if (tenantId) headers.set('X-Tenant-Id', tenantId);
    if (userId)   headers.set('X-User-Id', userId);
    return headers;
  },
});

const forceLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('tenantId');
  localStorage.removeItem('userId');
  localStorage.removeItem('user');
  window.location.href = '/login';
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
  refetchOnFocus: true,
  refetchOnReconnect: true,
  tagTypes: ['User', 'Role', 'Tenant', 'Product', 'Order', 'Customer', 'Route', 'Payment', 'ProductMaster', 'PaymentMethod', 'Purchase', 'Target', 'Vehicle', 'Supplier', 'CompanyProfile', 'WorkflowSettings', 'Expense', 'SupplierPayment', 'Attendance', 'AttendanceSettings', 'Incentive'],
  endpoints: () => ({}),
});
