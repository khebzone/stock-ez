import { baseApi } from './baseApi';

export const auditApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAuditHistory: builder.query<any, { entityType: string; entityId: string }>({
      query: ({ entityType, entityId }) => `/audit/${entityType}/${entityId}`,
    }),
  }),
});

export const { useGetAuditHistoryQuery } = auditApi;
