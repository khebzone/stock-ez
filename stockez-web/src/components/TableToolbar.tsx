import React from 'react';
import { Button, Space, Grid } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import ExcelJS from 'exceljs';

type CellType = 'text' | 'number' | 'currency' | 'date' | 'percent';

export interface Column {
  title: string;
  key: string;
  dataIndex?: string | string[];
  type?: CellType;
  align?: 'left' | 'center' | 'right';
  transform?: (raw: any, row: any) => any;
}

function getRaw(row: any, dataIndex: string | string[] | undefined, key: string): any {
  const path = dataIndex
    ? (Array.isArray(dataIndex) ? dataIndex : dataIndex.split('.'))
    : [key];
  return path.reduce((o: any, k: string) => o?.[k], row);
}

function resolve(row: any, c: Column): any {
  let raw = getRaw(row, c.dataIndex, c.key);
  if (c.transform) raw = c.transform(raw, row);
  return raw;
}

function toNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
}

function toDate(v: any): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const NUM_FMT: Record<string, string> = {
  currency: '"₹"#,##0.00',
  number: '#,##0',
  percent: '#,##0.00"%"',
  date: 'dd mmm yyyy',
};

const MONEY_WORDS = /(amount|total|paid|balance|outstanding|\bdue\b|price|\brate\b|value|revenue|cogs|profit|margin|cash|\bupi\b|bank|credit|debit|\bgst\b|\btax\b|cost|\bmrp\b|sale|purchase|\bavg\b|subtotal|gross|\bnet\b|collection|ordered|discount|incentive|commission|\bfee\b|salary|wage|rent|expense|payable|receivable)/i;
const ID_WORDS = /(phone|mobile|contact|\bhsn\b|invoice|gstin|\bpan\b|ifsc|pincode|pin code|account|\bcode\b|#|\bno\b|reference|barcode)/i;
const NUM_RE = /^-?\s*₹?\s*[\d,]+(\.\d+)?$/;

function detectType(c: Column, data: any[]): CellType {
  if (c.type) return c.type;
  const t = c.title.toLowerCase().trim();

  if (/%|percent|\bpct\b/.test(t)) return 'percent';
  if (/\bdate\b/.test(t)) return 'date';

  const agingBucket = /day/.test(t) && /^[<>+\d]/.test(t);      // "0-7 Days", ">60 Days" → ₹
  if (/day/.test(t) && !agingBucket) return 'number';            // "Days Outstanding", "Days Idle"
  if (ID_WORDS.test(t)) return 'text';                           // phone / hsn / invoice no / order #

  const vals = data
    .map(r => resolve(r, c))
    .filter(v => v !== null && v !== undefined && v !== '' && v !== '—');
  if (!vals.length) return 'text';

  const allNum = vals.every(v => NUM_RE.test(String(v).trim()) && toNum(v) !== null);
  if (allNum) {
    if (agingBucket) return 'currency';
    const hasDecimal = vals.some(v => String(v).includes('.'));
    return (MONEY_WORDS.test(t) || hasDecimal) ? 'currency' : 'number';
  }

  const allDate = vals.every(v => /^\d{4}-\d{2}-\d{2}([T ]|$)/.test(String(v)));
  if (allDate) return 'date';

  return 'text';
}

function cellValue(row: any, c: Column, rtype: CellType): any {
  const raw = resolve(row, c);
  if (rtype === 'currency' || rtype === 'number' || rtype === 'percent') {
    const n = toNum(raw); return n === null ? '' : n;
  }
  if (rtype === 'date') { const d = toDate(raw); return d ?? ''; }
  return raw === null || raw === undefined ? '' : String(raw);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function today(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function prettify(filename: string): string {
  return filename
    .replace(/\d{4}-\d{2}-\d{2}/g, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, ch => ch.toUpperCase()) || 'Report';
}

function safeSheetName(name: string): string {
  return (name || 'Report').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Report';
}

export interface ExportOptions {
  title?: string;
  subtitle?: string;
  totals?: boolean;
}

function buildStyledSheet(
  ws: ExcelJS.Worksheet,
  data: any[],
  columns: Column[],
  options: ExportOptions,
  titleFallback: string,
) {
  const cols = columns.filter(c => c.title && c.title !== '');
  const nCols = cols.length;
  const rtypes = cols.map(c => detectType(c, data));

  const dataAlign = (i: number): 'left' | 'center' | 'right' => {
    const c = cols[i];
    if (c.align) return c.align;
    const rt = rtypes[i];
    return (rt === 'currency' || rt === 'number' || rt === 'percent') ? 'right' : 'left';
  };

  // ── Header (row 1) — light fill, bold text, uniform thin grid ──
  const GRID = 'FFD0D5DD';       // thin cell border
  const HEADER_BG = 'FFF2F4F7';  // light grey header
  const headerRow = ws.addRow(cols.map(c => c.title));
  const headerRowNumber = headerRow.number;
  headerRow.height = 22;
  const thinGrid = () => ({
    top:    { style: 'thin' as const, color: { argb: GRID } },
    bottom: { style: 'thin' as const, color: { argb: GRID } },
    left:   { style: 'thin' as const, color: { argb: GRID } },
    right:  { style: 'thin' as const, color: { argb: GRID } },
  });
  for (let col = 1; col <= nCols; col++) {
    const cell = headerRow.getCell(col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    cell.font = { bold: true, color: { argb: 'FF111827' }, size: 10, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: dataAlign(col - 1), wrapText: false };
    cell.border = thinGrid();
  }

  // ── Data — clean white rows with a thin grid on EVERY cell (incl. empty ones) ──
  data.forEach((row) => {
    const dataRow = ws.addRow(cols.map((c, ci) => cellValue(row, c, rtypes[ci])));
    dataRow.height = 18;
    for (let col = 1; col <= nCols; col++) {
      const cell = dataRow.getCell(col);
      const rt = rtypes[col - 1];
      cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF1F2937' } };
      cell.alignment = { vertical: 'middle', horizontal: dataAlign(col - 1) };
      cell.border = thinGrid();
      if (NUM_FMT[rt]) cell.numFmt = NUM_FMT[rt];
    }
  });

  // ── Totals (opt-in) — sums currency columns only ──
  if (options.totals && data.length) {
    const totalsVals = cols.map((c, i) => {
      if (rtypes[i] === 'currency') {
        return data.reduce((sum, row) => sum + (toNum(resolve(row, c)) ?? 0), 0);
      }
      return i === 0 ? 'Total' : '';
    });
    const totalsRow = ws.addRow(totalsVals);
    totalsRow.height = 20;
    for (let col = 1; col <= nCols; col++) {
      const cell = totalsRow.getCell(col);
      const rt = rtypes[col - 1];
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F7' } };
      cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: 'FF111827' } };
      cell.alignment = { vertical: 'middle', horizontal: dataAlign(col - 1) };
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FF98A2B3' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D5DD' } },
        left:   { style: 'thin', color: { argb: 'FFD0D5DD' } },
        right:  { style: 'thin', color: { argb: 'FFD0D5DD' } },
      };
      if (NUM_FMT[rt]) cell.numFmt = NUM_FMT[rt];
    }
  }

  // ── Column widths ──
  const minByType: Record<string, number> = { currency: 14, date: 13, number: 11, percent: 11 };
  cols.forEach((c, i) => {
    const rt = rtypes[i];
    const headerLen = c.title.length;
    const maxData = Math.max(0, ...data.map(row => {
      const raw = resolve(row, c);
      if (rt === 'currency') { const n = toNum(raw); return n === null ? 0 : n.toFixed(2).length + 3; }
      if (rt === 'date') return 11;
      return String(raw ?? '').length;
    }));
    const base = Math.max(headerLen, maxData) + 3;
    ws.getColumn(i + 1).width = Math.min(Math.max(base, minByType[rt] ?? 10), 45);
  });

  // ── Freeze header, gridlines off (cell borders draw the grid), no filter buttons ──
  ws.views = [{ state: 'frozen', ySplit: headerRowNumber, showGridLines: false }];

  // ── Print layout: margins + fit to width + repeat header + footer ──
  ws.pageSetup = {
    margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    orientation: nCols > 6 ? 'landscape' : 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    printTitlesRow: `${headerRowNumber}:${headerRowNumber}`,
  };
  ws.headerFooter = {
    oddFooter: '&LStockEz&CPage &P of &N&R&D',
    evenFooter: '&LStockEz&CPage &P of &N&R&D',
  };

}

