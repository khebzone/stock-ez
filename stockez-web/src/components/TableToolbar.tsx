import React from 'react';
import { Button, Space, Grid, Modal, message } from 'antd';
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons';
import ExcelJS from 'exceljs';
import { companyLines, getExportCompany } from '../utils/exportBranding';

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
  currency: '"₹"#,##0.00;[Red]-"₹"#,##0.00',
  number: '#,##0;[Red]-#,##0',
  percent: '#,##0.00"%";[Red]-#,##0.00"%"',
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
  /** Column keys to sum in the totals row. Without it, every currency column is summed. */
  totalKeys?: string[];
  /** Column key to group rows under a heading band, with a subtotal after each group. */
  groupBy?: string;
}

function groupRows(data: any[], c: Column): { label: string; rows: any[] }[] {
  const groups: { label: string; rows: any[] }[] = [];
  const index = new Map<string, { label: string; rows: any[] }>();
  data.forEach(row => {
    const raw = resolve(row, c);
    const label = raw === null || raw === undefined || raw === '' ? 'Unassigned' : String(raw);
    let g = index.get(label);
    if (!g) { g = { label, rows: [] }; index.set(label, g); groups.push(g); }
    g.rows.push(row);
  });
  return groups;
}

function buildStyledSheet(
  ws: ExcelJS.Worksheet,
  data: any[],
  columns: Column[],
  options: ExportOptions,
  titleFallback: string,
) {
  const groupCol = options.groupBy ? columns.find(c => c.key === options.groupBy) : undefined;
  const cols = columns.filter(c => c.title && c.title !== '' && c !== groupCol);
  const nCols = cols.length;
  const rtypes = cols.map(c => detectType(c, data));

  const dataAlign = (i: number): 'left' | 'center' | 'right' => {
    const c = cols[i];
    if (c.align) return c.align;
    const rt = rtypes[i];
    if (rt === 'date') return 'center';
    return (rt === 'currency' || rt === 'number' || rt === 'percent') ? 'right' : 'left';
  };

  const NAVY = 'FF1F2A44';
  const ACCENT = 'FF2563EB';
  const GRID = 'FFE4E7EC';
  const ZEBRA = 'FFF8F9FB';
  const lastCol = Math.max(nCols, 1);

  const brand = companyLines(getExportCompany());
  const hasLogo = !!getExportCompany()?.logoUrl;
  const logoIndent = hasLogo ? 7 : 0;
  const bandRow = (text: string, height: number, font: Partial<ExcelJS.Font>) => {
    const r = ws.addRow([text]);
    r.height = height;
    if (lastCol > 1) ws.mergeCells(r.number, 1, r.number, lastCol);
    r.getCell(1).font = { name: 'Calibri', ...font };
    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: logoIndent };
    return r;
  };
  bandRow(brand.name, 26, { bold: true, size: 18, color: { argb: NAVY } });
  bandRow(brand.address, 16, { size: 10, color: { argb: 'FF475467' } });
  bandRow(brand.contact, 16, { size: 10, color: { argb: 'FF475467' } });
  const accentRow = ws.addRow([]);
  accentRow.height = 5;
  for (let col = 1; col <= lastCol; col++) {
    accentRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } };
  }
  ws.addRow([]).height = 8;

  const title = options.title || titleFallback;
  const meta = [options.subtitle, `Generated ${today()}`, `${data.length.toLocaleString('en-IN')} record${data.length === 1 ? '' : 's'}`]
    .filter(Boolean).join('   |   ');
  const titleRow = bandRow(title, 28, { bold: true, size: 15, color: { argb: 'FF101828' } });
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  const metaRow = bandRow(meta, 18, { size: 10, italic: true, color: { argb: 'FF667085' } });
  metaRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  ws.addRow([]).height = 10;

  const headerRow = ws.addRow(cols.map(c => c.title));
  const headerRowNumber = headerRow.number;
  headerRow.height = 26;
  for (let col = 1; col <= nCols; col++) {
    const cell = headerRow.getCell(col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: dataAlign(col - 1), wrapText: true, indent: 1 };
  }

  const isSummable = (i: number) => options.totalKeys ? options.totalKeys.includes(cols[i].key) : rtypes[i] === 'currency';
  const addTotalsRow = (label: string, rows: any[], grand: boolean) => {
    const vals = cols.map((c, i) => {
      if (isSummable(i)) return Math.round(rows.reduce((sum, row) => sum + (toNum(resolve(row, c)) ?? 0), 0) * 100) / 100;
      return i === 0 ? label : '';
    });
    const row = ws.addRow(vals);
    row.height = grand ? 24 : 20;
    for (let col = 1; col <= nCols; col++) {
      const cell = row.getCell(col);
      const rt = rtypes[col - 1];
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: grand ? 'FFEEF1F6' : 'FFF3F5F9' } };
      cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: NAVY } };
      cell.alignment = { vertical: 'middle', horizontal: dataAlign(col - 1), indent: 1 };
      cell.border = grand
        ? { top: { style: 'medium', color: { argb: NAVY } }, bottom: { style: 'medium', color: { argb: NAVY } } }
        : { top: { style: 'thin', color: { argb: NAVY } }, bottom: { style: 'thin', color: { argb: GRID } } };
      if (NUM_FMT[rt]) cell.numFmt = NUM_FMT[rt];
    }
  };

  const groups = groupCol ? groupRows(data, groupCol) : [{ label: '', rows: data }];
  const showTotals = !!options.totals && data.length > 0;

  groups.forEach(g => {
    if (groupCol) {
      const band = ws.addRow([`${g.label}   (${g.rows.length} item${g.rows.length === 1 ? '' : 's'})`]);
      band.height = 22;
      if (lastCol > 1) ws.mergeCells(band.number, 1, band.number, lastCol);
      band.getCell(1).font = { bold: true, size: 10.5, name: 'Calibri', color: { argb: ACCENT } };
      band.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      band.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF4FF' } };
      band.getCell(1).border = { bottom: { style: 'thin', color: { argb: ACCENT } } };
    }
    g.rows.forEach((row, ri) => {
      const dataRow = ws.addRow(cols.map((c, ci) => cellValue(row, c, rtypes[ci])));
      dataRow.height = 20;
      for (let col = 1; col <= nCols; col++) {
        const cell = dataRow.getCell(col);
        const rt = rtypes[col - 1];
        cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF1F2937' } };
        cell.alignment = { vertical: 'middle', horizontal: dataAlign(col - 1), indent: 1 };
        cell.border = { bottom: { style: 'thin', color: { argb: GRID } } };
        if (ri % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
        if (NUM_FMT[rt]) cell.numFmt = NUM_FMT[rt];
      }
    });
    if (groupCol && showTotals) addTotalsRow(`Subtotal — ${g.label}`, g.rows, false);
  });

  if (showTotals) addTotalsRow('Total', data, true);

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
    const base = Math.max(headerLen, maxData) + 5;
    ws.getColumn(i + 1).width = Math.min(Math.max(base, minByType[rt] ?? 10), 45);
  });

  // ── Freeze header, gridlines off (cell borders draw the grid), no filter buttons ──
  if (!groupCol) ws.autoFilter = { from: { row: headerRowNumber, column: 1 }, to: { row: headerRowNumber, column: lastCol } };
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

