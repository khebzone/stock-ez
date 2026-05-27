import React, { useState } from 'react';
import {
  Table, Button, DatePicker, Select, Tag, Space, Form, InputNumber,
  TimePicker, message, Spin, Alert, Card, Statistic, Row, Col, Tooltip,
} from 'antd';
import {
  SettingOutlined, ReloadOutlined, EnvironmentOutlined, ClockCircleOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetAttendanceSettingsQuery,
  useSaveAttendanceSettingsMutation,
  useGetAttendanceByDateQuery,
  useGetAttendanceByUserQuery,
} from '../../store/api/attendanceApi';
import { useGetUsersQuery } from '../../store/api/userApi';

const { Option } = Select;

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  PRESENT: { color: 'success', icon: <CheckCircleOutlined />, label: 'Present' },
  LATE:    { color: 'warning', icon: <ExclamationCircleOutlined />, label: 'Late' },
  ABSENT:  { color: 'error',   icon: <CloseCircleOutlined />, label: 'Absent' },
};

const fmt = (ts: string | null) => ts ? dayjs(ts).format('hh:mm A') : '—';
const fmtDate = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD');

const AttendancePage: React.FC = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [filterUserId, setFilterUserId] = useState<string | undefined>();
  const [settingsForm] = Form.useForm();

  const { data: settingsData, isLoading: settingsLoading } = useGetAttendanceSettingsQuery();
  const settings = settingsData?.data;

  const { data: usersData } = useGetUsersQuery();
  const users = (usersData?.data?.content || usersData?.data || []).filter((u: any) =>
    ['SALES', 'DELIVERY', 'ADMIN'].includes(u.role) && u.active
  );

  const { data: attendanceData, isLoading: attendanceLoading, refetch } = useGetAttendanceByDateQuery(
    fmtDate(selectedDate),
    { skip: !!filterUserId }
  );

  const { data: userAttData, isLoading: userAttLoading } = useGetAttendanceByUserQuery(
    { userId: filterUserId!, from: fmtDate(selectedDate.startOf('month')), to: fmtDate(selectedDate.endOf('month')) },
    { skip: !filterUserId }
  );

  const [saveSettings, { isLoading: saving }] = useSaveAttendanceSettingsMutation();

  const records: any[] = filterUserId
    ? (userAttData?.data || [])
    : (attendanceData?.data || []);

  const present = records.filter((r: any) => r.status === 'PRESENT').length;
  const late    = records.filter((r: any) => r.status === 'LATE').length;
  const absent  = records.filter((r: any) => r.status === 'ABSENT').length;

  const handleSaveSettings = async (values: any) => {
    try {
      await saveSettings({
        officeLatitude: values.officeLatitude,
        officeLongitude: values.officeLongitude,
        geofenceRadiusM: values.geofenceRadiusM,
        lateThresholdTime: values.lateThresholdTime?.format('HH:mm') || '09:00',
      }).unwrap();
      message.success('Attendance settings saved');
      setSettingsOpen(false);
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to save settings');
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      message.error('Geolocation not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        settingsForm.setFieldsValue({
          officeLatitude: parseFloat(pos.coords.latitude.toFixed(6)),
          officeLongitude: parseFloat(pos.coords.longitude.toFixed(6)),
        });
        message.success('Current location captured');
      },
      () => message.error('Could not get location. Check browser permissions.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const columns = filterUserId ? [
    {
      title: 'Date',
      dataIndex: 'attendanceDate',
      render: (d: string) => dayjs(d).format('DD MMM YYYY'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s: string) => {
        const cfg = STATUS_CONFIG[s] || STATUS_CONFIG.ABSENT;
        return <Tag color={cfg.color}>{cfg.icon} {cfg.label}</Tag>;
      },
    },
    {
      title: 'Check In',
      dataIndex: 'checkInTime',
      render: fmt,
      align: 'right' as const,
    },
    {
      title: 'Check Out',
      dataIndex: 'checkOutTime',
      render: fmt,
      align: 'right' as const,
    },
  ] : [
    {
      title: 'Name',
      dataIndex: 'userName',
      sorter: (a: any, b: any) => a.userName.localeCompare(b.userName),
    },
    {
      title: 'Role',
      dataIndex: 'userRole',
      render: (r: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{r}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s: string) => {
        const cfg = STATUS_CONFIG[s] || STATUS_CONFIG.ABSENT;
        return <Tag color={cfg.color}>{cfg.icon} {cfg.label}</Tag>;
      },
    },
    {
      title: 'Check In',
      dataIndex: 'checkInTime',
      render: fmt,
      align: 'right' as const,
    },
    {
      title: 'Check Out',
      dataIndex: 'checkOutTime',
      render: fmt,
      align: 'right' as const,
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Attendance</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Track daily staff check-in and check-out</div>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} />
          <Button icon={<SettingOutlined />} onClick={() => {
            if (settings) {
              settingsForm.setFieldsValue({
                officeLatitude: settings.officeLatitude,
                officeLongitude: settings.officeLongitude,
                geofenceRadiusM: settings.geofenceRadiusM,
                lateThresholdTime: settings.lateThresholdTime
                  ? dayjs(settings.lateThresholdTime, 'HH:mm') : dayjs('09:00', 'HH:mm'),
              });
            }
            setSettingsOpen(true);
          }}>
            Office Settings
          </Button>
        </Space>
      </div>

      {/* Settings not configured warning */}
      {!settingsLoading && settings && !settings.configured && (
        <Alert
          type="warning"
          message="Office location not configured. Staff cannot check in until you set the office location."
          action={<Button size="small" onClick={() => setSettingsOpen(true)}>Configure Now</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Settings Panel */}
      {settingsOpen && (
        <Card
          title={<span style={{ fontWeight: 700 }}><EnvironmentOutlined /> Office Attendance Settings</span>}
          style={{ marginBottom: 20 }}
          extra={<Button type="text" onClick={() => setSettingsOpen(false)}>✕</Button>}
        >
          <Form form={settingsForm} layout="vertical" onFinish={handleSaveSettings}>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={6}>
                <Form.Item name="officeLatitude" label="Office Latitude *"
                  rules={[{ required: true, message: 'Required' }]}>
                  <InputNumber style={{ width: '100%' }} placeholder="e.g. 12.971599" precision={6} step={0.000001} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Form.Item name="officeLongitude" label="Office Longitude *"
                  rules={[{ required: true, message: 'Required' }]}>
                  <InputNumber style={{ width: '100%' }} placeholder="e.g. 77.594566" precision={6} step={0.000001} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Form.Item name="geofenceRadiusM" label="Allowed Radius (meters)">
                  <InputNumber style={{ width: '100%' }} min={50} max={5000} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Form.Item name="lateThresholdTime" label="Late After">
                  <TimePicker format="HH:mm" style={{ width: '100%' }} minuteStep={5} />
                </Form.Item>
              </Col>
            </Row>
            <Space>
              <Button type="default" icon={<EnvironmentOutlined />} onClick={handleUseCurrentLocation}>
                Use Current Location
              </Button>
              <Button type="primary" htmlType="submit" loading={saving}>
                Save Settings
              </Button>
            </Space>
          </Form>
        </Card>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <DatePicker
          value={selectedDate}
          onChange={(d) => d && setSelectedDate(d)}
          format="DD MMM YYYY"
          picker={filterUserId ? 'month' : 'date'}
          allowClear={false}
          style={{ width: 180 }}
        />
        <Select
          placeholder="Filter by staff member"
          style={{ width: 220 }}
          allowClear
          value={filterUserId}
          onChange={setFilterUserId}
          showSearch
          filterOption={(input, option) =>
            ((option?.children as unknown) as string)?.toLowerCase().includes(input.toLowerCase())
          }
        >
          {users.map((u: any) => (
            <Option key={u.id} value={u.id}>{u.fullName} ({u.role})</Option>
          ))}
        </Select>
      </div>

      {/* Summary stats (daily view) */}
      {!filterUserId && records.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={8}>
            <Card size="small">
              <Statistic title="Present" value={present} valueStyle={{ color: '#16a34a', fontWeight: 700 }}
                prefix={<CheckCircleOutlined />} />
            </Card>
          </Col>
          <Col xs={8}>
            <Card size="small">
              <Statistic title="Late" value={late} valueStyle={{ color: '#d97706', fontWeight: 700 }}
                prefix={<ExclamationCircleOutlined />} />
            </Card>
          </Col>
          <Col xs={8}>
            <Card size="small">
              <Statistic title="Absent" value={absent} valueStyle={{ color: '#dc2626', fontWeight: 700 }}
                prefix={<CloseCircleOutlined />} />
            </Card>
          </Col>
        </Row>
      )}

      {/* Table */}
      <Spin spinning={attendanceLoading || userAttLoading}>
        <Table
          dataSource={records}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 50, hideOnSinglePage: true }}
          locale={{
            emptyText: filterUserId
              ? 'No attendance records for this month'
              : 'No records for this date — staff have not checked in yet',
          }}
        />
      </Spin>
    </div>
  );
};

export default AttendancePage;