async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename + '.xlsx'; a.click();
  URL.revokeObjectURL(url);
}

export async function exportToXLSX(
  data: any[],
  columns: Column[],
  filename: string,
  sheetName = 'Report',
  options: ExportOptions = {},
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'StockEz';
  workbook.created = new Date();
  const ws = workbook.addWorksheet(safeSheetName(sheetName));
  const titleFallback = (sheetName && sheetName !== 'Report') ? sheetName : prettify(filename);
  buildStyledSheet(ws, data, columns, options, titleFallback);
  await downloadWorkbook(workbook, filename);
}

export interface SheetSpec {
  sheetName: string;
  data: any[];
  columns: Column[];
  options?: ExportOptions;
}

/** Export multiple styled sheets into one workbook — same professional design per sheet. */
export async function exportSheetsToXLSX(sheets: SheetSpec[], filename: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'StockEz';
  workbook.created = new Date();
  for (const s of sheets) {
    const ws = workbook.addWorksheet(safeSheetName(s.sheetName));
    buildStyledSheet(ws, s.data, s.columns, s.options ?? {}, s.options?.title ?? s.sheetName);
  }
  await downloadWorkbook(workbook, filename);
}

interface TableToolbarProps {
  total: number;
  label?: string;
  data?: any[];
  columns?: Column[];
  exportFilename?: string;
  exportFormat?: 'csv' | 'excel' | 'both';
  sheetName?: string;
  exportTitle?: string;
  exportSubtitle?: string;
  exportTotals?: boolean;
  onExport?: () => void | Promise<void>;
  extra?: React.ReactNode;
}

const TableToolbar: React.FC<TableToolbarProps> = ({
  total, label = 'records', data, columns, exportFilename,
  exportFormat = 'both', sheetName, exportTitle, exportSubtitle, exportTotals, onExport, extra,
}) => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.sm;
  const [exporting, setExporting] = React.useState(false);

  const canExport = !!onExport || !!(data && columns && exportFilename);

  const handleExport = async () => {
    setExporting(true);
    try {
      if (onExport) {
        await onExport();
      } else {
        await exportToXLSX(data!, columns!, exportFilename!, sheetName, {
          title: exportTitle,
          subtitle: exportSubtitle,
          totals: exportTotals,
        });
      }
    } finally {
      setExporting(false);
    }
  };

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
        {canExport && (exportFormat === 'excel' || exportFormat === 'both') && (
          <Button
            size="small"
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={handleExport}
            style={{ borderRadius: 6, fontSize: 12, color: '#059669', borderColor: '#059669' }}
          >
            {isMobile ? null : 'Export'}
          </Button>
        )}
      </Space>
    </div>
  );
};

export default TableToolbar;
