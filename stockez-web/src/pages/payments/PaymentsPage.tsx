import React, { useState } from 'react';
import {
  Table, Button, Card, message, Tag, Tabs, Row, Col,
  Badge, Drawer, List, Avatar, DatePicker, Checkbox, Alert, Divider, Empty, Grid,
} from 'antd';
import {
  CheckCircleOutlined,
  SafetyOutlined, CalendarOutlined, PhoneOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetDailySummaryQuery, useClearPaymentsMutation,
  useGetPendingVerificationsQuery,
} from '../../store/api/paymentApi';
import PageHeader from '../../components/PageHeader';

const MODE_COLOR: Record<string, string> = {
  CASH: '#059669', UPI: '#7c3aed', CHEQUE: '#d97706',
  NEFT: '#0891b2', RTGS: '#2563eb', CREDIT: '#ef4444',
};

const ModeBadge: React.FC<{ mode: string; name?: string }> = ({ mode, name }) => (
  <span style={{
    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
    background: `${MODE_COLOR[mode] || '#6b7280'}18`,
    color: MODE_COLOR[mode] || '#6b7280',
    border: `1px solid ${MODE_COLOR[mode] || '#6b7280'}40`,
  }}>
    {name || mode}
  </span>
);

// ── Pending Verification Tab ─────────────────────────────────────────────────
const PendingVerificationTab: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [drawerPerson, setDrawerPerson] = useState<any>(null);
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);

  const { data, isLoading, refetch } = useGetPendingVerificationsQuery();
  const { data: todayData } = useGetDailySummaryQuery({ date: dayjs().format('YYYY-MM-DD') });
  const [clearPayments, { isLoading: clearing }] = useClearPaymentsMutation();

  // People who have collected today but not yet submitted
  const pendingSubmission = (todayData?.data || [])
    .map((g: any) => ({
      ...g,
      unsubmitted: (g.payments || []).filter((p: any) => !p.submitted),
    }))
    .filter((g: any) => g.unsubmitted.length > 0)
    .map((g: any) => ({
      ...g,
      unsubmittedTotal: g.unsubmitted.reduce((s: number, p: any) => s + Number(p.amount), 0),
    }));

  const groups: any[] = data?.data || [];

  const handleClearSelected = async () => {
    if (selectedPayments.length === 0) { message.warning('Select payments to verify'); return; }
    try {
      await clearPayments({ paymentIds: selectedPayments }).unwrap();
      message.success(`${selectedPayments.length} payment(s) verified and cleared`);
      setSelectedPayments([]);
      setDrawerPerson(null);
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to clear payments');
    }
  };

  const handleClearAll = async (payments: any[]) => {
    const ids = payments.map((p: any) => p.id);
    try {
      await clearPayments({ paymentIds: ids }).unwrap();
      message.success(`All ${ids.length} payments verified for ${drawerPerson?.personName}`);
      setDrawerPerson(null);
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed');
    }
  };

  const drawerPayments: any[] = drawerPerson?.payments || [];
  const unclearedInDrawer = drawerPayments.filter((p: any) => !p.cleared);

  return (
    <>
      {/* ── Pending Submission section ── */}
      {pendingSubmission.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ExclamationCircleOutlined style={{ color: '#d97706', fontSize: 16 }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#92400e' }}>
              Awaiting Submission ({pendingSubmission.length})
            </span>
            <span style={{ fontSize: 12, color: '#b45309' }}>— these staff have not submitted yet</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingSubmission.map((g: any) => (
              <div key={g.personId} style={{
                background: '#fffbeb',
                border: '1.5px solid #fde68a',
                borderRadius: 14, padding: '14px 18px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar size={40} style={{ background: '#d97706', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                    {g.personName?.[0]}
                  </Avatar>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{g.personName}</div>
                    <div style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>
                      {g.unsubmitted.length} collection{g.unsubmitted.length !== 1 ? 's' : ''} not submitted
                      &nbsp;·&nbsp;
                      <span style={{ fontWeight: 700 }}>
                        ₹{g.unsubmittedTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                    background: '#fde68a', color: '#92400e',
                  }}>
                    NOT SUBMITTED
                  </span>
                  {g.phone && (
                    <a href={`tel:${g.phone}`} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: '#d97706', color: '#fff',
                      border: 'none', borderRadius: 8,
                      fontWeight: 700, fontSize: 12,
                      padding: '7px 14px', textDecoration: 'none',
                    }}>
                      <PhoneOutlined style={{ fontSize: 12 }} /> Call
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Divider style={{ margin: '20px 0 4px' }} />
        </div>
      )}

      {/* ── Pending Verification section ── */}
      {!isLoading && groups.length === 0 && pendingSubmission.length === 0 && (
        <Card style={{ borderRadius: 16, border: '1px solid #d1fae5' }} styles={{ body: { padding: '60px 20px', textAlign: 'center' } }}>
          <SafetyOutlined style={{ fontSize: 52, color: '#059669', display: 'block', marginBottom: 14 }} />
          <div style={{ fontWeight: 700, fontSize: 18, color: '#059669' }}>All Clear!</div>
          <div style={{ color: '#64748b', fontSize: 14, marginTop: 6 }}>
            Everyone has submitted and all collections are verified.
          </div>
        </Card>
      )}

      {!isLoading && groups.length === 0 && pendingSubmission.length > 0 && (
        <div style={{ background: '#f0fdf4', borderRadius: 14, border: '1px solid #d1fae5', padding: '20px', textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 22, color: '#059669', marginBottom: 6, display: 'block' }} />
          <div style={{ fontWeight: 600, color: '#059669', fontSize: 13 }}>
            No pending verifications — waiting for the above staff to submit
          </div>
        </div>
      )}

      {selectedPayments.length > 0 && (
        <Alert
          type="info" style={{ marginBottom: 12, borderRadius: 10 }}
          message={<span><strong>{selectedPayments.length}</strong> payments selected</span>}
          action={
            <Button size="small" type="primary" icon={<CheckCircleOutlined />} loading={clearing} onClick={handleClearSelected}
              style={{ borderRadius: 8, background: '#059669', border: 'none', fontWeight: 700 }}
            >
              Verify & Clear
            </Button>
          }
        />
      )}

      {groups.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <CheckCircleOutlined style={{ color: '#059669', fontSize: 15 }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: '#065f46' }}>
            Pending Verification ({groups.length})
          </span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>— submitted, not yet verified</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {groups.map((g: any) => {
          const personPayments: any[] = g.payments || [];
          const modeGroups: Record<string, number> = {};
          personPayments.forEach((p: any) => {
            modeGroups[p.paymentMode] = (modeGroups[p.paymentMode] || 0) + Number(p.amount);
          });

          return (
            <Card
              key={g.personId}
              style={{ borderRadius: 16, border: '1.5px solid #fde68a', background: '#fffbeb' }}
              styles={{ body: { padding: '16px 20px' } }}
              loading={isLoading}
            >
              {/* Person header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <Avatar
                  size={44}
                  style={{ background: '#d97706', fontWeight: 800, fontSize: 18, flexShrink: 0 }}
                >
                  {g.personName?.[0]}
                </Avatar>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>{g.personName}</div>
                  <div style={{ fontSize: 12, color: '#78350f', marginTop: 1 }}>{g.phone}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#92400e' }}>{personPayments.length} payments</div>
                  <div style={{ fontWeight: 800, fontSize: 20, color: '#0f172a' }}>
                    ₹{Number(g.totalCollected).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Mode breakdown */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {Object.entries(modeGroups).map(([mode, amt]) => (
                  <div key={mode} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: '#fff', borderRadius: 10, padding: '5px 12px',
                    border: `1.5px solid ${MODE_COLOR[mode] || '#6b7280'}40`,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: MODE_COLOR[mode] || '#6b7280', display: 'inline-block' }} />
                    <span style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>₹{Number(amt).toFixed(2)}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{mode}</span>
                  </div>
                ))}
              </div>

              <Divider style={{ margin: '0 0 12px 0' }} />

              <div style={{ display: 'flex', gap: 10 }}>
                <Button
                  style={{ flex: 1, borderRadius: 10, height: 38, fontWeight: 600 }}
                  onClick={() => { setDrawerPerson(g); setSelectedPayments([]); }}
                >
                  View Details
                </Button>
                <Button
                  type="primary" loading={clearing}
                  icon={<CheckCircleOutlined />}
                  style={{ flex: 1, borderRadius: 10, height: 38, background: '#059669', border: 'none', fontWeight: 700 }}
                  onClick={() => { setDrawerPerson(g); handleClearAll(personPayments); }}
                >
                  Verify All
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Payment Detail Drawer */}
      <Drawer
        title={
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{drawerPerson?.personName}</div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
              {drawerPayments.length} payments · ₹{Number(drawerPerson?.totalCollected || 0).toFixed(2)} total
            </div>
          </div>
        }
        placement="right"
        width={isMobile ? '100%' : 520}
        open={!!drawerPerson && drawerPerson.payments}
        onClose={() => { setDrawerPerson(null); setSelectedPayments([]); }}
        extra={
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={clearing}
            disabled={unclearedInDrawer.length === 0}
            onClick={() => handleClearAll(unclearedInDrawer)}
            style={{ background: '#059669', border: 'none', fontWeight: 700, borderRadius: 8 }}
          >
            Verify All ({unclearedInDrawer.length})
          </Button>
        }
      >
        {/* Summary */}
        <Row gutter={12} style={{ marginBottom: 16 }}>
          {[
            { label: 'Cash', key: 'cashAmount', color: MODE_COLOR.CASH },
            { label: 'UPI', key: 'upiAmount', color: MODE_COLOR.UPI },
            { label: 'Cheque', key: 'chequeAmount', color: MODE_COLOR.CHEQUE },
            { label: 'Credit', key: 'creditAmount', color: MODE_COLOR.CREDIT },
          ].filter(s => (drawerPerson?.[s.key] || 0) > 0).map(s => (
            <Col key={s.key} span={12}>
              <Card style={{ borderRadius: 12, marginBottom: 8 }} styles={{ body: { padding: '12px 14px' } }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: s.color }}>
                  ₹{Number(drawerPerson?.[s.key] || 0).toFixed(2)}
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        {/* Individual payments */}
        <List
          dataSource={drawerPayments}
          renderItem={(p: any) => (
            <List.Item
              key={p.id}
              style={{
                borderRadius: 10, padding: '10px 12px', marginBottom: 8,
                background: p.cleared ? '#f0fdf4' : '#fff',
                border: `1px solid ${p.cleared ? '#d1fae5' : '#e8ecf0'}`,
              }}
              actions={[
                !p.cleared && (
                  <Checkbox
                    key="check"
                    checked={selectedPayments.includes(p.id)}
                    onChange={e => setSelectedPayments(
                      e.target.checked ? [...selectedPayments, p.id] : selectedPayments.filter(id => id !== p.id)
                    )}
                  />
                ),
              ].filter(Boolean)}
            >
              <List.Item.Meta
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>₹{Number(p.amount).toFixed(2)}</span>
                    <ModeBadge mode={p.paymentMode} name={p.paymentMethodName} />
                    {p.cleared && <Tag color="success" style={{ borderRadius: 20, fontSize: 10 }}>Cleared</Tag>}
                  </div>
                }
                description={
                  <div>
                    <div style={{ fontSize: 12, color: '#475569' }}>
                      {p.order?.customerName || 'Customer'} · #{p.order?.orderNumber}
                    </div>
                    {p.referenceNumber && (
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Ref: {p.referenceNumber}</div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />

        {selectedPayments.length > 0 && (
          <div style={{ padding: '12px 0' }}>
            <Button
              type="primary" block
              icon={<CheckCircleOutlined />}
              loading={clearing}
              onClick={handleClearSelected}
              style={{ borderRadius: 10, background: '#059669', border: 'none', fontWeight: 700, height: 42 }}
            >
              Verify Selected ({selectedPayments.length})
            </Button>
          </div>
        )}
      </Drawer>
    </>
  );
};

// ── Daily History Tab ────────────────────────────────────────────────────────
const DailyHistoryTab: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(dayjs());

  const { data, isLoading, refetch } = useGetDailySummaryQuery({
    date: selectedDate.format('YYYY-MM-DD'),
  });

  const groups: any[] = data?.data || [];

  const totalCollected = groups.reduce((s: number, g: any) => s + Number(g.totalCollected || 0), 0);
  const totalCash = groups.reduce((s: number, g: any) => s + Number(g.cashAmount || 0), 0);
  const totalUpi = groups.reduce((s: number, g: any) => s + Number(g.upiAmount || 0), 0);
  const totalCheque = groups.reduce((s: number, g: any) => s + Number(g.chequeAmount || 0), 0);

  const allPayments = groups.flatMap((g: any) => g.payments || []);

  const columns = [
    {
      title: 'Collector',
      key: 'collector',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.collectedBy?.fullName}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.collectionDate}</div>
        </div>
      ),
    },
    {
      title: 'Customer / Order',
      key: 'order',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600, color: '#2563eb', fontSize: 12 }}>#{r.order?.orderNumber}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{r.order?.customerName}</div>
        </div>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      width: 110,
      render: (v: number) => <span style={{ fontWeight: 800, color: '#0f172a' }}>₹{Number(v).toFixed(2)}</span>,
    },
    {
      title: 'Method',
      key: 'method',
      width: 140,
      render: (_: any, r: any) => (
        <div>
          <ModeBadge mode={r.paymentMode} name={r.paymentMethodName} />
          {r.referenceNumber && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{r.referenceNumber}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 110,
      render: (_: any, r: any) => (
        r.cleared
          ? <Badge status="success" text="Cleared" />
          : r.submitted
            ? <Badge status="warning" text="Submitted" />
            : <Badge status="default" text="Collected" />
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <DatePicker
          value={selectedDate}
          onChange={d => d && setSelectedDate(d)}
          format="DD MMM YYYY"
          allowClear={false}
          style={{ borderRadius: 8 }}
        />
        <Button onClick={() => refetch()} style={{ borderRadius: 8 }}>Refresh</Button>
      </div>

      {/* Summary tiles */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        {[
          { label: 'Total Collected', value: totalCollected, color: '#0f172a' },
          { label: 'Cash', value: totalCash, color: MODE_COLOR.CASH },
          { label: 'UPI', value: totalUpi, color: MODE_COLOR.UPI },
          { label: 'Cheque', value: totalCheque, color: MODE_COLOR.CHEQUE },
        ].map(s => (
          <Col key={s.label} xs={12} lg={6}>
            <Card style={{ borderRadius: 12, marginBottom: 8 }} styles={{ body: { padding: '14px 16px' } }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: s.color }}>
                ₹{s.value.toFixed(2)}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={allPayments}
          rowKey="id"
          loading={isLoading}
          size="middle"
          pagination={{ pageSize: 25, showTotal: t => `${t} payments` }}
          locale={{ emptyText: <Empty description="No payments on this date" /> }}
        />
      </Card>
    </>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────
const PaymentsPage: React.FC = () => {
  const { data: pendingData } = useGetPendingVerificationsQuery();
  const { data: todaySummary } = useGetDailySummaryQuery({ date: dayjs().format('YYYY-MM-DD') });

  const pendingVerifyCount = (pendingData?.data || []).reduce(
    (acc: number, g: any) => acc + (g.payments?.length || 0), 0
  );
  const pendingSubmitCount = (todaySummary?.data || []).filter((g: any) =>
    (g.payments || []).some((p: any) => !p.submitted)
  ).length;
  const totalPending = pendingVerifyCount + pendingSubmitCount;

  const tabs = [
    {
      key: 'verify',
      label: (
        <span>
          <SafetyOutlined />
          Pending Verification
          {totalPending > 0 && (
            <Badge count={totalPending} size="small" style={{ marginLeft: 6, background: '#d97706' }} />
          )}
        </span>
      ),
      children: <PendingVerificationTab />,
    },
    {
      key: 'history',
      label: <span><CalendarOutlined /> Daily History</span>,
      children: <DailyHistoryTab />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Payments & Collections"
        subtitle="Verify submitted collections and review daily history"
        count={totalPending}
        countLabel={pendingSubmitCount > 0 ? `${pendingSubmitCount} not submitted · ${pendingVerifyCount} to verify` : 'pending verification'}
      />
      <Tabs items={tabs} defaultActiveKey="verify" style={{ marginTop: 8 }} />
    </div>
  );
};

export default PaymentsPage;
