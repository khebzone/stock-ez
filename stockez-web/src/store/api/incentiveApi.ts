import { baseApi } from './baseApi';

export const incentiveApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDistinctBrands: builder.query<any, void>({
      query: () => '/incentives/brands',
      providesTags: ['Incentive'],
    }),
    saveTarget: builder.mutation<any, any>({
      query: (body) => ({ url: '/incentives/targets', method: 'POST', body }),
      invalidatesTags: ['Incentive'],
    }),
    getTargetsSummary: builder.query<any, { month: number; year: number; salesPersonId?: string }>({
      query: ({ month, year, salesPersonId }) => {
        let url = `/incentives/targets?month=${month}&year=${year}`;
        if (salesPersonId) url += `&salesPersonId=${salesPersonId}`;
        return url;
      },
      providesTags: ['Incentive'],
    }),
    getAllSlabs: builder.query<any, void>({
      query: () => '/incentives/slabs',
      providesTags: ['Incentive'],
    }),
    getSlabsForBrand: builder.query<any, string>({
      query: (brand) => `/incentives/slabs/${encodeURIComponent(brand)}`,
      providesTags: ['Incentive'],
    }),
    saveSlabs: builder.mutation<any, any>({
      query: (body) => ({ url: '/incentives/slabs', method: 'POST', body }),
      invalidatesTags: ['Incentive'],
    }),
    calculateIncentives: builder.mutation<any, { targetMonth: number; targetYear: number }>({
      query: (body) => ({ url: '/incentives/calculate', method: 'POST', body }),
      invalidatesTags: ['Incentive'],
    }),
    getCredits: builder.query<any, { month: number; year: number }>({
      query: ({ month, year }) => `/incentives/credits?month=${month}&year=${year}`,
      providesTags: ['Incentive'],
    }),
    markCredited: builder.mutation<any, string>({
      query: (id) => ({ url: `/incentives/credits/${id}/mark-credited`, method: 'POST' }),
      invalidatesTags: ['Incentive'],
    }),
    getMyIncentives: builder.query<any, { month: number; year: number }>({
      query: ({ month, year }) => `/incentives/my?month=${month}&year=${year}`,
      providesTags: ['Incentive'],
    }),
  }),
});

export const {
  useGetDistinctBrandsQuery,
  useSaveTargetMutation,
  useGetTargetsSummaryQuery,
  useGetAllSlabsQuery,
  useGetSlabsForBrandQuery,
  useSaveSlabsMutation,
  useCalculateIncentivesMutation,
  useGetCreditsQuery,
  useMarkCreditedMutation,
  useGetMyIncentivesQuery,
} = incentiveApi;
