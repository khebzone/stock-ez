import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Card, Row, Col, message, Spin, Divider, Switch, Select, InputNumber, Typography } from 'antd';
import { SaveOutlined, ShopOutlined, SettingOutlined } from '@ant-design/icons';
import {
  useGetCompanyProfileQuery, useUpdateCompanyProfileMutation,
  useGetWorkflowSettingsQuery, useUpdateWorkflowSettingsMutation,
} from '../../store/api/supplierApi';
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
  const { data: settingsData, isLoading: settingsLoading } = useGetWorkflowSettingsQuery();
  const [updateWorkflowSettings, { isLoading: savingSettings }] = useUpdateWorkflowSettingsMutation();

  const [ws, setWs] = useState({
    invoiceApprovalRequired: true,
    picklistEnabled: true,
    goodsReturnApprovalRequired: false,
    creditLimitEnforcement: 'HARD_BLOCK',
    maxDiscountPercent: null as number | null,
    lockBillingAfterCheckout: false,
    separateDeliveryAllocation: false,
  });

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
        separateDeliveryAllocation: s.separateDeliveryAllocation ?? false,
      });
    }
  }, [settingsData]);

  const handleSaveWorkflow = async () => {
    try {
      await updateWorkflowSettings(ws).unwrap();
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

  useEffect(() => {
    if (data?.data) {
      const p = data.data;
      form.setFieldsValue({
        name: p.name, ownerName: p.ownerName, phone: p.phone, email: p.email,
        address: p.address, city: p.city, state: p.state, pinCode: p.pinCode,
        gstin: p.gstin, fssaiNumber: p.fssaiNumber, panNumber: p.panNumber,
        logoUrl: p.logoUrl,
      });
    }
  }, [data, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await updateProfile(values).unwrap();
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
                      rules={[{ required: true, message: 'Required' }]}>
                      <Input size="large" placeholder="e.g. Sri Murugan Distributors" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="ownerName" label="Owner / Proprietor Name"
                      rules={[{ required: true, message: 'Required' }]}>
                      <Input size="large" placeholder="e.g. K. Murugan" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="phone" label="Phone"
                      rules={[{ required: true }, { pattern: /^[6-9]\d{9}$/, message: '10-digit mobile' }]}>
                      <Input size="large" placeholder="9876543210" maxLength={10} />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="email" label="Email"
                      rules={[{ required: true }, { type: 'email', message: 'Valid email required' }]}>
                      <Input size="large" placeholder="info@company.com" />
                    </Form.Item>
                  </Col>
                </Row>
              </Section>

              <Divider style={{ margin: '8px 0 20px' }} />

              <Section title="Address">
                <Form.Item name="address" label="Street Address"
                  rules={[{ required: true, message: 'Required' }]}>
                  <Input.TextArea rows={2} placeholder="Door No, Street, Area" />
                </Form.Item>
                <Row gutter={16}>
                  <Col xs={24} sm={8}>
                    <Form.Item name="city" label="City"
                      rules={[{ required: true, message: 'Required' }]}>
                      <Input placeholder="e.g. Coimbatore" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item name="state" label="State"
                      rules={[{ required: true, message: 'Required' }]}>
                      <Input placeholder="e.g. Tamil Nadu" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item name="pinCode" label="PIN Code"
                      rules={[{ required: true, message: 'Required' }, { pattern: /^\d{6}$/, message: '6-digit PIN' }]}>
                      <Input placeholder="641001" maxLength={6} />
                    </Form.Item>
                  </Col>
                </Row>
              </Section>

              <Divider style={{ margin: '8px 0 20px' }} />

              <Section title="Regulatory Details">
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item name="gstin" label="GSTIN"
                      rules={[{ required: true, message: 'Required' }, { pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, message: 'Invalid GSTIN format' }]}>
                      <Input placeholder="22AAAAA0000A1Z5" maxLength={15} style={{ textTransform: 'uppercase' }}
                        onChange={e => form.setFieldValue('gstin', e.target.value.toUpperCase())} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="fssaiNumber" label="FSSAI License No."
                      rules={[{ required: true, message: 'Required' }]}>
                      <Input placeholder="10012345678901" maxLength={20} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="panNumber" label="PAN Number"
                      rules={[{ required: true, message: 'Required' }, { pattern: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, message: 'Invalid PAN format' }]}>
                      <Input placeholder="ABCDE1234F" maxLength={10} style={{ textTransform: 'uppercase' }}
                        onChange={e => form.setFieldValue('panNumber', e.target.value.toUpperCase())} />
                    </Form.Item>
                  </Col>
                </Row>
              </Section>

              <Divider style={{ margin: '8px 0 20px' }} />

              <Section title="Branding">
                <Form.Item name="logoUrl" label="Logo URL"
                  extra="Paste a publicly accessible image URL. Shown on printed invoices.">
                  <Input placeholder="https://..." />
                </Form.Item>
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
                label="Separate Delivery Allocation"
                description="When ON, delivery is assigned to a route on a different date from sales. The route allocation form will show separate sales and delivery date fields."
                control={
                  <Switch
                    checked={ws.separateDeliveryAllocation}
                    onChange={v => setWs(prev => ({ ...prev, separateDeliveryAllocation: v }))}
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
                <div style={{ marginTop: 12, color: '#94a3b8', fontSize: 11 }}>
                  Billing lock: <strong>{ws.lockBillingAfterCheckout ? 'Locked after checkout' : 'Always open'}</strong>
                </div>
                <div style={{ color: '#94a3b8', fontSize: 11 }}>
                  Delivery allocation: <strong>{ws.separateDeliveryAllocation ? 'Separate date from sales' : 'Same day'}</strong>
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
