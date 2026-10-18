import { useEffect } from 'react';
import { useGetCompanyProfileQuery } from '../store/api/supplierApi';

let company: any = null;

export const getExportCompany = () => company;

export function useExportBranding() {
  const { data } = useGetCompanyProfileQuery();
  useEffect(() => {
    company = data?.data ?? null;
  }, [data]);
}

export function companyLines(c: any): { name: string; address: string; contact: string } {
  const name = c?.companyName || c?.name || c?.tradeName || 'StockEz';
  const address = [c?.address, c?.city, c?.state, c?.pinCode].filter(Boolean).join(', ');
  const contact = [
    c?.phone && `Ph: ${c.phone}`,
    c?.gstin && `GSTIN: ${c.gstin}`,
    c?.fssaiNumber && `FSSAI: ${c.fssaiNumber}`,
  ].filter(Boolean).join('   |   ');
  return { name, address, contact };
}
