import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Card, Row, Col, message, Spin, Divider, Switch, Select, InputNumber, Typography, Upload } from 'antd';
import { SaveOutlined, ShopOutlined, SettingOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  useGetCompanyProfileQuery, useUpdateCompanyProfileMutation,
  useGetWorkflowSettingsQuery, useUpdateWorkflowSettingsMutation,
  useUploadCompanyLogoMutation,
} from '../../store/api/supplierApi';
import {
  useGetTrackingSettingsQuery, useSaveTrackingSettingsMutation,
} from '../../store/api/trackingApi';
import PageHeader from '../../components/PageHeader';

const { Text } = Typography;

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
      {title}
    </div>
    {children}
  </div>
);

const ImageField: React.FC<{
  label: string;
  hint: string;
  url: string | null;
  uploading: boolean;
  onUpload: (file: File) => Promise<boolean>;
  onRemove: () => void;
}> = ({ label, hint, url, uploading, onUpload, onRemove }) => (
  <>
    <div style={{ marginBottom: 4, fontSize: 14, color: 'rgba(0,0,0,0.88)' }}>{label}</div>
    {url ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <img
          src={url}
          alt={label}
          style={{ height: 64, maxWidth: 220, objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 12px', background: '#fff' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Upload accept="image/*" showUploadList={false} beforeUpload={onUpload}>
            <Button size="small" icon={<UploadOutlined />} loading={uploading}>Change</Button>
          </Upload>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={onRemove}>Remove</Button>
        </div>
      </div>
    ) : (
      <Upload accept="image/*" showUploadList={false} beforeUpload={onUpload}>
        <Button icon={<UploadOutlined />} loading={uploading}>Upload</Button>
      </Upload>
    )}
    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>{hint}</div>
  </>
);

const SettingRow: React.FC<{ label: string; description: string; control: React.ReactNode }> = ({ label, description, control }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
    <div style={{ flex: 1, paddingRight: 24 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{label}</div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{description}</div>
    </div>
    <div style={{ flexShrink: 0 }}>{control}</div>
  </div>
);

const CompanySettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const { data, isLoading } = useGetCompanyProfileQuery();
  const [updateProfile, { isLoading: saving }] = useUpdateCompanyProfileMutation();
  const [uploadLogo] = useUploadCompanyLogoMutation();
  const [uploadingSlot, setUploadingSlot] = useState<'logo' | 'extra' | 'qr' | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [extraImageUrl, setExtraImageUrl] = useState<string | null>(null);
  const [paymentQrImageUrl, setPaymentQrImageUrl] = useState<string | null>(null);
  const { data: settingsData, isLoading: settingsLoading } = useGetWorkflowSettingsQuery();
  const [updateWorkflowSettings, { isLoading: savingSettings }] = useUpdateWorkflowSettingsMutation();

  const [ws, setWs] = useState({
    invoiceApprovalRequired: true,
    picklistEnabled: true,
    goodsReturnApprovalRequired: false,
    creditLimitEnforcement: 'HARD_BLOCK',
    maxDiscountPercent: null as number | null,
    lockBillingAfterCheckout: false,
    discountType: 'PERCENT' as 'PERCENT' | 'AMOUNT',
    showPurchaseRateToSales: true,
  });

  const { data: trackingData } = useGetTrackingSettingsQuery();
  const [saveTrackingSettings] = useSaveTrackingSettingsMutation();

  const [ts, setTs] = useState({
    locationTrackingEnabled: false,
    locationPingIntervalSeconds: 90,
    trackOnlyWhenCheckedIn: true,
    locationRetentionDays: 90,
  });

  useEffect(() => {
    if (trackingData?.data) {
      const t = trackingData.data;
      setTs({
        locationTrackingEnabled: t.locationTrackingEnabled ?? false,
        locationPingIntervalSeconds: t.locationPingIntervalSeconds ?? 90,
        trackOnlyWhenCheckedIn: t.trackOnlyWhenCheckedIn ?? true,
        locationRetentionDays: t.locationRetentionDays ?? 90,
      });
    }
  }, [trackingData]);

  useEffect(() => {
    if (settingsData?.data) {
      const s = settingsData.data;
      setWs({
        invoiceApprovalRequired: s.invoiceApprovalRequired ?? true,
        picklistEnabled: s.picklistEnabled ?? true,
        goodsReturnApprovalRequired: s.goodsReturnApprovalRequired ?? false,
        creditLimitEnforcement: s.creditLimitEnforcement ?? 'HARD_BLOCK',
        maxDiscountPercent: s.maxDiscountPercent ?? null,
        lockBillingAfterCheckout: s.lockBillingAfterCheckout ?? false,
        discountType: s.discountType ?? 'PERCENT',
        showPurchaseRateToSales: s.showPurchaseRateToSales ?? true,
      });
    }
  }, [settingsData]);

  const handleSaveWorkflow = async () => {
    try {
      await updateWorkflowSettings(ws).unwrap();
      await saveTrackingSettings(ts).unwrap();
      message.success('Workflow settings saved');
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to save settings');
    }
  };

  const wName      = Form.useWatch('name', form);
  const wOwner     = Form.useWatch('ownerName', form);
  const wAddress   = Form.useWatch('address', form);
  const wCity      = Form.useWatch('city', form);
  const wState     = Form.useWatch('state', form);
  const wPin       = Form.useWatch('pinCode', form);
  const wPhone     = Form.useWatch('phone', form);
  const wEmail     = Form.useWatch('email', form);
  const wGstin     = Form.useWatch('gstin', form);
  const wFssai     = Form.useWatch('fssaiNumber', form);
  const wPan       = Form.useWatch('panNumber', form);
  const wTerms     = Form.useWatch('invoiceTerms', form);

  useEffect(() => {
    if (data?.data) {
      const p = data.data;
      form.setFieldsValue({
        name: p.name, ownerName: p.ownerName, phone: p.phone, email: p.email,
        address: p.address, city: p.city, state: p.state, pinCode: p.pinCode,
        gstin: p.gstin, fssaiNumber: p.fssaiNumber, panNumber: p.panNumber,
        invoiceTerms: p.invoiceTerms, stateCode: p.stateCode,
        bankName: p.bankName, bankAccountName: p.bankAccountName,
        bankAccountNumber: p.bankAccountNumber, bankBranch: p.bankBranch,
        bankIfsc: p.bankIfsc, invoiceFooterNote: p.invoiceFooterNote, upiId: p.upiId,
      });
      setLogoUrl(p.logoUrl || null);
      setExtraImageUrl(p.extraImageUrl || null);
      setPaymentQrImageUrl(p.paymentQrImageUrl || null);
    }
  }, [data, form]);

  const uploadImage = (slot: 'logo' | 'extra' | 'qr', setter: (url: string) => void, label: string) => async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    setUploadingSlot(slot);
    try {
      const result = await uploadLogo(formData).unwrap();
      setter(result.data.url);
      message.success(`${label} uploaded`);
    } catch {
      message.error(`Failed to upload ${label.toLowerCase()}`);
    } finally {
      setUploadingSlot(null);
    }
    return false;
  };

  const handleLogoUpload = uploadImage('logo', (u) => setLogoUrl(u), 'Logo');
  const handleExtraUpload = uploadImage('extra', (u) => setExtraImageUrl(u), 'Image');
  const handleQrUpload = uploadImage('qr', (u) => setPaymentQrImageUrl(u), 'QR code');

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await updateProfile({ ...values, logoUrl, extraImageUrl, paymentQrImageUrl }).unwrap();
      message.success('Company profile updated');
    } catch (err: any) {
      if (err?.errorFields) {
        message.warning('Please fill in all required fields before saving');
        return;
      }
      message.error(err?.data?.message || 'Failed to save');
    }
  };

  if (isLoading || settingsLoading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

  return (
    <div>
      <PageHeader
        title="Company Settings"
        subtitle="Your company details printed on every invoice"
        action={
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}
            style={{ background: '#059669', borderColor: '#059669', fontWeight: 700 }}>
            Save Changes
          </Button>
        }
      />

      <Row gutter={[20, 0]}>
        <Col xs={24} lg={14}>
          <Card style={{ borderRadius: 12 }} styles={{ body: { padding: '24px' } }}>
            <Form form={form} layout="vertical" scrollToFirstError>

              <Section title="Business Identity">
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item name="name" label="Company / Business Name"
                      rules={[{ required: true, message: 'Company name is required' }]}>
                      <Input size="large" placeholder="e.g. Sri Murugan Distributors" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="ownerName" label="Owner / Proprietor Name"
                      rules={[{ required: true, message: 'Owner name is required' }]}>
                      <Input size="large" placeholder="e.g. K. Murugan" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="phone" label="Phone"
                      rules={[
                        { required: true, message: 'Phone number is required' },
                        { pattern: /^[6-9]\d{9}$/, message: 'Enter a valid 10-digit mobile number starting with 6–9' },
                      ]}>
                      <Input size="large" placeholder="9876543210" maxLength={10} />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="email" label="Email"
                      rules={[
                        { required: true, message: 'Email address is required' },
                        { type: 'email', message: 'Enter a valid email address (e.g. info@company.com)' },
                      ]}>
                      <Input size="large" placeholder="info@company.com" />
                    </Form.Item>
                  </Col>
                </Row>
              </Section>

              <Divider style={{ margin: '8px 0 20px' }} />

              <Section title="Address">
                <Form.Item name="address" label="Street Address"
                  rules={[{ required: true, message: 'Street address is required' }]}>
                  <Input.TextArea rows={2} placeholder="Door No, Street, Area" />
                </Form.Item>
                <Row gutter={16}>
                  <Col xs={24} sm={8}>
                    <Form.Item name="city" label="City"
                      rules={[{ required: true, message: 'City is required' }]}>
                      <Input placeholder="e.g. Coimbatore" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item name="state" label="State"
                      rules={[{ required: true, message: 'State is required' }]}>
                      <Input placeholder="e.g. Tamil Nadu" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item name="pinCode" label="PIN Code"
                      rules={[
                        { required: true, message: 'PIN code is required' },
                        { pattern: /^[1-9]\d{5}$/, message: 'Enter a valid 6-digit PIN code (e.g. 641001)' },
                      ]}>
                      <Input placeholder="641001" maxLength={6} />
                    </Form.Item>
                    <Form.Item name="stateCode" label="GST State Code"
                      rules={[{ pattern: /^$|^[0-9]{2}$/, message: 'Two digits, e.g. 33 for Tamil Nadu' }]}>
                      <Input placeholder="33" maxLength={2} />
                    </Form.Item>
                  </Col>
                </Row>
              </Section>

              <Divider style={{ margin: '8px 0 20px' }} />

              <Section title="Regulatory Details">
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item name="gstin" label="GSTIN"
                      rules={[
                        { required: true, message: 'GSTIN is required' },
                        { pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, message: 'Invalid GSTIN — must be 15 characters like 33ABCDE1234F1Z5' },
                      ]}>
                      <Input placeholder="33ABCDE1234F1Z5" maxLength={15} style={{ textTransform: 'uppercase' }}
                        onChange={e => form.setFieldValue('gstin', e.target.value.toUpperCase())} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="fssaiNumber" label="FSSAI License No."
                      rules={[
                        { required: true, message: 'FSSAI license number is required' },
                        { pattern: /^\d{14}$/, message: 'Must be exactly 14 digits (e.g. 10012345678901)' },
                      ]}>
                      <Input placeholder="10012345678901" maxLength={14} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="panNumber" label="PAN Number"
                      rules={[
                        { required: true, message: 'PAN number is required' },
                        { pattern: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, message: 'Invalid PAN — must be 10 characters like ABCDE1234F (5 letters, 4 digits, 1 letter)' },
                      ]}>
                      <Input placeholder="ABCDE1234F" maxLength={10} style={{ textTransform: 'uppercase' }}
                        onChange={e => form.setFieldValue('panNumber', e.target.value.toUpperCase())} />
                    </Form.Item>
                  </Col>
                </Row>
              </Section>

              <Divider style={{ margin: '8px 0 20px' }} />

              <Section title="Branding">
                <div style={{ marginBottom: 4, fontSize: 14, color: 'rgba(0,0,0,0.88)' }}>Company Logo</div>
                {logoUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <img
                      src={logoUrl}
                      alt="Company logo"
                      style={{ height: 64, maxWidth: 220, objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 12px', background: '#fff' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <Upload accept="image/*" showUploadList={false} beforeUpload={handleLogoUpload}>
                        <Button size="small" icon={<UploadOutlined />} loading={uploadingSlot === 'logo'}>Change</Button>
                      </Upload>
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => { setLogoUrl(null); message.info('Logo removed. Click Save to apply.'); }}>Remove</Button>
                    </div>
                  </div>
                ) : (
                  <Upload accept="image/*" showUploadList={false} beforeUpload={handleLogoUpload}>
                    <Button icon={<UploadOutlined />} loading={uploadingSlot === 'logo'}>Upload Logo</Button>
                  </Upload>
                )}
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
                  Shown on printed invoices. JPG, PNG or WebP, max 5 MB.
                </div>

                <Divider style={{ margin: '20px 0' }} />

                <ImageField
                  label="Additional Image"
                  hint="Optional second image on the invoice header — a deity, founder portrait or emblem."
                  url={extraImageUrl}
                  onUpload={handleExtraUpload}
                  onRemove={() => { setExtraImageUrl(null); message.info('Image removed. Click Save to apply.'); }}
                  uploading={uploadingSlot === 'extra'}
                />

                <Divider style={{ margin: '20px 0' }} />

                <Form.Item name="upiId" label="UPI ID"
                  tooltip="Each bill with a balance due gets a QR for this UPI ID. The customer enters the amount."
                  rules={[{ pattern: /^$|^[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9]{1,}$/, message: 'Invalid UPI ID (e.g. name@bank)' }]}>
                  <Input placeholder="e.g. santhitraders@okaxis" maxLength={100} />
                </Form.Item>

                {paymentQrImageUrl && <ImageField
                  label="Old uploaded QR (remove it - the UPI ID makes the QR now)"
                  hint="Used only when no UPI ID is set, or when the bill has no balance due."
                  url={paymentQrImageUrl}
                  onUpload={handleQrUpload}
                  onRemove={() => { setPaymentQrImageUrl(null); message.info('QR code removed. Click Save to apply.'); }}
                  uploading={uploadingSlot === 'qr'}
                />}
              </Section>

              <Divider style={{ margin: '8px 0 20px' }} />

              <Section title="Bank Details">
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item name="bankName" label="Bank Name">
                      <Input placeholder="e.g. Tamilnadu Mercantile Bank" maxLength={120} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="bankAccountName" label="Account Name">
                      <Input placeholder="Name on the account" maxLength={120} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} sm={8}>
                    <Form.Item name="bankAccountNumber" label="Account Number">
                      <Input placeholder="Account number" maxLength={40} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item name="bankBranch" label="Branch">
                      <Input placeholder="Branch name" maxLength={120} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item name="bankIfsc" label="IFSC Code"
                      rules={[{ pattern: /^$|^[A-Z]{4}0[A-Z0-9]{6}$/, message: 'Invalid IFSC code' }]}>
                      <Input placeholder="e.g. TMBL0000037" maxLength={11} style={{ textTransform: 'uppercase' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  Printed on every invoice. Leave blank to omit the bank panel entirely.
                </div>
              </Section>

              <Divider style={{ margin: '8px 0 20px' }} />

              <Section title="Invoice Terms & Conditions">
                <Form.Item name="invoiceTerms" label="Terms & Conditions" style={{ marginBottom: 4 }}>
                  <Input.TextArea rows={4} placeholder={'e.g. Goods once sold will not be taken back.\nPayment due within 30 days.\nSubject to local jurisdiction.'} maxLength={2000} showCount />
                </Form.Item>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  Printed on every invoice. Leave blank to show the default payment note instead.
                </div>
              </Section>

              <Divider style={{ margin: '8px 0 20px' }} />

              <Section title="Invoice Footer Note">
                <Form.Item name="invoiceFooterNote" label="Closing Line" style={{ marginBottom: 4 }}>
                  <Input.TextArea rows={2} maxLength={500} showCount
                    placeholder="A closing quote or message, centred at the foot of the bill" />
                </Form.Item>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  Tamil and other Indian scripts are supported.
                </div>
              </Section>

            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card style={{ borderRadius: 12 }} styles={{ body: { padding: '20px' } }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShopOutlined style={{ color: '#059669', fontSize: 18 }} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Invoice Preview</div>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '16px', fontSize: 13, lineHeight: 1.7, color: '#374151' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', marginBottom: 4 }}>
                {wName || 'Your Company Name'}
              </div>
              {wOwner   && <div>Prop: {wOwner}</div>}
              {wAddress && <div>{wAddress}</div>}
              {(wCity || wState || wPin) && (
                <div>{[wCity, wState, wPin].filter(Boolean).join(', ')}</div>
              )}
              {wPhone   && <div>Ph: {wPhone}</div>}
              {wEmail   && <div>Email: {wEmail}</div>}
              {(wGstin || wFssai || wPan) && <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 6, paddingTop: 6 }} />}
              {wGstin   && <div>GSTIN: {wGstin}</div>}
              {wFssai   && <div>FSSAI: {wFssai}</div>}
              {wPan     && <div>PAN: {wPan}</div>}
              {wTerms && (
                <>
                  <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 8, paddingTop: 8, fontWeight: 700, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    Terms & Conditions
                  </div>
                  <div style={{ whiteSpace: 'pre-line', marginTop: 4 }}>{wTerms}</div>
                </>
              )}
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
              This header appears on every printed invoice.
            </div>
          </Card>
        </Col>
      </Row>

      {/* Workflow Settings */}
      <div style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SettingOutlined style={{ color: '#059669', fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Workflow Settings</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Configure how orders and stock behave for your operation</div>
            </div>
          </div>
          <Button type="primary" icon={<SaveOutlined />} loading={savingSettings} onClick={handleSaveWorkflow}
            style={{ background: '#059669', borderColor: '#059669', fontWeight: 700 }}>
            Save Settings
          </Button>
        </div>

        <Row gutter={[20, 20]}>
          <Col xs={24} lg={14}>
            <Card style={{ borderRadius: 12 }} styles={{ body: { padding: '8px 24px 16px' } }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, padding: '14px 0 8px' }}>
                Order Workflow
              </div>

              <SettingRow
                label="Invoice Approval Required"
                description="When ON, every order waits for an approver before it can be dispatched. Turn OFF for small teams where orders go straight through."
                control={
                  <Switch
                    checked={ws.invoiceApprovalRequired}
                    onChange={v => setWs(prev => ({ ...prev, invoiceApprovalRequired: v }))}
                  />
                }
              />
              <SettingRow
                label="Warehouse Picklist Step"
                description="When ON, warehouse staff must verify items before dispatch. Turn OFF if the same person packs and dispatches."
                control={
                  <Switch
                    checked={ws.picklistEnabled}
                    onChange={v => setWs(prev => ({ ...prev, picklistEnabled: v }))}
                  />
                }
              />
              <SettingRow
                label="Goods Return Approval"
                description="When ON, returns need manager approval before stock is added back. Turn OFF to allow direct returns."
                control={
                  <Switch
                    checked={ws.goodsReturnApprovalRequired}
                    onChange={v => setWs(prev => ({ ...prev, goodsReturnApprovalRequired: v }))}
                  />
                }
              />

              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, padding: '20px 0 8px' }}>
                Business Rules
              </div>

              <SettingRow
                label="Credit Limit Enforcement"
                description="Hard Block: order is rejected if customer exceeds credit limit. Disabled: no credit check is performed."
                control={
                  <Select
                    value={ws.creditLimitEnforcement}
                    onChange={v => setWs(prev => ({ ...prev, creditLimitEnforcement: v }))}
                    style={{ width: 140 }}
                    options={[
                      { value: 'HARD_BLOCK', label: 'Hard Block' },
                      { value: 'DISABLED', label: 'Disabled' },
                    ]}
                  />
                }
              />
              <SettingRow
                label="Maximum Discount %"
                description="Salesman cannot give more than this discount on any order line. Leave blank for no restriction."
                control={
                  <InputNumber
                    value={ws.maxDiscountPercent}
                    onChange={v => setWs(prev => ({ ...prev, maxDiscountPercent: v }))}
                    min={0} max={100} precision={2}
                    placeholder="No limit"
                    style={{ width: 140 }}
                    addonAfter="%"
                  />
                }
              />
              <SettingRow
                label="Discount Input Type"
                description="Percentage: salesman enters discount as %. Amount: salesman enters a flat ₹ discount per line."
                control={
                  <Select
                    value={ws.discountType}
                    onChange={v => setWs(prev => ({ ...prev, discountType: v }))}
                    style={{ width: 140 }}
                    options={[
                      { value: 'PERCENT', label: 'Percentage (%)' },
                      { value: 'AMOUNT',  label: 'Flat Amount (₹)' },
                    ]}
                  />
                }
              />

              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, padding: '20px 0 8px' }}>
                Field Operations
              </div>

              <SettingRow
                label="Lock Billing After Checkout"
                description="When ON, a salesperson cannot create new orders after checking out for the day. Turn OFF for van sales where billing continues throughout the day."
                control={
                  <Switch
                    checked={ws.lockBillingAfterCheckout}
                    onChange={v => setWs(prev => ({ ...prev, lockBillingAfterCheckout: v }))}
                  />
                }
              />
              <SettingRow
                label="Show Purchase Rate to Sales Staff"
                description="When ON, the PR (purchase rate) is shown on product cards in Sales Order and Counter Sale. Turn OFF to hide product cost from salesmen."
                control={
                  <Switch
                    checked={ws.showPurchaseRateToSales}
                    onChange={v => setWs(prev => ({ ...prev, showPurchaseRateToSales: v }))}
                  />
                }
              />

              <Divider style={{ margin: '20px 0 16px' }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Field Tracking
              </div>

              <SettingRow
                label="Record Staff Location"
                description="When ON, sales and delivery staff phones report their position while the StockEz app is open, and every order, collection and delivery is stamped with where it was made. Tell your staff before turning this on."
                control={
                  <Switch
                    checked={ts.locationTrackingEnabled}
                    onChange={v => setTs(prev => ({ ...prev, locationTrackingEnabled: v }))}
                  />
                }
              />
              <SettingRow
                label="Only While Checked In"
                description="When ON, nothing is recorded before the staff member checks in or after they check out. Turn OFF only if your staff bill without using attendance."
                control={
                  <Switch
                    disabled={!ts.locationTrackingEnabled}
                    checked={ts.trackOnlyWhenCheckedIn}
                    onChange={v => setTs(prev => ({ ...prev, trackOnlyWhenCheckedIn: v }))}
                  />
                }
              />
              <SettingRow
                label="Reporting Interval"
                description="How often a moving phone reports its position. Shorter gives a finer trail and uses more battery."
                control={
                  <Select
                    disabled={!ts.locationTrackingEnabled}
                    style={{ width: 150 }}
                    value={ts.locationPingIntervalSeconds}
                    onChange={v => setTs(prev => ({ ...prev, locationPingIntervalSeconds: v }))}
                    options={[
                      { value: 60,  label: 'Every 1 minute' },
                      { value: 90,  label: 'Every 90 seconds' },
                      { value: 180, label: 'Every 3 minutes' },
                      { value: 300, label: 'Every 5 minutes' },
                    ]}
                  />
                }
              />
              <SettingRow
                label="Keep Location Trail For"
                description="Position history is deleted after this many days. Shop visit records are kept permanently — only the movement trail between shops is trimmed."
                control={
                  <Select
                    disabled={!ts.locationTrackingEnabled}
                    style={{ width: 150 }}
                    value={ts.locationRetentionDays}
                    onChange={v => setTs(prev => ({ ...prev, locationRetentionDays: v }))}
                    options={[
                      { value: 30,  label: '30 days' },
                      { value: 90,  label: '90 days' },
                      { value: 180, label: '6 months' },
                      { value: 365, label: '1 year' },
                    ]}
                  />
                }
              />
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card style={{ borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }} styles={{ body: { padding: '20px' } }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 12 }}>How this affects your workflow</div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.8 }}>
                {ws.invoiceApprovalRequired && ws.picklistEnabled && (
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>Full workflow:</Text> Submit → Approve → Picklist → Dispatch → Deliver
                  </div>
                )}
                {!ws.invoiceApprovalRequired && ws.picklistEnabled && (
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>Medium workflow:</Text> Submit → Auto-Approve → Picklist → Dispatch → Deliver
                  </div>
                )}
                {ws.invoiceApprovalRequired && !ws.picklistEnabled && (
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>Lean workflow:</Text> Submit → Approve → Dispatch → Deliver
                  </div>
                )}
                {!ws.invoiceApprovalRequired && !ws.picklistEnabled && (
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>Simple workflow:</Text> Submit → Auto-Approve → Dispatch → Deliver
                  </div>
                )}
                <div style={{ marginTop: 12, color: '#94a3b8', fontSize: 11 }}>
                  Credit limit: <strong>{ws.creditLimitEnforcement === 'HARD_BLOCK' ? 'Enforced — orders blocked when exceeded' : 'Disabled'}</strong>
                </div>
                <div style={{ color: '#94a3b8', fontSize: 11 }}>
                  Max discount: <strong>{ws.maxDiscountPercent != null ? `${ws.maxDiscountPercent}% cap enforced` : 'No restriction'}</strong>
                </div>
                <div style={{ color: '#94a3b8', fontSize: 11 }}>
                  Discount input: <strong>{ws.discountType === 'AMOUNT' ? 'Flat ₹ amount per line' : 'Percentage %'}</strong>
                </div>
                <div style={{ marginTop: 12, color: '#94a3b8', fontSize: 11 }}>
                  Billing lock: <strong>{ws.lockBillingAfterCheckout ? 'Locked after checkout' : 'Always open'}</strong>
                </div>
                <div style={{ color: '#94a3b8', fontSize: 11 }}>
                  Purchase rate to sales: <strong>{ws.showPurchaseRateToSales ? 'Visible on product cards' : 'Hidden'}</strong>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default CompanySettingsPage;