const logoCache = new Map<string, { base64: string; extension: 'png' | 'jpeg' } | null>();

async function loadLogo(url: string) {
  if (logoCache.has(url)) return logoCache.get(url)!;
  let result: { base64: string; extension: 'png' | 'jpeg' } | null = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    if (/^data:image\/(png|jpeg|jpg)/.test(dataUrl)) {
      result = { base64: dataUrl, extension: dataUrl.startsWith('data:image/png') ? 'png' : 'jpeg' };
    }
  } catch { result = null; }
  logoCache.set(url, result);
  return result;
}

async function attachLogo(workbook: ExcelJS.Workbook, ws: ExcelJS.Worksheet) {
  const url = getExportCompany()?.logoUrl;
  if (!url) return;
  const logo = await loadLogo(url);
  if (!logo) return;
  const id = workbook.addImage({ base64: logo.base64, extension: logo.extension });
  ws.addImage(id, { tl: { col: 0.1, row: 0.15 }, ext: { width: 66, height: 66 } });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename + '.xlsx');
}

export interface SheetSpec {
  sheetName: string;
  data: any[];
  columns: Column[];
  options?: ExportOptions;
}

async function writeXLSX(sheets: SheetSpec[], filename: string, single: boolean) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = getExportCompany()?.name || 'StockEz';
  workbook.created = new Date();
  for (const s of sheets) {
    const ws = workbook.addWorksheet(safeSheetName(s.sheetName), { properties: { tabColor: { argb: 'FF2563EB' } } });
    const fallback = single
      ? ((s.sheetName && s.sheetName !== 'Report') ? s.sheetName : prettify(filename))
      : (s.options?.title ?? s.sheetName);
    buildStyledSheet(ws, s.data, s.columns, s.options ?? {}, fallback);
    await attachLogo(workbook, ws);
  }
  await downloadWorkbook(workbook, filename);
}

