import React, { useEffect } from 'react';
import { Form, Input, Button, Card, Row, Col, message, Spin, Divider } from 'antd';
import { SaveOutlined, ShopOutlined } from '@ant-design/icons';
import { useGetCompanyProfileQuery, useUpdateCompanyProfileMutation } from '../../store/api/supplierApi';
import PageHeader from '../../components/PageHeader';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
      {title}
    </div>
    {children}
  </div>
);

const CompanySettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const { data, isLoading } = useGetCompanyProfileQuery();
  const [updateProfile, { isLoading: saving }] = useUpdateCompanyProfileMutation();

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

  if (isLoading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

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
    </div>
  );
};

export default CompanySettingsPage;
