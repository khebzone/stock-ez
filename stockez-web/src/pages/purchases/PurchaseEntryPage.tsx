import React, { useState, useRef, useEffect, useMemo } from 'react';
import { InputNumber, DatePicker, Select, Button, message, Modal, Drawer, Grid, Alert, Segmented } from 'antd';
import { WarningOutlined, PlusOutlined, DeleteOutlined, SaveOutlined, InboxOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useGetAllProductsQuery } from '../../store/api/productApi';
import { useCreatePurchaseMutation, useUpdatePurchaseBillMutation, useSavePurchaseDraftMutation } from '../../store/api/purchaseApi';
import { useGetSuppliersQuery } from '../../store/api/supplierApi';

const GREEN = '#059669';
const AMBER = '#d97706';
const RED   = '#dc2626';
const MUTED = '#fafafa';

type DiscMode = 'PERCENT' | 'AMOUNT';

interface BatchLine {
  id: number;
  itemId?: string;
  soldUnits?: number;
  productId: string | null;
  qty: number | null;
  freeQty: number | null;
  mrp: number | null;
  totalAmount: number | null;
  discount: number | null;
  gstPct: number | null;
  mfgDate: any;
  expiryDate: any;
  minSaleRate: number | null;
  maxSaleRate: number | null;
}

interface BillAdjustments {
  discMode: DiscMode;
  billDiscMode: DiscMode;
  billDiscValue: number | null;
  cashDiscMode: DiscMode;
  cashDiscValue: number | null;
  freight: number | null;
  roundOff: number | null;
  invoiceTotal: number | null;
}

const emptyAdjustments = (): BillAdjustments => ({
  discMode: 'PERCENT', billDiscMode: 'PERCENT', billDiscValue: null,
  cashDiscMode: 'PERCENT', cashDiscValue: null, freight: null, roundOff: null, invoiceTotal: null,
});

const emptyLine = (id: number): BatchLine => ({
  id, productId: null, qty: null, freeQty: null, mrp: null, totalAmount: null, discount: null,
  gstPct: null, mfgDate: null, expiryDate: null, minSaleRate: null, maxSaleRate: null,
});

const r2 = (n: number) => Math.round(n * 100) / 100;

interface LineCalc {
  units: number;
  itemDisc: number;
  billShare: number;
  freightShare: number;
  netAmt: number;
  taxable: number;
  cgstPct: number;
  cgstAmt: number;
  sgstAmt: number;
  purRate: number;
}

const EMPTY_CALC: LineCalc = {
  units: 0, itemDisc: 0, billShare: 0, freightShare: 0, netAmt: 0, taxable: 0,
  cgstPct: 0, cgstAmt: 0, sgstAmt: 0, purRate: 0,
};

const allocate = (total: number, weights: number[]): number[] => {
  const sumW = weights.reduce((s, w) => s + w, 0);
  if (!total || !sumW) return weights.map(() => 0);
  let largest = 0;
  const shares = weights.map((w, i) => {
    if (w > weights[largest]) largest = i;
    return r2(total * w / sumW);
  });
  shares[largest] = r2(shares[largest] + r2(total - shares.reduce((s, x) => s + x, 0)));
  return shares;
};

const adjustment = (mode: DiscMode, value: number | null, base: number) =>
  !value || value <= 0 ? 0 : Math.min(mode === 'PERCENT' ? r2(base * value / 100) : r2(value), base);

// Mirrors PurchaseService on the server: item discount → bill discount spread by value (before GST)
// → GST split → freight spread by value into landed cost → cash discount after GST → round-off.
const computeBill = (lines: BatchLine[], adj: BillAdjustments) => {
  const pre = lines.filter(l => !!l.productId).map(l => {
    const gross = r2(l.totalAmount || 0);
    const d = l.discount || 0;
    const itemDisc = Math.min(adj.discMode === 'PERCENT' ? r2(gross * d / 100) : r2(d), gross);
    return { l, gross, itemDisc, afterDisc: r2(gross - itemDisc), units: (l.qty || 0) + (l.freeQty || 0) };
  });
  const goods = r2(pre.reduce((s, p) => s + p.afterDisc, 0));
  const billDisc = adjustment(adj.billDiscMode, adj.billDiscValue, goods);
  const billShares = allocate(billDisc, pre.map(p => p.afterDisc));
  const nets = pre.map((p, i) => r2(p.afterDisc - billShares[i]));
  const freight = r2(adj.freight || 0);
  const freightShares = allocate(freight, nets.some(n => n > 0) ? nets : pre.map(p => p.units));

  const byId: Record<number, LineCalc> = {};
  let gross = 0, itemDisc = 0, taxable = 0, cgst = 0, itemsNet = 0;
  pre.forEach((p, i) => {
    const gstPct = p.l.gstPct || 0;
    const netAmt = nets[i];
    const tx = r2(netAmt / (1 + gstPct / 100));
    const cgstPct = r2(gstPct / 2);
    const cg = r2(tx * cgstPct / 100);
    byId[p.l.id] = {
      units: p.units, itemDisc: p.itemDisc, billShare: billShares[i], freightShare: freightShares[i],
      netAmt, taxable: tx, cgstPct, cgstAmt: cg, sgstAmt: cg,
      purRate: p.units > 0 ? r2((netAmt + freightShares[i]) / p.units) : 0,
    };
    gross += p.gross; itemDisc += p.itemDisc; taxable += tx; cgst += cg; itemsNet += netAmt;
  });
  itemsNet = r2(itemsNet);
  const cashDisc = adjustment(adj.cashDiscMode, adj.cashDiscValue, itemsNet);
  const beforeRound = r2(itemsNet + freight - cashDisc);
  const autoRound = r2(Math.round(beforeRound) - beforeRound);
  const roundOff = adj.roundOff != null ? r2(adj.roundOff) : autoRound;
  return {
    byId,
    totals: {
      gross: r2(gross), itemDisc: r2(itemDisc), billDisc, taxable: r2(taxable), cgst: r2(cgst), sgst: r2(cgst),
      itemsNet, freight, cashDisc, roundOff, autoRound, payable: r2(beforeRound + roundOff),
    },
  };
};

const fmtINR = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const C: React.FC<{ children: React.ReactNode; muted?: boolean; right?: boolean; center?: boolean }> =
  ({ children, muted, right, center }) => (
    <td style={{
      padding: 0, borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle',
      background: muted ? MUTED : undefined,
      textAlign: right ? 'right' : center ? 'center' : 'left',
    }}>
      <div style={{ padding: '3px 8px' }}>{children}</div>
    </td>
  );

