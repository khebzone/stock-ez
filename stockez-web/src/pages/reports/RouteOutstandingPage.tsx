import React, { useState } from 'react';
import { DatePicker, Button, Table, Space } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetRouteOutstandingQuery } from '../../store/api/reportApi';
import PageHeader from '../../components/PageHeader';
import { exportToXLSX } from '../../components/TableToolbar';
import { noFutureDates } from '../../utils/date';

const fmt = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const RouteOutstandingPage: React.FC = () => {
  const [asOf, setAsOf] = useState<dayjs.Dayjs>(dayjs());
  const { data, isLoading } = useGetRouteOutstandingQuery({ asOfDate: asOf.format('YYYY-MM-DD') });
  const report = data?.data || {};
  const rows: any[] = report.rows || [];

  const doExport = () => {
    const exportRows = rows.map((r, i) => ({ sno: i + 1, routeName: r.routeName, customerCount: r.customerCount, outstanding: r.outstanding }));
    exportRows.push({ sno: '' as any, routeName: 'TOTAL', customerCount: report.customerCount, outstanding: report.totalOutstanding });
    exportToXLSX(exportRows, [
      { title: 'S.No', key: 'sno', dataIndex: 'sno', type: 'number' as const, align: 'right' as const },
      { title: 'Route', key: 'routeName', dataIndex: 'routeName' },
      { title: 'Customers', key: 'customerCount', dataIndex: 'customerCount', type: 'number' as const },
      { title: 'Outstanding', key: 'outstanding', dataIndex: 'outstanding', type: 'currency' as const },
    ], `route-outstanding-${asOf.format('YYYY-MM-DD')}`, 'Route Outstanding');
  };

  return (
    <div>
      <PageHeader title="Route Outstanding" subtitle="Current customer dues grouped by route" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <span style={{ fontSize: 12, color: '#64748b' }}>As of</span>
          <DatePicker value={asOf} onChange={(v) => v && setAsOf(v)} format="DD MMM YYYY" disabledDate={noFutureDates} allowClear={false} />
        </Space>
        <Button icon={<FileExcelOutlined />} size="small" onClick={doExport} disabled={!rows.length}>Export Excel</Button>
      </div>
      <Table
        size="small" dataSource={rows} rowKey={(r: any) => r.routeId || 'none'} loading={isLoading} scroll={{ x: 520 }}
        pagination={false}
        locale={{ emptyText: <div style={{ padding: '24px 0', color: '#9ca3af' }}>No outstanding dues</div> }}
        columns={[
          { title: 'S.No', width: 60, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
          { title: 'Route', dataIndex: 'routeName', render: (v: string) => <span style={{ fontWeight: 600, color: '#0f172a' }}>{v}</span> },
          { title: 'Customers', dataIndex: 'customerCount', width: 120, align: 'right' as const, sorter: (a: any, b: any) => a.customerCount - b.customerCount },
          { title: 'Outstanding', dataIndex: 'outstanding', width: 160, align: 'right' as const, sorter: (a: any, b: any) => a.outstanding - b.outstanding, render: (v: any) => <span style={{ color: '#dc2626', fontWeight: 700 }}>{fmt(v)}</span> },
        ]}
        summary={() => rows.length > 0 ? (
          <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 700 }}>
            <Table.Summary.Cell index={0} colSpan={2}>Total ({report.routeCount} routes · {report.customerCount} customers)</Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right" />
            <Table.Summary.Cell index={2} align="right"><strong style={{ color: '#dc2626' }}>{fmt(report.totalOutstanding)}</strong></Table.Summary.Cell>
          </Table.Summary.Row>
        ) : null}
      />
    </div>
  );
};

export default RouteOutstandingPage;
