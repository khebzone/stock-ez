import React from 'react';
import { Button, Space } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

interface Column { title: string; key: string; dataIndex?: string | string[] }

function getVal(row: any, dataIndex: string | string[] | undefined, key: string): string {
  const path = dataIndex
    ? (Array.isArray(dataIndex) ? dataIndex : dataIndex.split('.'))
    : [key];
  const val = path.reduce((o: any, k: string) => o?.[k], row);
  return String(val ?? '');
}

export function exportToCSV(data: any[], columns: Column[], filename: string) {
  const exportCols = columns.filter(c => c.title && c.title !== '');
  const headers = exportCols.map(c => `"${c.title}"`).join(',');
  const rows = data.map(row =>
    exportCols.map(c => `"${getVal(row, c.dataIndex, c.key).replace(/"/g, '""')}"`).join(',')
  );
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename + '.csv'; a.click();
  URL.revokeObjectURL(url);
}

interface TableToolbarProps {
  total: number;
  label?: string;
  data?: any[];
  columns?: Column[];
  exportFilename?: string;
  extra?: React.ReactNode;
}

const TableToolbar: React.FC<TableToolbarProps> = ({ total, label = 'records', data, columns, exportFilename, extra }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 16px', borderBottom: '1px solid #e8ecf0',
    background: '#fff',
  }}>
    <span style={{ fontSize: 13, color: '#6b7280' }}>
      <span style={{ fontWeight: 600, color: '#1a1d2e' }}>{total.toLocaleString('en-IN')}</span> {label}
    </span>
    <Space>
      {extra}
      {data && columns && exportFilename && (
        <Button
          size="small"
          icon={<DownloadOutlined />}
          onClick={() => exportToCSV(data, columns, exportFilename)}
          style={{ borderRadius: 6, fontSize: 12 }}
        >
          Export CSV
        </Button>
      )}
    </Space>
  </div>
);

export default TableToolbar;