// ───────────────────────── PDF (print-ready HTML) ─────────────────────────

const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inr = (n: number, d = 2) => n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

function formatPdfCell(row: any, c: Column, rt: CellType): { text: string; neg: boolean } {
  const raw = resolve(row, c);
  if (rt === 'currency' || rt === 'number' || rt === 'percent') {
    const n = toNum(raw);
    if (n === null) return { text: '', neg: false };
    const body = rt === 'currency' ? `₹${inr(Math.abs(n))}` : rt === 'percent' ? `${inr(Math.abs(n))}%` : inr(Math.abs(n), Number.isInteger(n) ? 0 : 2);
    return { text: n < 0 ? `-${body}` : body, neg: n < 0 };
  }
  if (rt === 'date') { const d = toDate(raw); return { text: d ? fmtDate(d) : '', neg: false }; }
  return { text: raw === null || raw === undefined ? '' : String(raw), neg: false };
}

function sheetToHtml(s: SheetSpec, fallbackTitle: string): { html: string; landscape: boolean } {
  const options = s.options ?? {};
  const groupCol = options.groupBy ? s.columns.find(c => c.key === options.groupBy) : undefined;
  const cols = s.columns.filter(c => c.title && c.title !== '' && c !== groupCol);
  const rtypes = cols.map(c => detectType(c, s.data));
  const alignOf = (i: number) => cols[i].align ?? (rtypes[i] === 'date' ? 'center' : (['currency', 'number', 'percent'].includes(rtypes[i]) ? 'right' : 'left'));
  const title = options.title || fallbackTitle;

  const head = cols.map((c, i) => `<th class="${alignOf(i)}">${esc(c.title)}</th>`).join('');

  // Column widths follow the content (longest value, capped) so narrow columns stay narrow
  // instead of the table spreading the leftover width evenly.
  const typicals = cols.map((c, i) => {
    const lens = s.data.map(r => formatPdfCell(r, c, rtypes[i]).text.length).sort((a, b) => a - b);
    return lens.length ? lens[Math.min(lens.length - 1, Math.floor(lens.length * 0.9))] : 0;
  });
  const weights = cols.map((c, i) => Math.min(Math.max(typicals[i], Math.ceil(c.title.length * 0.9), 4), 36) + 5);
  const nowrap = typicals.map(t => t <= 14);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const colgroup = `<colgroup>${weights.map(w => `<col style="width:${(w / weightSum * 100).toFixed(2)}%">`).join('')}</colgroup>`;
  const rowHtml = (row: any) => `<tr>${cols.map((c, i) => {
    const { text, neg } = formatPdfCell(row, c, rtypes[i]);
    return `<td class="${alignOf(i)}${neg ? ' neg' : ''}${rtypes[i] !== 'text' || nowrap[i] ? ' num' : ''}">${esc(text)}</td>`;
  }).join('')}</tr>`;

  const isSummable = (i: number) => options.totalKeys ? options.totalKeys.includes(cols[i].key) : rtypes[i] === 'currency';
  const sumOf = (rows: any[]) => cols.map((c, i) => isSummable(i) ? Math.round(rows.reduce((a, r) => a + (toNum(resolve(r, c)) ?? 0), 0) * 100) / 100 : null);
  const fmtSum = (v: number, rt: CellType) => `${v < 0 ? '-' : ''}${rt === 'currency' ? '₹' : ''}${inr(Math.abs(v), rt === 'currency' || !Number.isInteger(v) ? 2 : 0)}`;
  const totalsRowHtml = (cls: string, label: string, sums: (number | null)[]) =>
    `<tr class="${cls}">${cols.map((_, i) => {
      const v = sums[i];
      if (v === null) return `<td class="${alignOf(i)}">${i === 0 ? esc(label) : ''}</td>`;
      return `<td class="${alignOf(i)} num${v < 0 ? ' neg' : ''}">${fmtSum(v, rtypes[i])}</td>`;
    }).join('')}</tr>`;

  const showTotals = !!options.totals && s.data.length > 0;
  const groups = groupCol ? groupRows(s.data, groupCol) : [{ label: '', rows: s.data }];
  const body = groups.map(g => {
    const band = groupCol
      ? `<tr class="grp"><td colspan="${cols.length}">${esc(g.label)} <span>${g.rows.length} item${g.rows.length === 1 ? '' : 's'}</span></td></tr>`
      : '';
    const sub = groupCol && showTotals ? totalsRowHtml('sub', `Subtotal — ${g.label}`, sumOf(g.rows)) : '';
    return band + g.rows.map(rowHtml).join('') + sub;
  }).join('');

  const sums = showTotals ? sumOf(s.data) : null;
  const totalRow = sums ? totalsRowHtml('total', 'Total', sums) : '';

  const kpis: string[] = [`<div class="kpi"><span>Records</span><b>${s.data.length.toLocaleString('en-IN')}</b></div>`];
  if (sums) {
    cols.forEach((c, i) => {
      const v = sums[i];
      if (v !== null && kpis.length < 4) {
        kpis.push(`<div class="kpi"><span>${esc(c.title)}</span><b class="${v < 0 ? 'neg' : ''}">${fmtSum(v, rtypes[i])}</b></div>`);
      }
    });
  }

  const html = `
    <section class="sheet">
      <div class="report-head">
        <div><h2>${esc(title)}</h2>${options.subtitle ? `<p>${esc(options.subtitle)}</p>` : ''}</div>
        <div class="kpis">${kpis.join('')}</div>
      </div>
      <table>${colgroup}<thead><tr>${head}</tr></thead><tbody>${body}${totalRow}</tbody></table>
      ${s.data.length ? '' : '<div class="empty">No records to display</div>'}
    </section>`;
  return { html, landscape: cols.length > 6 && weightSum > 135 };
}

