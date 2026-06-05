import React, { useState, useRef, useEffect } from 'react';
import { Tabs, Upload, Button, Alert, Steps, Grid, message } from 'antd';
import {
  DownloadOutlined, UploadOutlined, CheckCircleOutlined,
  CloseCircleOutlined, MinusCircleOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import PageHeader from '../../components/PageHeader';
import {
  useImportProductsMutation,
  useImportCustomersMutation,
  useImportSuppliersMutation,
} from '../../store/api/importApi';

const { Dragger } = Upload;
const { useBreakpoint } = Grid;

interface ImportResult {
  totalRows: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: { row: number; message: string }[];
}

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/v1`;

const downloadTemplate = (type: string) => {
  const token = localStorage.getItem('token');
  const tenantId = JSON.parse(localStorage.getItem('user') || '{}').tenantId;
  fetch(`${API_BASE}/import/template/${type}`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId },
  })
    .then(r => r.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    });
};

const stripRowPrefix = (msg: string) => msg.replace(/^Row\s+\d+:\s*/i, '');

const ResultPanel: React.FC<{ result: ImportResult }> = ({ result }) => {
  const screens = useBreakpoint();
  const isMobile = !screens.sm;

  const grouped = result.errors.reduce((acc, e) => {
    if (!acc[e.row]) acc[e.row] = [];
    acc[e.row].push(e.message);
    return acc;
  }, {} as Record<number, string[]>);
  const groupedRows = Object.keys(grouped).map(Number).sort((a, b) => a - b).map(row => ({ row, messages: grouped[row] }));

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: isMobile ? '4px 8px' : '4px 12px' }}>
          <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 13 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>{result.imported} Imported</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: isMobile ? '4px 8px' : '4px 12px' }}>
          <MinusCircleOutlined style={{ color: '#d97706', fontSize: 13 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#b45309' }}>{result.skipped} Skipped</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: isMobile ? '4px 8px' : '4px 12px' }}>
          <CloseCircleOutlined style={{ color: '#dc2626', fontSize: 13 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#b91c1c' }}>{result.failed} Failed</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: isMobile ? '4px 8px' : '4px 12px' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>{result.totalRows} Total</span>
        </div>
      </div>

      {groupedRows.length > 0 && (
        <div style={{ border: '1px solid #fecaca', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: '#fef2f2', padding: '8px 12px', borderBottom: '1px solid #fecaca', fontSize: 12, fontWeight: 600, color: '#991b1b' }}>
            {result.failed > 0 && result.skipped > 0
              ? `${result.failed} failed · ${result.skipped} skipped — fix and re-upload`
              : result.failed > 0
              ? `${result.failed} row${result.failed > 1 ? 's' : ''} failed — fix and re-upload`
              : `${result.skipped} row${result.skipped > 1 ? 's' : ''} skipped (duplicates)`}
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {groupedRows.map((group, gi) => (
              <div key={group.row} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', borderBottom: gi < groupedRows.length - 1 ? '1px solid #fee2e2' : undefined, background: '#fff' }}>
                <span style={{ flexShrink: 0, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, fontSize: 11, fontWeight: 700, color: '#b91c1c', padding: '1px 6px', marginTop: 2 }}>
                  R{group.row}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {group.messages.map((msg, mi) => (
                    <div key={mi} style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                      <span style={{ color: '#b91c1c', fontSize: 12, lineHeight: 1.5, flexShrink: 0 }}>•</span>
                      <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{stripRowPrefix(msg)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface TabPanelProps {
  label: string;
  templateKey: string;
  steps: string[];
  uploadLabel: string;
  hint?: string;
  onUpload: (file: File) => Promise<ImportResult | null>;
}

const ImportTab: React.FC<TabPanelProps> = ({ label, templateKey, steps, uploadLabel, hint, onUpload }) => {
  const screens = useBreakpoint();
  const isMobile = !screens.sm;

  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [result]);

  const handleUpload = async () => {
    if (!fileList.length) { message.warning('Select a file first'); return; }
    setLoading(true);
    const file = fileList[0].originFileObj ?? (fileList[0] as unknown as File);
    const res = await onUpload(file);
    setLoading(false);
    if (res) {
      setResult(res);
      setFileList([]);
      if (res.totalRows === 0) message.warning('The given excel file is empty — please fill the required columns and re-upload');
      else if (res.imported === 0 && res.failed === 0) message.warning(`No ${label.toLowerCase()} imported — all rows were duplicates and skipped`);
      else if (res.failed === 0) message.success(`${res.imported} ${label.toLowerCase()} imported successfully`);
      else message.warning(`${res.imported} imported, ${res.failed} failed`);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <Steps
        size="small"
        direction={isMobile ? 'vertical' : 'horizontal'}
        style={{ marginBottom: 20 }}
        items={steps.map((s, i) => ({
          title: s,
          status: 'process' as const,
          icon: <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{i + 1}</span>,
        }))}
      />

      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: isMobile ? '12px' : '14px 18px', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>Step 1 — Download Template</div>
        <Button
          icon={<DownloadOutlined />}
          onClick={() => downloadTemplate(templateKey)}
          style={{ width: isMobile ? '100%' : undefined }}
        >
          {isMobile ? `Download Template` : `Download ${label} Template (.xlsx)`}
        </Button>
        {hint && <div style={{ marginTop: 8, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{hint}</div>}
      </div>

      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: isMobile ? '12px' : '14px 18px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>Step 2 — Fill &amp; Upload</div>
        <Dragger
          accept=".xlsx,.xls"
          maxCount={1}
          fileList={fileList}
          beforeUpload={file => { setFileList([file]); return false; }}
          onRemove={() => setFileList([])}
        >
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
            <UploadOutlined /> {isMobile ? 'Tap to select Excel file' : 'Click or drag your filled Excel file here'}
          </p>
        </Dragger>
        <Button
          type="primary"
          loading={loading}
          disabled={!fileList.length}
          onClick={handleUpload}
          style={{
            marginTop: 10,
            width: isMobile ? '100%' : undefined,
            background: '#10b981',
            borderColor: '#10b981',
            color: '#ffffff',
          }}
        >
          {uploadLabel}
        </Button>
      </div>

      {result && <div ref={resultRef}><ResultPanel result={result} /></div>}
    </div>
  );
};

const ImportPage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.sm;

  const [importProducts] = useImportProductsMutation();
  const [importCustomers] = useImportCustomersMutation();
  const [importSuppliers] = useImportSuppliersMutation();

  const upload = (mutation: any) => async (file: File): Promise<ImportResult | null> => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await mutation(formData).unwrap();
      return res.data;
    } catch (err: any) {
      const msg = err?.data?.message || err?.data?.error || err?.message || 'Import failed — check the file format';
      message.error(msg);
      return null;
    }
  };

  return (
    <div>
      <PageHeader
        title="Data Import"
        subtitle="Onboard your existing data — products, customers and suppliers"
      />
      <div style={{ padding: isMobile ? '0 12px 16px' : '0 24px 24px' }}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Import Order"
          description="Import in this order: (1) Products → (2) Customers → (3) Suppliers. Routes and stops are auto-created. Duplicates are skipped automatically."
        />
        <Tabs
          items={[
            {
              key: 'products',
              label: 'Products',
              children: (
                <ImportTab
                  label="Products"
                  templateKey="products"
                  steps={['Download template', 'Fill product list', 'Upload']}
                  uploadLabel="Import Products"
                  onUpload={upload(importProducts)}
                />
              ),
            },
            {
              key: 'customers',
              label: 'Customers',
              children: (
                <ImportTab
                  label="Customers"
                  templateKey="customers"
                  steps={['Download template', 'Fill customer list', 'Upload']}
                  uploadLabel="Import Customers"
                  hint="Opening Balance — enter the amount the customer already owed in your old system. Leave blank if nothing is outstanding."
                  onUpload={upload(importCustomers)}
                />
              ),
            },
            {
              key: 'suppliers',
              label: 'Suppliers',
              children: (
                <ImportTab
                  label="Suppliers"
                  templateKey="suppliers"
                  steps={['Download template', 'Fill supplier details', 'Upload']}
                  uploadLabel="Import Suppliers"
                  onUpload={upload(importSuppliers)}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
};

export default ImportPage;
