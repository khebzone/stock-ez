import React from 'react';
import { Button, Space, Grid } from 'antd';
import { DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';

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
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename + '.csv'; a.click();
  URL.revokeObjectURL(url);
}

export function exportToXLSX(data: any[], columns: Column[], filename: string, sheetName = 'Report') {
  const exportCols = columns.filter(c => c.title && c.title !== '');
  const headerRow = exportCols.map(c => c.title);
  const dataRows  = data.map(row => exportCols.map(c => getVal(row, c.dataIndex, c.key)));

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

  // Auto column widths — max of header length vs longest cell
  ws['!cols'] = exportCols.map((c, ci) => {
    const maxLen = Math.max(
      c.title.length,
      ...dataRows.map(r => String(r[ci] ?? '').length)
    );
    return { wch: Math.min(maxLen + 2, 60) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename + '.xlsx');
}

interface TableToolbarProps {
  total: number;
  label?: string;
  data?: any[];
  columns?: Column[];
  exportFilename?: string;
  exportFormat?: 'csv' | 'excel' | 'both';
  sheetName?: string;
  extra?: React.ReactNode;
}

const TableToolbar: React.FC<TableToolbarProps> = ({
  total, label = 'records', data, columns, exportFilename,
  exportFormat = 'both', sheetName, extra,
}) => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.sm;

  const canExport = !!(data && columns && exportFilename);

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      flexWrap: 'wrap', gap: 8,
      padding: '10px 16px', borderBottom: '1px solid #e8ecf0',
      background: '#fff',
    }}>
      <span style={{ fontSize: 13, color: '#6b7280' }}>
        <span style={{ fontWeight: 600, color: '#1a1d2e' }}>{total.toLocaleString('en-IN')}</span> {label}
      </span>
      <Space wrap>
        {extra}
        {canExport && (exportFormat === 'csv' || exportFormat === 'both') && (
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => exportToCSV(data!, columns!, exportFilename!)}
            style={{ borderRadius: 6, fontSize: 12 }}
          >
            {isMobile ? null : 'CSV'}
          </Button>
        )}
        {canExport && (exportFormat === 'excel' || exportFormat === 'both') && (
          <Button
            size="small"
            icon={<FileExcelOutlined />}
            onClick={() => exportToXLSX(data!, columns!, exportFilename!, sheetName)}
            style={{ borderRadius: 6, fontSize: 12, color: '#059669', borderColor: '#059669' }}
          >
            {isMobile ? null : 'Excel'}
          </Button>
        )}
      </Space>
    </div>
  );
};

export default TableToolbar;
