import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

/**
 * Ant Design DatePicker `disabledDate` for filters/history/reports — blocks any date
 * after today. Do NOT use on entry fields that legitimately accept future dates
 * (post-dated cheques, expiry dates, insurance/trial expiry).
 */
export const noFutureDates = (current: Dayjs) => !!current && current.isAfter(dayjs(), 'day');