const TH: React.FC<{ children: React.ReactNode; right?: boolean; center?: boolean; muted?: boolean }> =
  ({ children, right, center, muted }) => (
    <th style={{
      padding: '9px 8px', fontSize: 10, fontWeight: 700, color: '#8c8c8c',
      textTransform: 'uppercase', letterSpacing: 0.5,
      background: muted ? '#f0f0f0' : MUTED,
      borderBottom: '1px solid #e8e8e8',
      textAlign: right ? 'right' : center ? 'center' : 'left',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  );

const AutoVal: React.FC<{ v: number | null; color?: string }> = ({ v, color }) => (
  v != null && v !== 0
    ? <span style={{ fontSize: 12, fontWeight: 600, color: color || '#374151' }}>{v.toFixed(2)}</span>
    : <span style={{ color: '#d9d9d9', fontSize: 11 }}>—</span>
);

const numStyle: React.CSSProperties = { width: '100%', fontSize: 12 };
const rightInput = { input: { textAlign: 'right' as const } };
const NO_CONTROLS = false;

// shared colgroup widths: 20 columns — numeric/date columns sized to show their
// full values; Product (index 1) flexes to absorb any leftover width.
// #28 | Product(flex) | Unit56 | Qty54 | Free52 | MRP78 | Expiry126 | TotalAmt90 | Discount78 | BillDisc72 |
// PurchRate80 | CGST%44 | CGST₹68 | SGST%44 | SGST₹68 | NetTotal86 | MinSale80 | MaxSale80 | Stock56 | Del26
const COLS = [28,240,56,54,52,78,126,90,78,72,80,44,68,44,68,86,80,80,56,26];
const NCOLS = COLS.length;

// Product column (index 1) is left flexible so it absorbs all leftover
// horizontal space — fills the table edge-to-edge on wide screens.
const BILL_DISC_COL = 9;
const ColGroup = ({ showBillDisc }: { showBillDisc: boolean }) => (
  <colgroup>
    {COLS.map((w, i) => (i === BILL_DISC_COL && !showBillDisc) ? null : <col key={i} style={i === 1 ? undefined : { width: w }} />)}
  </colgroup>
);

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5,
};

interface PurchaseDraft {
  savedAt: string;
  supplierId: string | null;
  purchaseDate: string | null;
  invoiceNo: string;
  lines: BatchLine[];
  adj?: BillAdjustments;
}

const draftKey = () => {
  const u = JSON.parse(localStorage.getItem('user') || '{}');
  return `stockez.purchaseDraft.${u.tenantId || ''}.${u.id || u.phone || ''}`;
};

const readDraft = (): PurchaseDraft | null => {
  try {
    const raw = localStorage.getItem(draftKey());
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const writeDraft = (d: PurchaseDraft | null) => {
  try {
    if (d) localStorage.setItem(draftKey(), JSON.stringify(d));
    else localStorage.removeItem(draftKey());
  } catch { /* storage unavailable — draft is best-effort */ }
};

const draftHasContent = (d: { supplierId: string | null; invoiceNo: string; lines: BatchLine[] }) =>
  !!d.supplierId || !!d.invoiceNo.trim() || d.lines.some(l => !!l.productId);

const restoreLines = (lines: BatchLine[]): BatchLine[] => lines.map(l => ({
  ...l,
  freeQty: l.freeQty ?? null,
  mfgDate: l.mfgDate ? dayjs(l.mfgDate) : null,
  expiryDate: l.expiryDate ? dayjs(l.expiryDate) : null,
}));

const parseSavedDraft = (draft: any): PurchaseDraft | null => {
  try {
    const d = JSON.parse(draft?.payload || '');
    return d && Array.isArray(d.lines) ? d : null;
  } catch { return null; }
};

interface Props {
  onClose?: () => void;
  onSaved?: () => void;
  // A saved purchase to edit — the screen opens filled with it and saves back to the same entry.
  editEntry?: any;
  // A draft saved earlier (with its payload) — the screen opens filled with it.
  draft?: any;
  onDraftSaved?: () => void;
}

// Rebuilds the screen's lines from a saved bill. The bill amount entered originally is the saved
// line amount plus everything taken off it (its own discount and its share of the bill discount).
const linesFromEntry = (entry: any): BatchLine[] => (entry.items || []).map((it: any, i: number) => {
  const units = (it.quantity || 0) + (it.freeQty || 0);
  const pct = Number(it.discountPercent || 0);
  return {
    id: i + 1,
    itemId: it.id,
    soldUnits: Math.max(units - (it.quantityAvailable ?? units), 0),
    productId: it.product?.id ?? null,
    qty: it.quantity ?? 0,
    freeQty: it.freeQty || null,
    mrp: it.mrp != null ? Number(it.mrp) : null,
    totalAmount: r2(Number(it.amount || 0) + Number(it.discountAmount || 0) + Number(it.billDiscountAmount || 0)),
    discount: pct > 0 ? pct : (Number(it.discountAmount || 0) || null),
    gstPct: Number(it.gstPercent || 0),
    mfgDate: it.mfgDate ? dayjs(it.mfgDate) : null,
    expiryDate: it.expiryDate ? dayjs(it.expiryDate) : null,
    minSaleRate: it.minSaleRate != null ? Number(it.minSaleRate) : null,
    maxSaleRate: it.maxSaleRate != null ? Number(it.maxSaleRate) : null,
  };
});

const adjustmentsFromEntry = (entry: any): BillAdjustments => ({
  discMode: (entry.items || []).some((it: any) => Number(it.discountPercent || 0) > 0) ? 'PERCENT' : 'AMOUNT',
  billDiscMode: entry.billDiscountType === 'AMOUNT' ? 'AMOUNT' : 'PERCENT',
  billDiscValue: Number(entry.billDiscountValue || 0) || null,
  cashDiscMode: entry.cashDiscountType === 'AMOUNT' ? 'AMOUNT' : 'PERCENT',
  cashDiscValue: Number(entry.cashDiscountValue || 0) || null,
  freight: Number(entry.freightAmount || 0) || null,
  // A saved bill keeps the round off it was saved with (0 for bills made before round off existed).
  roundOff: Number(entry.roundOffAmount || 0),
  invoiceTotal: entry.supplierInvoiceTotal != null ? Number(entry.supplierInvoiceTotal) : null,
});

const PurchaseEntryPage: React.FC<Props> = ({ onSaved, editEntry, draft, onDraftSaved }) => {
  const isEdit = !!editEntry;
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const navigate = useNavigate();
  const [saved] = useState<PurchaseDraft | null>(() => isEdit ? null : parseSavedDraft(draft));
  const savedLines = saved ? restoreLines(saved.lines) : [];
  const [draftId, setDraftId]       = useState<string | null>(() => isEdit ? null : (draft?.id ?? null));
  const [lines, setLines]           = useState<BatchLine[]>(() => isEdit ? linesFromEntry(editEntry) : (savedLines.length ? savedLines : [emptyLine(1)]));
  const [nextId, setNextId]         = useState<number>(() => isEdit ? (editEntry.items || []).length + 1 : Math.max(1, ...savedLines.map(l => l.id)) + 1);
  const [confirmOpen, setConfirm]   = useState(false);
  const [supplierId, setSupplier]   = useState<string | null>(() => isEdit ? (editEntry.supplierId ?? null) : (saved?.supplierId ?? null));
  const [purchaseDate, setDate]     = useState<any>(() => isEdit ? dayjs(editEntry.purchaseDate) : (saved?.purchaseDate ? dayjs(saved.purchaseDate) : dayjs()));
  const [invoiceNo, setInvoiceNo]   = useState(() => isEdit ? (editEntry.invoiceNumber || '') : (saved?.invoiceNo || ''));
  const [adj, setAdj]               = useState<BillAdjustments>(() => isEdit ? adjustmentsFromEntry(editEntry) : (saved?.adj ?? emptyAdjustments()));
  const setAdjField = <K extends keyof BillAdjustments>(k: K, v: BillAdjustments[K]) => setAdj(a => ({ ...a, [k]: v }));
  const [mobileEditId, setMobileEditId] = useState<number | null>(null);
  const [drawerProdSearch, setDrawerProdSearch] = useState('');
  const [prodSearchMap, setProdSearchMap] = useState<Record<number, string>>({});
  const [pendingDraft, setPendingDraft] = useState<PurchaseDraft | null>(() => {
    if (isEdit || draft) return null;
    const d = readDraft();
    return d && draftHasContent(d) ? d : null;
  });

  const { data: prodData,  isLoading: prodLoading } = useGetAllProductsQuery(undefined, { refetchOnMountOrArgChange: true });
  const { data: suppData }                           = useGetSuppliersQuery(undefined, { refetchOnMountOrArgChange: true });
  const [createPurchase, { isLoading: creating }]    = useCreatePurchaseMutation();
  const [updatePurchaseBill, { isLoading: updating }] = useUpdatePurchaseBillMutation();
  const [savePurchaseDraft, { isLoading: savingDraft }] = useSavePurchaseDraftMutation();
  const saving = creating || updating;

  // Lines with units already sold keep their cost; bill discount and freight re-spread cost onto
  // every line, so they lock as soon as anything on the bill has sold.
  const anySold = lines.some(l => (l.soldUnits || 0) > 0);
  const soldTip = (l: BatchLine) => `${l.soldUnits} unit(s) already sold — cost is locked`;

  const products:  any[] = prodData?.data?.content || prodData?.data || [];
  const suppliers: any[] = suppData?.data?.content || suppData?.data || [];

  const fieldRefs = useRef<Record<string, any>>({});
  const setFieldRef = (lineId: number, field: string) => (el: any) => {
    fieldRefs.current[`${lineId}_${field}`] = el;
  };
  const focusField = (lineId: number, field: string) => {
    fieldRefs.current[`${lineId}_${field}`]?.focus();
  };

  const TAB_ORDER = ['qty', 'free', 'mrp', 'totalAmount', 'discount', 'minSale', 'maxSale'] as const;

  const tabNext = (lineId: number, field: typeof TAB_ORDER[number], linesSnap: BatchLine[]) => {
    const fieldIdx = TAB_ORDER.indexOf(field);
    if (fieldIdx < TAB_ORDER.length - 1) {
      focusField(lineId, TAB_ORDER[fieldIdx + 1]);
    } else {
      const rowIdx = linesSnap.findIndex(l => l.id === lineId);
      if (rowIdx < linesSnap.length - 1) {
        const nextLine = linesSnap[rowIdx + 1];
        focusField(nextLine.id, nextLine.productId ? 'qty' : 'prod');
      }
    }
  };

  const tabKey = (
    e: React.KeyboardEvent,
    lineId: number,
    field: typeof TAB_ORDER[number],
    linesSnap: BatchLine[],
  ) => {
    if (e.key !== 'Tab' || e.shiftKey) return;
    e.preventDefault();
    tabNext(lineId, field, linesSnap);
  };

  useEffect(() => {
    if (pendingDraft || isEdit || draftId) return;
    const t = setTimeout(() => {
      if (draftHasContent({ supplierId, invoiceNo, lines })) {
        writeDraft({
          savedAt: new Date().toISOString(),
          supplierId,
          purchaseDate: purchaseDate ? dayjs(purchaseDate).toISOString() : null,
          invoiceNo,
          lines,
          adj,
        });
      } else {
        writeDraft(null);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [pendingDraft, isEdit, draftId, supplierId, purchaseDate, invoiceNo, lines, adj]);

  const resumeDraft = () => {
    if (!pendingDraft) return;
    const restored = restoreLines(pendingDraft.lines);
    // Drafts saved before discount modes existed held line discounts in ₹.
    setAdj(pendingDraft.adj ?? { ...emptyAdjustments(), discMode: 'AMOUNT' });
    setSupplier(pendingDraft.supplierId);
    setDate(pendingDraft.purchaseDate ? dayjs(pendingDraft.purchaseDate) : dayjs());
    setInvoiceNo(pendingDraft.invoiceNo);
    setLines(restored.length ? restored : [emptyLine(1)]);
    setNextId(Math.max(0, ...restored.map(l => l.id)) + 1);
    setPendingDraft(null);
  };

  const discardDraft = () => {
    writeDraft(null);
    setPendingDraft(null);
  };

  const addLine = () => { setLines(p => [...p, emptyLine(nextId)]); setNextId(n => n + 1); };

  const handleMobileAddLine = () => {
    const id = nextId;
    setLines(p => [...p, emptyLine(id)]);
    setNextId(n => n + 1);
    setMobileEditId(id);
    setDrawerProdSearch('');
  };

  const removeLine = (id: number) => {
    if (lines.length === 1) { message.warning('At least one line required'); return; }
    const line = lines.find(l => l.id === id);
    if (line && (line.soldUnits || 0) > 0) {
      message.warning(`${line.soldUnits} unit(s) of this line are already sold — reduce its quantity instead`);
      return;
    }
    setLines(p => p.filter(l => l.id !== id));
  };

  const updateLine = (id: number, field: keyof BatchLine, value: any) => {
    if (field === 'productId' && value) {
      const duplicate = lines.some(l => l.id !== id && l.productId === value);
      if (duplicate) {
        const prod = products.find((p: any) => p.id === value);
        message.warning(`${prod?.name || 'This product'} is already added to this entry`);
        return;
      }
    }
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      const u: BatchLine = { ...l, [field]: value };
      // A sold line's cost is locked: cutting its quantity cuts its bill amount in step.
      if (field === 'qty' && (l.soldUnits || 0) > 0 && (l.qty || 0) > 0 && l.totalAmount) {
        const free = l.freeQty || 0;
        const ratio = ((value || 0) + free) / ((l.qty || 0) + free);
        u.totalAmount = r2(l.totalAmount * ratio);
        if (adj.discMode === 'AMOUNT' && l.discount) u.discount = r2(l.discount * ratio);
      }
      if (field === 'productId') {
        const prod = products.find((p: any) => p.id === value);
        if (prod) {
          u.mrp         = Number(prod.mrp)                || null;
          u.gstPct      = Number(prod.purchaseGstPercent) || 0;
          u.totalAmount = null;
          u.maxSaleRate = null;
          u.minSaleRate = null;
        }
      }
      return u;
    }));
  };

  const bill = useMemo(() => computeBill(lines, adj), [lines, adj]);
  const showBillDisc = bill.totals.billDisc > 0;
  const nCols = showBillDisc ? NCOLS : NCOLS - 1;
  const calc = (l: BatchLine): LineCalc => bill.byId[l.id] ?? EMPTY_CALC;
  const totals = {
    total: bill.totals.gross, netAmt: bill.totals.itemsNet, taxable: bill.totals.taxable,
    cgst: bill.totals.cgst, sgst: bill.totals.sgst,
  };
  const invoiceDiff = adj.invoiceTotal != null ? r2(adj.invoiceTotal - bill.totals.payable) : null;

  const filledLines = lines.filter(l => !!l.productId);

  const validate = (): string | null => {
    if (!supplierId && !(isEdit && editEntry.supplierName)) return 'Select a supplier';
    if (!purchaseDate)            return 'Purchase date is required';
    if (!invoiceNo.trim())        return 'Invoice / Ref No. is required';
    if (filledLines.length === 0) return 'Add at least one product';
    for (const l of filledLines) {
      const prod = products.find((p: any) => p.id === l.productId);
      const name = prod?.name || 'a product';
      const paid = l.qty || 0;
      if (paid + (l.freeQty || 0) < 1) return `Enter Qty (or Free qty) for ${name}`;
      if (!l.mrp || l.mrp <= 0)  return `MRP must be > 0 for ${name}`;
      if (paid > 0 && !l.totalAmount) return `Enter total amount from bill for ${name}`;
      if (paid === 0 && (l.totalAmount || 0) > 0) return `${name} has no paid Qty — enter it under Qty, or clear its amount if it came free`;
      if (adj.discMode === 'PERCENT' && (l.discount || 0) > 100) return `Discount cannot exceed 100% for ${name}`;
      if (adj.discMode === 'AMOUNT' && (l.discount || 0) > (l.totalAmount || 0)) return `Discount cannot exceed the amount for ${name}`;
      if (l.gstPct == null)      return `GST% missing — check product setup for ${name}`;
      if (!l.expiryDate)         return `Expiry date is required for ${name}`;
      if (!l.minSaleRate)        return `Min sale rate is required for ${name}`;
      if (!l.maxSaleRate)        return `Max sale rate is required for ${name}`;
      const { purRate } = calc(l);
      if (l.mrp != null && purRate > 0 && purRate > l.mrp) {
        return `Purchase rate (₹${purRate.toFixed(2)}) cannot exceed MRP (₹${l.mrp.toFixed(2)}) for ${name}`;
      }
      if (l.minSaleRate != null && purRate > 0 && l.minSaleRate <= purRate) {
        return `Min sale rate (₹${l.minSaleRate.toFixed(2)}) must be greater than purchase rate (₹${purRate.toFixed(2)}) for ${name}`;
      }
      if (l.maxSaleRate != null && l.mrp != null && l.maxSaleRate > l.mrp) {
        return `Max sale rate (₹${l.maxSaleRate.toFixed(2)}) cannot exceed MRP (₹${l.mrp.toFixed(2)}) for ${name}`;
      }
      if (l.minSaleRate != null && l.maxSaleRate != null && l.minSaleRate > l.maxSaleRate) {
        return `Min sale rate (₹${l.minSaleRate.toFixed(2)}) cannot exceed Max sale rate (₹${l.maxSaleRate.toFixed(2)}) for ${name}`;
      }
    }
    if (adj.billDiscMode === 'PERCENT' && (adj.billDiscValue || 0) > 100) return 'Bill discount cannot exceed 100%';
    if (adj.cashDiscMode === 'PERCENT' && (adj.cashDiscValue || 0) > 100) return 'Cash discount cannot exceed 100%';
    if (adj.roundOff != null && Math.abs(adj.roundOff) >= 1) return 'Round off must be under ₹1';
    if (bill.totals.payable < 0) return 'The bill total cannot be negative — check the discounts';
    return null;
  };

  const handleSave = () => {
    const e = validate();
    if (e) { message.error(e); return; }
    setConfirm(true);
  };

  const handleSaveDraft = async () => {
    if (!draftHasContent({ supplierId, invoiceNo, lines })) {
      message.warning('Nothing to save yet — select a supplier or add a product');
      return;
    }
    const sup = suppliers.find((s: any) => s.id === supplierId);
    const screen: PurchaseDraft = {
      savedAt: new Date().toISOString(),
      supplierId,
      purchaseDate: purchaseDate ? dayjs(purchaseDate).toISOString() : null,
      invoiceNo,
      lines,
      adj,
    };
    try {
      const res = await savePurchaseDraft({
        id: draftId || undefined,
        body: {
          supplierName:  sup?.name || null,
          invoiceNumber: invoiceNo.trim() || null,
          purchaseDate:  purchaseDate ? dayjs(purchaseDate).format('YYYY-MM-DD') : null,
          lineCount:     filledLines.length,
          totalAmount:   bill.totals.payable,
          payload:       JSON.stringify(screen),
        },
      }).unwrap();
      setDraftId(res?.data?.id ?? draftId);
      writeDraft(null);
      message.success('Draft saved — open it from Drafts to continue');
      onDraftSaved?.();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to save draft');
    }
  };

  const handleConfirm = async () => {
    const sup = suppliers.find((s: any) => s.id === supplierId);
    try {
      const body = {
        supplierId,
        supplierName:  sup?.name || (isEdit ? editEntry.supplierName : ''),
        purchaseDate:  dayjs(purchaseDate).format('YYYY-MM-DD'),
        invoiceNumber: invoiceNo.trim() || null,
        notes:         isEdit ? (editEntry.notes || null) : undefined,
        items: filledLines.map(l => ({
          itemId:          l.itemId,
          productId:       l.productId,
          totalAmount:     l.totalAmount || 0,
          discountPercent: adj.discMode === 'PERCENT' ? (l.discount || 0) : null,
          discountAmount:  adj.discMode === 'AMOUNT' ? (l.discount || 0) : null,
          mrp:             l.mrp,
          mfgDate:         l.mfgDate    ? dayjs(l.mfgDate).format('YYYY-MM-DD')    : null,
          expiryDate:      l.expiryDate ? dayjs(l.expiryDate).format('YYYY-MM-DD') : null,
          quantity:        l.qty || 0,
          freeQty:         l.freeQty || 0,
          minSaleRate:     l.minSaleRate,
          maxSaleRate:     l.maxSaleRate,
        })),
        billDiscountType:     adj.billDiscMode,
        billDiscountValue:    adj.billDiscValue || 0,
        cashDiscountType:     adj.cashDiscMode,
        cashDiscountValue:    adj.cashDiscValue || 0,
        freightAmount:        adj.freight || 0,
        roundOffAmount:       bill.totals.roundOff,
        supplierInvoiceTotal: adj.invoiceTotal,
        draftId:              isEdit ? undefined : (draftId || undefined),
      };
      if (isEdit) {
        await updatePurchaseBill({ id: editEntry.id, body }).unwrap();
        message.success(`${editEntry.entryNumber} updated — stock adjusted`);
      } else {
        await createPurchase(body).unwrap();
        message.success('Purchase entry saved — stock updated!');
        writeDraft(null);
        setPendingDraft(null);
      }
      setConfirm(false);
      if (onSaved) onSaved(); else navigate('/purchases');
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to save');
      setConfirm(false);
    }
  };

  // Mobile drawer — computed values for the line being edited
  const editLine = lines.find(l => l.id === mobileEditId) ?? null;
  const editProd = editLine ? products.find((p: any) => p.id === editLine.productId) : null;
  const { netAmt: eNet, cgstPct: eCgstPct, cgstAmt: eCgstAmt, sgstAmt: eSgstAmt, purRate: ePurRate } =
    editLine ? calc(editLine) : { netAmt: 0, cgstPct: 0, cgstAmt: 0, sgstAmt: 0, purRate: 0 };
  const editPurchRateExceedsMrp = editLine?.mrp != null && ePurRate > 0 && ePurRate > editLine.mrp;
  const editMinRateError  = editLine?.minSaleRate != null && ePurRate > 0 && editLine.minSaleRate <= ePurRate;
  const editMaxRateError  = editLine?.maxSaleRate != null && editLine?.mrp != null && editLine.maxSaleRate > editLine.mrp;
  const editMinAboveMax   = editLine?.minSaleRate != null && editLine?.maxSaleRate != null && editLine.minSaleRate > editLine.maxSaleRate;

  return (
    <div>
      {pendingDraft && (
        <Alert
          type="info" showIcon style={{ marginBottom: 12 }}
          message={`Unsaved purchase from ${dayjs(pendingDraft.savedAt).format('DD MMM YYYY, hh:mm A')}`}
          description={`${pendingDraft.lines.filter(l => !!l.productId).length} product line(s)${pendingDraft.invoiceNo ? ` · Invoice ${pendingDraft.invoiceNo}` : ''}`}
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="small" type="primary" onClick={resumeDraft}>Resume</Button>
              <Button size="small" onClick={discardDraft}>Discard</Button>
            </div>
          }
        />
      )}

      {/* Main card */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header fields */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 160px 1fr', gap: isMobile ? '12px 0' : '0 16px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
              Supplier <span style={{ color: RED }}>*</span>
            </label>
            <Select
              size="middle" showSearch filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
              placeholder={isEdit && editEntry.supplierName ? editEntry.supplierName : 'Select supplier'}
              style={{ width: '100%' }}
              value={supplierId || undefined}
              onChange={setSupplier}
              options={suppliers.map((s: any) => ({ value: s.id, label: s.name }))}
              notFoundContent={
                <div style={{ padding: '8px 0', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
                  No suppliers. <a href="/suppliers" target="_blank" rel="noreferrer">Add one →</a>
                </div>
              }
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
              Date <span style={{ color: RED }}>*</span>
            </label>
            <DatePicker size="middle" style={{ width: '100%' }} value={purchaseDate} onChange={setDate} format="DD MMM YYYY" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
              Invoice / Ref No. <span style={{ color: RED }}>*</span>
            </label>
            <input
              value={invoiceNo}
              onChange={e => setInvoiceNo(e.target.value)}
              placeholder="e.g. INV-2026-0421"
              style={{ width: '100%', height: 32, border: '1px solid #d9d9d9', borderRadius: 6, padding: '0 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#0f172a' }}
              onFocus={e => { e.currentTarget.style.borderColor = GREEN; e.currentTarget.style.boxShadow = `0 0 0 2px ${GREEN}22`; }}
              onBlur={e  => { e.currentTarget.style.borderColor = '#d9d9d9'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
        </div>

        {/* Mobile: Line Cards */}
        {isMobile && (
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lines.map((line, idx) => {
              const prod      = products.find((p: any) => p.id === line.productId);
              const { netAmt } = calc(line);
              const isExpired = line.expiryDate && dayjs(line.expiryDate).isBefore(dayjs());
              return (
                <div
                  key={line.id}
                  onClick={() => setMobileEditId(line.id)}
                  style={{
                    border: `1px solid ${isExpired ? RED : '#e2e8f0'}`,
                    borderRadius: 8,
                    padding: '12px 14px',
                    background: '#fff',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: prod ? '#0f172a' : '#bfbfbf', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {prod?.name || `Item ${idx + 1} — tap to fill`}
                      </div>
                      {prod && (
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
                          <span>{prod.unit}</span>
                          <span>Qty: <strong style={{ color: '#374151' }}>{line.qty ?? '—'}</strong>{line.freeQty ? ` + ${line.freeQty} free` : ''}</span>
                          {line.mrp != null && <span>MRP: ₹{line.mrp}</span>}
                          {line.expiryDate && (
                            <span style={{ color: isExpired ? RED : '#94a3b8' }}>
                              Exp: {dayjs(line.expiryDate).format('MM/YY')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {netAmt > 0 && (
                        <span style={{ fontWeight: 700, fontSize: 14, color: GREEN }}>₹{netAmt.toFixed(2)}</span>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); setMobileEditId(line.id); }}
                        style={{ background: '#f0f9ff', border: 'none', borderRadius: 6, color: '#3b82f6', cursor: 'pointer', padding: '5px 7px', fontSize: 13, lineHeight: 1 }}
                      >
                        <EditOutlined />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); removeLine(line.id); }}
                        style={{ background: '#fff5f5', border: 'none', borderRadius: 6, color: RED, cursor: 'pointer', padding: '5px 7px', fontSize: 13, lineHeight: 1 }}
                      >
                        <DeleteOutlined />
                      </button>
                    </div>
                  </div>
                  {!prod && (
                    <div style={{ marginTop: 8, fontSize: 12, color: GREEN, fontWeight: 600 }}>
                      Tap to select product →
                    </div>
                  )}
                </div>
              );
            })}

            <button
              onClick={handleMobileAddLine}
              style={{
                border: '1.5px dashed #d9d9d9', borderRadius: 8, padding: 14,
                background: 'none', cursor: 'pointer', color: GREEN, fontWeight: 600,
                fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 6, width: '100%',
              }}
            >
              <PlusOutlined /> Add Item
            </button>
          </div>
        )}

        {/* Desktop: Table */}
        {!isMobile && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: showBillDisc ? 1360 : 1360 - COLS[BILL_DISC_COL], width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <ColGroup showBillDisc={showBillDisc} />
              <thead>
                <tr>
                  <TH center>#</TH>
                  <TH>Product</TH>
                  <TH center muted>Unit</TH>
                  <TH right>Qty</TH>
                  <TH right>Free</TH>
                  <TH right>MRP *</TH>
                  <TH center>Expiry</TH>
                  <TH right>Total Amt</TH>
                  <TH right>Disc {adj.discMode === 'PERCENT' ? '%' : '₹'}</TH>
                  {showBillDisc && <TH right muted>Bill Disc</TH>}
                  <TH right muted>Purch. Rate</TH>
                  <TH right muted>CGST%</TH>
                  <TH right muted>CGST ₹</TH>
                  <TH right muted>SGST%</TH>
                  <TH right muted>SGST ₹</TH>
                  <TH right muted>Net Total</TH>
                  <TH right muted>Min Sale *</TH>
                  <TH right muted>Max Sale *</TH>
                  <TH right muted>Stock</TH>
                  <TH center>{''}</TH>
                </tr>
              </thead>

              <tbody>
                {lines.map((line, idx) => {
                  const prod      = products.find((p: any) => p.id === line.productId);
                  const { netAmt, cgstPct, cgstAmt, sgstAmt, purRate, billShare } = calc(line);
                  const isExpired    = line.expiryDate && dayjs(line.expiryDate).isBefore(dayjs());
                  const daysLeft     = line.expiryDate ? dayjs(line.expiryDate).diff(dayjs(), 'day') : null;
                  const isNear       = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
                  const purchRateExceedsMrp = line.mrp != null && purRate > 0 && purRate > line.mrp;
                  const minRateError  = line.minSaleRate != null && purRate > 0 && line.minSaleRate <= purRate;
                  const maxRateError  = line.maxSaleRate != null && line.mrp != null && line.maxSaleRate > line.mrp;
                  const minAboveMax   = line.minSaleRate != null && line.maxSaleRate != null && line.minSaleRate > line.maxSaleRate;

                  return (
                    <React.Fragment key={line.id}>
                      <tr
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f9fbff'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                      >
                        {/* # */}
                        <td style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0', textAlign: 'center', fontSize: 11, color: '#c0c7d1', fontWeight: 700, verticalAlign: 'middle' }}>
                          {idx + 1}
                        </td>

                        {/* Product */}
                        <td style={{ padding: '4px 8px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' }}>
                          <Select
                            ref={setFieldRef(line.id, 'prod')}
                            disabled={!!line.itemId}
                            variant="borderless" size="small" showSearch filterOption={false}
                            onSearch={v => setProdSearchMap(prev => ({ ...prev, [line.id]: v }))}
                            placeholder={<span style={{ color: '#bfbfbf', fontSize: 12 }}>Type to search…</span>}
                            value={line.productId || undefined}
                            loading={prodLoading}
                            onChange={v => {
                              updateLine(line.id, 'productId', v);
                              setProdSearchMap(prev => ({ ...prev, [line.id]: '' }));
                              setTimeout(() => focusField(line.id, 'qty'), 30);
                            }}
                            style={{ width: '100%', fontSize: 12 }}
                            notFoundContent={prodSearchMap[line.id] ? 'No products found' : 'Type to search...'}
                            options={
                              prodSearchMap[line.id]
                                ? products
                                    .filter((p: any) => {
                                      const q = prodSearchMap[line.id].toLowerCase();
                                      return p.name?.toLowerCase().includes(q) ||
                                        p.brand?.toLowerCase().includes(q) ||
                                        p.code?.toLowerCase().includes(q);
                                    })
                                    .map((p: any) => ({ value: p.id, label: p.name, brand: p.brand }))
                                : line.productId
                                    ? products
                                        .filter((p: any) => p.id === line.productId)
                                        .map((p: any) => ({ value: p.id, label: p.name, brand: p.brand }))
                                    : []
                            }
                            optionRender={(opt: any) => (
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 12 }}>{opt.data.label}</div>
                                {opt.data.brand && <div style={{ fontSize: 10, color: '#94a3b8' }}>{opt.data.brand}</div>}
                              </div>
                            )}
                          />
                        </td>

                        {/* Unit */}
                        <C muted center>
                          <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }} title={prod?.unit || ''}>
                            {prod?.unit || '—'}
                          </span>
                        </C>

                        {/* Qty */}
                        <C right>
                          <InputNumber
                            ref={setFieldRef(line.id, 'qty')}
                            variant="borderless" size="small" controls={NO_CONTROLS}
                            style={numStyle} styles={rightInput} precision={0}
                            min={(line.soldUnits || 0) > 0 ? Math.max((line.soldUnits || 0) - (line.freeQty || 0), 0) : 0}
                            value={line.qty ?? undefined}
                            onChange={v => updateLine(line.id, 'qty', v)}
                            onKeyDown={e => tabKey(e, line.id, 'qty', lines)}
                            placeholder="0"
                          />
                        </C>

                        {/* Free qty (scheme) */}
                        <C right>
                          <InputNumber
                            ref={setFieldRef(line.id, 'free')}
                            disabled={(line.soldUnits || 0) > 0}
                            variant="borderless" size="small" controls={NO_CONTROLS}
                            style={numStyle} styles={rightInput} min={0} precision={0}
                            value={line.freeQty || undefined}
                            onChange={v => updateLine(line.id, 'freeQty', v)}
                            onKeyDown={e => tabKey(e, line.id, 'free', lines)}
                            placeholder="0"
                          />
                        </C>

                        {/* MRP */}
                        <C right>
                          <InputNumber
                            ref={setFieldRef(line.id, 'mrp')}
                            variant="borderless" size="small" controls={NO_CONTROLS}
                            style={numStyle} styles={rightInput} min={0.01} precision={2}
                            value={line.mrp || undefined}
                            onChange={v => updateLine(line.id, 'mrp', v)}
                            onKeyDown={e => tabKey(e, line.id, 'mrp', lines)}
                            placeholder="0.00"
                            status={line.productId && (!line.mrp || line.mrp <= 0) ? 'error' : undefined}
                          />
                        </C>

                        {/* Expiry Date */}
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <DatePicker
                              variant="borderless" size="small"
                              style={{ width: '100%', fontSize: 11 }}
                              value={line.expiryDate}
                              onChange={v => updateLine(line.id, 'expiryDate', v)}
                              format="DD MMM YYYY"
                              placeholder="DD MMM YYYY"
                              status={!line.expiryDate ? 'error' : undefined}
                            />
                            {!line.expiryDate && (
                              <WarningOutlined style={{ color: RED, fontSize: 11, flexShrink: 0 }} />
                            )}
                          </div>
                        </td>

                        {/* Total Amount */}
                        <C right>
                          <InputNumber
                            ref={setFieldRef(line.id, 'totalAmount')}
                            disabled={(line.soldUnits || 0) > 0}
                            variant="borderless" size="small" controls={NO_CONTROLS}
                            style={numStyle} styles={rightInput} min={0} precision={2}
                            value={line.totalAmount || undefined}
                            onChange={v => updateLine(line.id, 'totalAmount', v)}
                            onKeyDown={e => tabKey(e, line.id, 'totalAmount', lines)}
                            placeholder={line.productId && !line.qty && line.freeQty ? 'Free' : 'From bill'}
                          />
                        </C>

                        {/* Discount — % or ₹ per the switch under the table */}
                        <C right>
                          <InputNumber
                            ref={setFieldRef(line.id, 'discount')}
                            disabled={(line.soldUnits || 0) > 0}
                            variant="borderless" size="small" controls={NO_CONTROLS}
                            style={numStyle} styles={rightInput} min={0}
                            max={adj.discMode === 'PERCENT' ? 100 : undefined} precision={2}
                            value={line.discount || undefined}
                            onChange={v => updateLine(line.id, 'discount', v)}
                            onKeyDown={e => tabKey(e, line.id, 'discount', lines)}
                            placeholder={adj.discMode === 'PERCENT' ? '0' : '0.00'}
                          />
                        </C>

                        {/* Bill discount share */}
                        {showBillDisc && <C muted right><AutoVal v={billShare > 0 ? billShare : null} /></C>}

                        {/* Purchase Rate — landed cost per unit */}
                        <C muted right>
                          {purRate > 0
                            ? <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{purRate.toFixed(2)}</span>
                            : <span style={{ color: '#d9d9d9', fontSize: 11 }}>—</span>
                          }
                        </C>

                        {/* CGST% */}
                        <C muted right>
                          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                            {line.gstPct != null ? `${cgstPct}%` : '—'}
                          </span>
                        </C>

                        {/* CGST Amt */}
                        <C muted right><AutoVal v={cgstAmt > 0 ? cgstAmt : null} /></C>

                        {/* SGST% */}
                        <C muted right>
                          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                            {line.gstPct != null ? `${cgstPct}%` : '—'}
                          </span>
                        </C>

                        {/* SGST Amt */}
                        <C muted right><AutoVal v={sgstAmt > 0 ? sgstAmt : null} /></C>

                        {/* Net Total */}
                        <C muted right>
                          {netAmt > 0
                            ? <span style={{ fontSize: 13, fontWeight: 800, color: GREEN }}>{netAmt.toFixed(2)}</span>
                            : <span style={{ color: '#d9d9d9', fontSize: 11 }}>—</span>
                          }
                        </C>

                        {/* Min Sale Rate */}
                        <C muted right>
                          <InputNumber
                            ref={setFieldRef(line.id, 'minSale')}
                            variant="borderless" size="small" controls={NO_CONTROLS}
                            style={numStyle} styles={rightInput} min={0} precision={2}
                            value={line.minSaleRate || undefined}
                            onChange={v => updateLine(line.id, 'minSaleRate', v)}
                            onKeyDown={e => tabKey(e, line.id, 'minSale', lines)}
                            placeholder={purRate > 0 ? purRate.toFixed(2) : '0.00'}
                            status={minRateError || minAboveMax ? 'error' : undefined}
                          />
                          {minRateError && (
                            <div style={{ fontSize: 9, color: RED, lineHeight: 1.2, marginTop: 2 }}>
                              &gt; ₹{purRate.toFixed(2)}
                            </div>
                          )}
                          {minAboveMax && !minRateError && (
                            <div style={{ fontSize: 9, color: RED, lineHeight: 1.2, marginTop: 2 }}>
                              &lt; Max ₹{line.maxSaleRate?.toFixed(2)}
                            </div>
                          )}
                        </C>

                        {/* Max Sale Rate */}
                        <C muted right>
                          <InputNumber
                            ref={setFieldRef(line.id, 'maxSale')}
                            variant="borderless" size="small" controls={NO_CONTROLS}
                            style={numStyle} styles={rightInput} min={0} precision={2}
                            value={line.maxSaleRate || undefined}
                            onChange={v => updateLine(line.id, 'maxSaleRate', v)}
                            onKeyDown={e => tabKey(e, line.id, 'maxSale', lines)}
                            placeholder={line.mrp ? String(line.mrp) : '0.00'}
                            status={maxRateError ? 'error' : undefined}
                          />
                          {maxRateError && (
                            <div style={{ fontSize: 9, color: RED, lineHeight: 1.2, marginTop: 2 }}>
                              ≤ MRP ₹{line.mrp?.toFixed(2)}
                            </div>
                          )}
                        </C>

                        {/* Stock */}
                        <C muted right>
                          <span style={{ fontSize: 11, color: prod?.stockQuantity > 0 ? '#374151' : RED, fontWeight: 600 }}>
                            {prod ? prod.stockQuantity ?? 0 : '—'}
                          </span>
                        </C>

                        {/* Delete */}
                        <td style={{ padding: '4px 2px', borderBottom: '1px solid #f0f0f0', textAlign: 'center', verticalAlign: 'middle' }}>
                          <button
                            onClick={() => removeLine(line.id)}
                            style={{ background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer', padding: 5, borderRadius: 4, fontSize: 13, lineHeight: 1, transition: 'color 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = RED; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#e2e8f0'; }}
                          >
                            <DeleteOutlined />
                          </button>
                        </td>
                      </tr>

                      {/* Purchase rate > MRP warning */}
                      {purchRateExceedsMrp && (
                        <tr>
                          <td colSpan={nCols} style={{ padding: '2px 8px 6px 48px', borderBottom: '1px solid #f0f0f0', background: '#fff5f5' }}>
                            <span style={{ fontSize: 10, color: RED, fontWeight: 600 }}>
                              Purchase rate (₹{purRate.toFixed(2)}) exceeds MRP (₹{line.mrp!.toFixed(2)}) — cannot save
                            </span>
                          </td>
                        </tr>
                      )}
                      {/* Sold units — cost locked */}
                      {(line.soldUnits || 0) > 0 && (
                        <tr>
                          <td colSpan={nCols} style={{ padding: '2px 8px 6px 48px', borderBottom: '1px solid #f0f0f0', background: '#f8fafc' }}>
                            <span style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>
                              {soldTip(line)} — amount, discount and free qty can't change; quantity can only be reduced
                              (down to {Math.max((line.soldUnits || 0) - (line.freeQty || 0), 0)})
                            </span>
                          </td>
                        </tr>
                      )}
                      {/* Expiry hint */}
                      {(isExpired || isNear) && (
                        <tr>
                          <td colSpan={nCols} style={{ padding: '2px 8px 6px 48px', borderBottom: '1px solid #f0f0f0', background: isExpired ? '#fff5f5' : '#fffbf0' }}>
                            <span style={{ fontSize: 10, color: isExpired ? RED : AMBER, fontWeight: 600 }}>
                              {isExpired ? 'Expiry date is in the past — verify before adding to stock' : `Near expiry — ${daysLeft} days remaining`}
                            </span>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Add line */}
                <tr>
                  <td colSpan={nCols} style={{ padding: '8px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <button
                        onClick={addLine}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, padding: '3px 0' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.7'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                      >
                        <PlusOutlined /> Add Line
                      </button>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b' }}>
                        Line discount entered as
                        <Segmented
                          size="small" value={adj.discMode}
                          onChange={v => setAdjField('discMode', v as DiscMode)}
                          options={[{ label: '%', value: 'PERCENT' }, { label: '₹', value: 'AMOUNT' }]}
                        />
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>

              {/* Totals footer — inside same table so columns align */}
              <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 2 }}>
                <tr style={{ background: '#f0f4f8', borderTop: '2px solid #e2e8f0' }}>
                  {/* cols 1-7: # Product Unit Qty Free MRP Expiry */}
                  <td colSpan={7} style={{ padding: '10px 14px', fontSize: 11, color: '#8c8c8c', fontWeight: 600, borderTop: '2px solid #e2e8f0' }}>
                    Totals — {filledLines.length} line{filledLines.length !== 1 ? 's' : ''}
                  </td>
                  {/* col 8: Total Amt */}
                  <td style={{ padding: '10px 8px', textAlign: 'right', borderTop: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 9, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.4 }}>Bill Total</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>₹{totals.total.toFixed(2)}</div>
                  </td>
                  {/* col 9: Discount */}
                  <td style={{ padding: '10px 8px', textAlign: 'right', borderTop: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 9, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.4 }}>Disc</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>₹{bill.totals.itemDisc.toFixed(2)}</div>
                  </td>
                  {/* col 10: Bill Disc */}
                  {showBillDisc && (
                    <td style={{ padding: '10px 8px', textAlign: 'right', borderTop: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 9, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.4 }}>Bill Disc</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>₹{bill.totals.billDisc.toFixed(2)}</div>
                    </td>
                  )}
                  {/* cols 11-12: PurchRate CGST% */}
                  <td colSpan={2} style={{ borderTop: '2px solid #e2e8f0' }} />
                  {/* col 11: CGST ₹ */}
                  <td style={{ padding: '10px 8px', textAlign: 'right', borderTop: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 9, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.4 }}>CGST</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>₹{totals.cgst.toFixed(2)}</div>
                  </td>
                  {/* col 12: SGST% */}
                  <td style={{ borderTop: '2px solid #e2e8f0' }} />
                  {/* col 13: SGST ₹ */}
                  <td style={{ padding: '10px 8px', textAlign: 'right', borderTop: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 9, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.4 }}>SGST</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>₹{totals.sgst.toFixed(2)}</div>
                  </td>
                  {/* col 14: Net Total */}
                  <td style={{ padding: '10px 8px', textAlign: 'right', borderTop: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 9, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.4 }}>Net Total</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', letterSpacing: -0.5 }}>₹{totals.netAmt.toFixed(2)}</div>
                  </td>
                  {/* cols 15-18: MinSale MaxSale Stock Del */}
                  <td colSpan={4} style={{ borderTop: '2px solid #e2e8f0' }} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Bill adjustments + summary */}
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.2fr) minmax(0, 1fr)',
        gap: 14, margin: '12px 0', alignItems: 'start',
      }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', background: '#fff' }}>
          <div style={labelStyle}>Bill adjustments (as on the supplier's invoice)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
            {([
              {
                key: 'bill', label: 'Bill discount', hint: 'Before GST · spread over items · lowers cost',
                mode: adj.billDiscMode, value: adj.billDiscValue, amount: -bill.totals.billDisc, locked: anySold,
                onMode: (m: DiscMode) => setAdjField('billDiscMode', m), onValue: (v: number | null) => setAdjField('billDiscValue', v),
              },
              {
                key: 'cash', label: 'Cash discount', hint: 'After GST · cost unchanged · shows as Discount Received',
                mode: adj.cashDiscMode, value: adj.cashDiscValue, amount: -bill.totals.cashDisc, locked: false,
                onMode: (m: DiscMode) => setAdjField('cashDiscMode', m), onValue: (v: number | null) => setAdjField('cashDiscValue', v),
              },
            ]).map(row => (
              <div key={row.key} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '130px 110px 74px minmax(0, 1fr) 96px', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{row.label}</span>
                <InputNumber
                  size="small" min={0} max={row.mode === 'PERCENT' ? 100 : undefined} precision={2}
                  style={{ width: '100%' }} styles={rightInput} controls={NO_CONTROLS} disabled={row.locked}
                  value={row.value ?? undefined} onChange={v => row.onValue(v)} placeholder="0"
                />
                <Segmented
                  size="small" value={row.mode} onChange={v => row.onMode(v as DiscMode)} disabled={row.locked}
                  options={[{ label: '%', value: 'PERCENT' }, { label: '₹', value: 'AMOUNT' }]}
                />
                {!isMobile && (
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    {row.locked ? 'Locked — units on this bill are already sold' : row.hint}
                  </span>
                )}
                <span style={{ textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                  {row.amount ? `−${fmtINR(-row.amount)}` : '—'}
                </span>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '130px 110px 74px minmax(0, 1fr) 96px', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>Freight / charges</span>
              <InputNumber
                size="small" min={0} precision={2} prefix="₹" style={{ width: '100%' }} styles={rightInput} controls={NO_CONTROLS}
                value={adj.freight ?? undefined} onChange={v => setAdjField('freight', v)} placeholder="0.00" disabled={anySold}
              />
              {!isMobile && <span />}
              {!isMobile && (
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  {anySold ? 'Locked — units on this bill are already sold' : 'Added to item cost (landed cost)'}
                </span>
              )}
              <span style={{ textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                {bill.totals.freight ? `+${fmtINR(bill.totals.freight)}` : '—'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '130px 110px 74px minmax(0, 1fr) 96px', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>Round off</span>
              <InputNumber
                size="small" min={-0.99} max={0.99} precision={2} style={{ width: '100%' }} styles={rightInput} controls={NO_CONTROLS}
                value={adj.roundOff ?? undefined} onChange={v => setAdjField('roundOff', v)}
                placeholder={`Auto ${bill.totals.autoRound.toFixed(2)}`}
              />
              {!isMobile && <span />}
              {!isMobile && <span style={{ fontSize: 12, color: '#64748b' }}>Auto to the nearest rupee — type 0 if the bill isn't rounded</span>}
              <span style={{ textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                {bill.totals.roundOff ? `${bill.totals.roundOff > 0 ? '+' : '−'}${fmtINR(Math.abs(bill.totals.roundOff))}` : '—'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', background: '#f8fafc' }}>
          <div style={labelStyle}>Summary</div>
          {([
            ['Gross (bill line amounts)', `₹${fmtINR(bill.totals.gross)}`],
            ['Item discounts', bill.totals.itemDisc ? `−₹${fmtINR(bill.totals.itemDisc)}` : '—'],
            ['Bill discount (before GST)', bill.totals.billDisc ? `−₹${fmtINR(bill.totals.billDisc)}` : '—'],
            ['Taxable value', `₹${fmtINR(bill.totals.taxable)}`],
            ['CGST', `₹${fmtINR(bill.totals.cgst)}`],
            ['SGST', `₹${fmtINR(bill.totals.sgst)}`],
            ['Freight / charges', bill.totals.freight ? `+₹${fmtINR(bill.totals.freight)}` : '—'],
            ['Cash discount (after GST)', bill.totals.cashDisc ? `−₹${fmtINR(bill.totals.cashDisc)}` : '—'],
            ['Round off', bill.totals.roundOff ? `${bill.totals.roundOff > 0 ? '+' : '−'}₹${fmtINR(Math.abs(bill.totals.roundOff))}` : '—'],
          ] as [string, string][]).map(([label, value], i) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', padding: '4px 0',
              borderTop: i === 3 ? '1px dashed #e2e8f0' : undefined, marginTop: i === 3 ? 4 : 0, paddingTop: i === 3 ? 8 : 4,
            }}>
              <span>{label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: '#0f172a', borderTop: '1px solid #d9dde3', marginTop: 6, paddingTop: 10 }}>
            <span>Net payable to supplier</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>₹{fmtINR(bill.totals.payable)}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px', gap: 8, alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>Invoice total as per supplier bill</span>
            <InputNumber
              size="small" min={0} precision={2} prefix="₹" style={{ width: '100%' }} styles={rightInput} controls={NO_CONTROLS}
              value={adj.invoiceTotal ?? undefined} onChange={v => setAdjField('invoiceTotal', v)} placeholder="Optional"
            />
          </div>
          {invoiceDiff != null && (
            Math.abs(invoiceDiff) < 0.01 ? (
              <div style={{ marginTop: 8, fontSize: 12.5, color: GREEN, fontWeight: 600 }}>✓ Matches the supplier's bill</div>
            ) : (
              <div style={{ marginTop: 8, fontSize: 12.5, color: AMBER, fontWeight: 600 }}>
                Differs from the supplier's bill by ₹{fmtINR(Math.abs(invoiceDiff))} — check discounts, freight and round off
              </div>
            )
          )}
        </div>
      </div>

      {/* Save bar */}
      <div style={{ borderTop: '1px solid #e8e8e8', padding: '10px 20px', background: MUTED, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: '#8c8c8c' }}>
          {isEdit
            ? (anySold ? 'Lines with sold units keep their cost — only their quantity can be reduced' : 'Stock is adjusted by the difference on update')
            : 'Batch numbers auto-assigned on save'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isEdit && (
            <Button size="middle" onClick={handleSaveDraft} loading={savingDraft} style={{ borderRadius: 6 }}>
              {draftId ? 'Update Draft' : 'Save as Draft'}
            </Button>
          )}
          <Button
            type="primary" icon={<SaveOutlined />} size="middle" onClick={handleSave}
            style={{ background: GREEN, borderColor: GREEN, fontWeight: 700, borderRadius: 6 }}
          >
            {isEdit ? 'Update Entry' : 'Save Entry'}
          </Button>
        </div>
      </div>

      {/* Confirm modal */}
      <Modal
        title={<span style={{ fontWeight: 700 }}>{isEdit ? `Update ${editEntry.entryNumber}` : 'Confirm Purchase Entry'}</span>}
        open={confirmOpen}
        onOk={handleConfirm}
        onCancel={() => setConfirm(false)}
        confirmLoading={saving}
        okText={isEdit ? 'Update & Adjust Stock' : 'Save & Add to Stock'}
        okButtonProps={{ style: { background: GREEN, borderColor: GREEN, fontWeight: 700 } }}
        width={540}
      >
        <div style={{ paddingBlock: 8 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <InboxOutlined style={{ color: GREEN, fontSize: 22 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {isEdit
                  ? `${filledLines.length} line${filledLines.length !== 1 ? 's' : ''} — stock will be adjusted by the difference`
                  : `${filledLines.length} batch${filledLines.length !== 1 ? 'es' : ''} will be added to stock`}
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                Payable: <strong>₹{fmtINR(bill.totals.payable)}</strong> · CGST: <strong>₹{totals.cgst.toFixed(2)}</strong> · SGST: <strong>₹{totals.sgst.toFixed(2)}</strong>
              </div>
            </div>
          </div>
          {invoiceDiff != null && Math.abs(invoiceDiff) >= 0.01 && (
            <Alert
              type="warning" showIcon style={{ marginBottom: 12 }}
              message={`Payable ₹${fmtINR(bill.totals.payable)} differs from the supplier's bill ₹${fmtINR(adj.invoiceTotal || 0)} by ₹${fmtINR(Math.abs(invoiceDiff))}`}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filledLines.map(l => {
              const p = products.find((x: any) => x.id === l.productId);
              const { netAmt } = calc(l);
              return (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', background: '#f8fafc', borderRadius: 7, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{p?.name || '—'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#64748b' }}>
                      {l.qty || 0}{l.freeQty ? ` + ${l.freeQty} free` : ''} {p?.unit || 'units'}
                    </span>
                    {l.expiryDate && <span style={{ fontSize: 11, color: '#94a3b8' }}>exp {dayjs(l.expiryDate).format('MM/YY')}</span>}
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>₹{netAmt.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Mobile: Line Edit Drawer */}
      <Drawer
        open={isMobile && mobileEditId !== null}
        onClose={() => { setMobileEditId(null); setDrawerProdSearch(''); }}
        placement="bottom"
        height="92dvh"
        getContainer={document.body}
        title={
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
            {editProd?.name || 'Add Item'}
          </div>
        }
        styles={{
          wrapper: { width: '100%' },
          body: {
            padding: '12px 16px',
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch' as any,
          },
          footer: { padding: '10px 16px' },
        }}
        footer={
          <Button
            type="primary" size="large" block
            style={{ background: GREEN, borderColor: GREEN, fontWeight: 700 }}
            onClick={() => { setMobileEditId(null); setDrawerProdSearch(''); }}
          >
            Done
          </Button>
        }
      >
        {editLine && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Product */}
            <div>
              <label style={labelStyle}>Product <span style={{ color: RED }}>*</span></label>
              <Select
                showSearch
                filterOption={false}
                onSearch={v => setDrawerProdSearch(v)}
                placeholder="Type to search product..."
                value={editLine.productId || undefined}
                loading={prodLoading}
                disabled={!!editLine.itemId}
                onChange={v => { updateLine(editLine.id, 'productId', v); setDrawerProdSearch(''); }}
                style={{ width: '100%' }}
                size="large"
                getPopupContainer={() => document.body}
                notFoundContent={drawerProdSearch ? 'No products found' : 'Type to search...'}
                options={
                  drawerProdSearch
                    ? products
                        .filter((p: any) =>
                          p.name?.toLowerCase().includes(drawerProdSearch.toLowerCase()) ||
                          p.brand?.toLowerCase().includes(drawerProdSearch.toLowerCase()) ||
                          p.code?.toLowerCase().includes(drawerProdSearch.toLowerCase())
                        )
                        .map((p: any) => ({ value: p.id, label: p.name, brand: p.brand }))
                    : editLine.productId
                        ? products
                            .filter((p: any) => p.id === editLine.productId)
                            .map((p: any) => ({ value: p.id, label: p.name, brand: p.brand }))
                        : []
                }
                optionRender={(opt: any) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{opt.data.label}</div>
                    {opt.data.brand && <div style={{ fontSize: 11, color: '#94a3b8' }}>{opt.data.brand}</div>}
                  </div>
                )}
              />
            </div>

            {/* Qty + Free + MRP */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Qty <span style={{ color: RED }}>*</span></label>
                <InputNumber
                  size="large" style={{ width: '100%' }} min={0} precision={0}
                  value={editLine.qty ?? undefined}
                  onChange={v => updateLine(editLine.id, 'qty', v)}
                  placeholder="0"
                />
              </div>
              <div>
                <label style={labelStyle}>Free</label>
                <InputNumber
                  size="large" style={{ width: '100%' }} min={0} precision={0}
                  value={editLine.freeQty || undefined}
                  disabled={(editLine.soldUnits || 0) > 0}
                  onChange={v => updateLine(editLine.id, 'freeQty', v)}
                  placeholder="0"
                />
              </div>
              <div>
                <label style={labelStyle}>MRP <span style={{ color: RED }}>*</span></label>
                <InputNumber
                  size="large" style={{ width: '100%' }} min={0.01} precision={2}
                  value={editLine.mrp || undefined}
                  onChange={v => updateLine(editLine.id, 'mrp', v)}
                  placeholder="0.00" prefix="₹"
                  status={editPurchRateExceedsMrp ? 'error' : undefined}
                />
                {editPurchRateExceedsMrp && (
                  <div style={{ fontSize: 11, color: RED, marginTop: 4 }}>
                    Purchase rate ₹{ePurRate.toFixed(2)} exceeds MRP — cannot save
                  </div>
                )}
              </div>
            </div>

            {/* Expiry */}
            <div>
              <label style={labelStyle}>Expiry Date <span style={{ color: RED }}>*</span></label>
              <DatePicker
                size="large" style={{ width: '100%' }}
                value={editLine.expiryDate}
                onChange={v => updateLine(editLine.id, 'expiryDate', v)}
                format="DD MMM YYYY"
                placeholder="DD MMM YYYY"
                status={!editLine.expiryDate ? 'error' : undefined}
              />
            </div>

            {/* Total Amount + Discount */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Total Amt (bill) <span style={{ color: RED }}>*</span></label>
                <InputNumber
                  size="large" style={{ width: '100%' }} min={0} precision={2}
                  value={editLine.totalAmount || undefined}
                  disabled={(editLine.soldUnits || 0) > 0}
                  onChange={v => updateLine(editLine.id, 'totalAmount', v)}
                  placeholder={!editLine.qty && editLine.freeQty ? 'Free' : 'From bill'} prefix="₹"
                />
              </div>
              <div>
                <label style={labelStyle}>Discount {adj.discMode === 'PERCENT' ? '%' : '₹'}</label>
                <InputNumber
                  size="large" style={{ width: '100%' }} min={0}
                  max={adj.discMode === 'PERCENT' ? 100 : undefined} precision={2}
                  value={editLine.discount || undefined}
                  disabled={(editLine.soldUnits || 0) > 0}
                  onChange={v => updateLine(editLine.id, 'discount', v)}
                  placeholder="0" prefix={adj.discMode === 'PERCENT' ? undefined : '₹'}
                  suffix={adj.discMode === 'PERCENT' ? '%' : undefined}
                />
              </div>
            </div>

            {/* Min Sale + Max Sale */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Min Sale Rate <span style={{ color: RED }}>*</span></label>
                <InputNumber
                  size="large" style={{ width: '100%' }} min={0} precision={2}
                  value={editLine.minSaleRate || undefined}
                  onChange={v => updateLine(editLine.id, 'minSaleRate', v)}
                  placeholder={ePurRate > 0 ? ePurRate.toFixed(2) : '0.00'}
                  prefix="₹"
                  status={editMinRateError || editMinAboveMax ? 'error' : undefined}
                />
                {editMinRateError && (
                  <div style={{ fontSize: 11, color: RED, marginTop: 4 }}>
                    Must be &gt; ₹{ePurRate.toFixed(2)}
                  </div>
                )}
                {editMinAboveMax && !editMinRateError && (
                  <div style={{ fontSize: 11, color: RED, marginTop: 4 }}>
                    Cannot exceed Max ₹{editLine?.maxSaleRate?.toFixed(2)}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Max Sale Rate <span style={{ color: RED }}>*</span></label>
                <InputNumber
                  size="large" style={{ width: '100%' }} min={0} precision={2}
                  value={editLine.maxSaleRate || undefined}
                  onChange={v => updateLine(editLine.id, 'maxSaleRate', v)}
                  placeholder={editLine.mrp ? String(editLine.mrp) : '0.00'}
                  prefix="₹"
                  status={editMaxRateError ? 'error' : undefined}
                />
                {editMaxRateError && (
                  <div style={{ fontSize: 11, color: RED, marginTop: 4 }}>
                    Cannot exceed MRP ₹{editLine.mrp?.toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            {/* Computed summary */}
            {eNet > 0 && (
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px 16px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.4 }}>Purch. Rate</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginTop: 2 }}>
                      {ePurRate > 0 ? `₹${ePurRate.toFixed(2)}` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.4 }}>CGST {eCgstPct}%</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginTop: 2 }}>
                      {eCgstAmt > 0 ? `₹${eCgstAmt.toFixed(2)}` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.4 }}>SGST {eCgstPct}%</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginTop: 2 }}>
                      {eSgstAmt > 0 ? `₹${eSgstAmt.toFixed(2)}` : '—'}
                    </div>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                  <div style={{ fontSize: 10, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.4 }}>Net Total</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: GREEN, marginTop: 2 }}>₹{eNet.toFixed(2)}</div>
                </div>
              </div>
            )}

          </div>
        )}
      </Drawer>
    </div>
  );
};

export default PurchaseEntryPage;
