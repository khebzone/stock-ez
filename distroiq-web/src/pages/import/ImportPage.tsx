import React, { useState } from 'react';
import { Tabs, Upload, Button, Table, Alert, Tag, message, Steps } from 'antd';
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

interface ImportResult {
  totalRows: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: { row: number; message: string }[];
}

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1';

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

const ResultPanel: React.FC<{ result: ImportResult }> = ({ result }) => (
  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <Tag icon={<CheckCircleOutlined />} color="success">{result.imported} Imported</Tag>
      <Tag icon={<MinusCircleOutlined />} color="warning">{result.skipped} Skipped</Tag>
      <Tag icon={<CloseCircleOutlined />} color="error">{result.failed} Failed</Tag>
      <Tag color="default">{result.totalRows} Total Rows</Tag>
    </div>
    {result.errors.length > 0 && (
      <Table
        dataSource={result.errors.map((e, i) => ({ ...e, key: i }))}
        columns={[
          { title: 'Row', dataIndex: 'row', width: 70 },
          { title: 'Message', dataIndex: 'message' },
        ]}
        size="small"
        pagination={false}
        scroll={{ y: 240 }}
      />
    )}
  </div>
);

interface TabPanelProps {
  label: string;
  templateKey: string;
  steps: string[];
  uploadLabel: string;
  onUpload: (file: File) => Promise<ImportResult | null>;
}

const ImportTab: React.FC<TabPanelProps> = ({ label, templateKey, steps, uploadLabel, onUpload }) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!fileList.length) { message.warning('Select a file first'); return; }
    setLoading(true);
    const res = await onUpload(fileList[0].originFileObj as File);
    setLoading(false);
    if (res) {
      setResult(res);
      setFileList([]);
      if (res.failed === 0) message.success(`${res.imported} ${label.toLowerCase()} imported successfully`);
      else message.warning(`${res.imported} imported, ${res.failed} failed`);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <Steps
        size="small"
        style={{ marginBottom: 20 }}
        items={steps.map((s, i) => ({ title: s, status: 'process' as const, icon: <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{i + 1}</span> }))}
      />

      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>Step 1 — Download Template</div>
        <Button icon={<DownloadOutlined />} onClick={() => downloadTemplate(templateKey)}>
          Download {label} Template (.xlsx)
        </Button>
      </div>

      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 18px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>Step 2 — Fill & Upload</div>
        <Dragger
          accept=".xlsx,.xls"
          maxCount={1}
          fileList={fileList}
          beforeUpload={file => { setFileList([file]); return false; }}
          onRemove={() => setFileList([])}
        >
          <p style={{ fontSize: 13, color: '#64748b' }}><UploadOutlined /> Click or drag your filled Excel file here</p>
        </Dragger>
        <Button
          type="primary"
          loading={loading}
          disabled={!fileList.length}
          onClick={handleUpload}
          style={{ marginTop: 12 }}
        >
          {uploadLabel}
        </Button>
      </div>

      {result && <ResultPanel result={result} />}
    </div>
  );
};

const ImportPage: React.FC = () => {
  const [importProducts] = useImportProductsMutation();
  const [importCustomers] = useImportCustomersMutation();
  const [importSuppliers] = useImportSuppliersMutation();

  const upload = (mutation: any) => async (file: File): Promise<ImportResult | null> => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await mutation(formData).unwrap();
      return res.data;
    } catch {
      message.error('Import failed — check the file format');
      return null;
    }
  };

  return (
    <div>
      <PageHeader
        title="Data Import"
        subtitle="Onboard your existing data — products, customers and suppliers"
      />
      <div style={{ padding: '0 24px 24px' }}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
          message="Import Order"
          description="Import in this order: (1) Create your Routes manually → (2) Import Products → (3) Import Customers → (4) Import Suppliers. Duplicate records are skipped automatically."
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
                  steps={['Download template', 'Fill product list from your old system', 'Upload']}
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
                  steps={['Download template', 'Fill customer list with route names', 'Upload']}
                  uploadLabel="Import Customers"
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