const PDF_CSS = `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: 'Segoe UI', 'Noto Sans Tamil', Arial, sans-serif; color: #1f2937; font-size: 10px; }
  .letterhead { display: flex; align-items: center; gap: 14px; padding: 0 0 10px; border-bottom: 3px solid #2563eb; margin-bottom: 14px; position: relative; }
  .letterhead::after { content: ""; position: absolute; left: 0; bottom: -3px; width: 64px; height: 3px; background: #1f2a44; }
  .logo { height: 54px; max-width: 120px; object-fit: contain; }
  .company h1 { margin: 0; font-size: 20px; letter-spacing: -.3px; color: #1f2a44; }
  .company div { color: #475467; font-size: 9.5px; margin-top: 2px; }
  .stamp { margin-left: auto; text-align: right; color: #667085; font-size: 9px; line-height: 1.5; }
  .stamp b { display: block; color: #1f2a44; font-size: 9px; letter-spacing: 1.2px; text-transform: uppercase; }
  .sheet { margin-bottom: 18px; }
  .sheet + .sheet { page-break-before: always; }
  .report-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin: 6px 0 10px; }
  .report-head h2 { margin: 0; font-size: 15px; color: #101828; }
  .report-head p { margin: 3px 0 0; color: #667085; font-size: 10px; }
  .kpis { display: flex; gap: 8px; }
  .kpi { border: 1px solid #e4e7ec; border-left: 3px solid #2563eb; border-radius: 4px; padding: 5px 10px; min-width: 90px; background: #f8fafc; }
  .kpi span { display: block; color: #667085; font-size: 8px; text-transform: uppercase; letter-spacing: .6px; }
  .kpi b { font-size: 12px; color: #1f2a44; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  td { overflow-wrap: anywhere; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { background: #1f2a44; color: #fff; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; padding: 7px 8px; }
  td { padding: 5.5px 8px; border-bottom: 1px solid #eaecf0; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #f8f9fb; }
  .left { text-align: left; } .right { text-align: right; } .center { text-align: center; }
  .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .neg, .kpi b.neg { color: #d92d20; }
  tr.total td { background: #eef1f6 !important; font-weight: 700; color: #1f2a44; border-top: 2px solid #1f2a44; border-bottom: 2px solid #1f2a44; }
  tr.grp td { background: #eff4ff !important; color: #2563eb; font-weight: 700; font-size: 10px; border-bottom: 1px solid #2563eb; padding: 6px 8px; page-break-after: avoid; }
  tr.grp td span { color: #667085; font-weight: 500; margin-left: 8px; font-size: 9px; }
  tr.sub td { background: #f3f5f9 !important; font-weight: 700; color: #1f2a44; border-top: 1px solid #1f2a44; }
  .empty { text-align: center; color: #98a2b3; padding: 28px; }
  .toolbar { font: 12px 'Segoe UI', Arial; }
  .toolbar button { background: #2563eb; color: #fff; border: 0; border-radius: 6px; padding: 7px 14px; cursor: pointer; }
  @media screen {
    body { padding: 56px 28px 28px; background: #fff; }
    .toolbar { position: fixed; top: 0; left: 0; right: 0; z-index: 10; background: #f8fafc; border-bottom: 1px solid #e4e7ec; padding: 9px 28px; text-align: right; }
  }
  @media print { .toolbar { display: none; } }
`;

