import { baseApi } from './baseApi';

export const auditApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAuditHistory: builder.query<any, { entityType: string; entityId: string }>({
      query: ({ entityType, entityId }) => `/audit/${entityType}/${entityId}`,
    }),
    getAuditReport: builder.query<any, {
      from?: string; to?: string; entityType?: string;
      performedBy?: string; action?: string; page?: number; size?: number;
    }>({
      query: ({ from, to, entityType, performedBy, action, page = 0, size = 50 } = {}) => {
        const params = new URLSearchParams({ page: String(page), size: String(size) });
        if (from)          params.append('from', from);
        if (to)            params.append('to', to);
        if (entityType)    params.append('entityType', entityType);
        if (performedBy)   params.append('performedBy', performedBy);
        if (action)        params.append('action', action);
        return `/audit/report?${params}`;
      },
    }),
  }),
});

export const { useGetAuditHistoryQuery, useGetAuditReportQuery } = auditApi;