function printHtml(sheets: SheetSpec[], filename: string, single: boolean): boolean {
  const company = getExportCompany();
  const brand = companyLines(company);
  const parts = sheets.map(s => sheetToHtml(
    s, single ? ((s.sheetName && s.sheetName !== 'Report') ? s.sheetName : prettify(filename)) : (s.options?.title ?? s.sheetName),
  ));
  const landscape = parts.some(p => p.landscape);
  const logo = company?.logoUrl ? `<img class="logo" src="${esc(company.logoUrl)}" alt="" />` : '';
  const footFont = "font: 8px 'Segoe UI', Arial, sans-serif; color: #98a2b3;";
  const pageCss = `@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 14mm 12mm 16mm;
    @bottom-left { content: "${esc(brand.name)}"; ${footFont} }
    @bottom-center { content: "Page " counter(page) " of " counter(pages); ${footFont} }
    @bottom-right { content: "${fmtDate(new Date())}"; ${footFont} } }`;

  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(filename)}</title>
<style>${pageCss}${PDF_CSS}</style></head><body>
  <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
  <div class="letterhead">
    ${logo}
    <div class="company"><h1>${esc(brand.name)}</h1>${brand.address ? `<div>${esc(brand.address)}</div>` : ''}${brand.contact ? `<div>${esc(brand.contact)}</div>` : ''}</div>
    <div class="stamp"><b>Report</b>Generated ${esc(today())}</div>
  </div>
  ${parts.map(p => p.html).join('')}
  <script>
    window.addEventListener('load', function () {
      var imgs = Array.prototype.slice.call(document.images);
      Promise.all(imgs.map(function (i) { return i.complete ? 0 : new Promise(function (r) { i.onload = i.onerror = r; }); }))
        .then(function () { setTimeout(function () { window.focus(); window.print(); }, 250); });
    });
  </script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(doc);
  w.document.close();
  return true;
}

function runPdf(sheets: SheetSpec[], filename: string, single: boolean) {
  if (!printHtml(sheets, filename, single)) {
    message.error('Pop-up blocked. Allow pop-ups for this site to export PDF.');
  }
}

function chooseFormat(): Promise<'xlsx' | 'pdf' | null> {
  return new Promise(resolve => {
    let done = false;
    const finish = (v: 'xlsx' | 'pdf' | null) => { if (!done) { done = true; resolve(v); } };
    const modal = Modal.info({
      icon: null,
      title: 'Export report',
      width: 380,
      centered: true,
      closable: true,
      maskClosable: true,
      footer: null,
      onCancel: () => finish(null),
      afterClose: () => finish(null),
      content: React.createElement('div', { style: { display: 'flex', gap: 10, marginTop: 12 } },
        React.createElement(Button, {
          type: 'primary', size: 'large', icon: React.createElement(FileExcelOutlined), style: { flex: 1 },
          onClick: () => { finish('xlsx'); modal.destroy(); },
        }, 'Excel'),
        React.createElement(Button, {
          size: 'large', icon: React.createElement(FilePdfOutlined), style: { flex: 1 },
          onClick: () => { finish('pdf'); modal.destroy(); },
        }, 'PDF'),
      ),
    });
  });
}

export async function exportToXLSX(
  data: any[],
  columns: Column[],
  filename: string,
  sheetName = 'Report',
  options: ExportOptions = {},
) {
  const fmt = await chooseFormat();
  if (!fmt) return;
  const sheets = [{ sheetName, data, columns, options }];
  if (fmt === 'pdf') runPdf(sheets, filename, true);
  else await writeXLSX(sheets, filename, true);
}

export async function exportSheetsToXLSX(sheets: SheetSpec[], filename: string) {
  const fmt = await chooseFormat();
  if (!fmt) return;
  if (fmt === 'pdf') runPdf(sheets, filename, false);
  else await writeXLSX(sheets, filename, false);
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
