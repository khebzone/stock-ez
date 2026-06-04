import React, { useState } from 'react';
import {
  Table, Button, DatePicker, Select, Tag, Space, Form, InputNumber,
  TimePicker, message, Spin, Alert, Card, Statistic, Row, Col, Grid,
} from 'antd';
import {
  SettingOutlined, ReloadOutlined, EnvironmentOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, DownloadOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import {
  useGetAttendanceSettingsQuery,
  useSaveAttendanceSettingsMutation,
  useGetAttendanceByDateQuery,
  useGetAttendanceByUserQuery,
  useLazyGetAttendanceByRangeQuery,
  useLazyGetAttendanceByUserQuery,
} from '../../store/api/attendanceApi';
import { useGetUsersQuery } from '../../store/api/userApi';

const { Option } = Select;
const { useBreakpoint } = Grid;

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
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const { data: settingsData, isLoading: settingsLoading } = useGetAttendanceSettingsQuery();
  const settings = settingsData?.data;

  const { data: usersData } = useGetUsersQuery();
  const users = (usersData?.data?.content || usersData?.data || []).filter((u: any) => u.active && u.roleName !== 'SUPER_ADMIN' && u.roleName !== 'ADMIN');

  const { data: attendanceData, isLoading: attendanceLoading, refetch } = useGetAttendanceByDateQuery(
    fmtDate(selectedDate),
    { skip: !!filterUserId }
  );

  const { data: userAttData, isLoading: userAttLoading } = useGetAttendanceByUserQuery(
    { userId: filterUserId!, from: fmtDate(selectedDate.startOf('month')), to: fmtDate(selectedDate.endOf('month')) },
    { skip: !filterUserId }
  );

  const [saveSettings, { isLoading: saving }] = useSaveAttendanceSettingsMutation();
  const [fetchRange] = useLazyGetAttendanceByRangeQuery();
  const [fetchUserRange] = useLazyGetAttendanceByUserQuery();
  const [exporting, setExporting] = useState(false);

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

  const handleExport = async () => {
    setExporting(true);
    try {
      const from = selectedDate.startOf('month').format('YYYY-MM-DD');
      const to = selectedDate.endOf('month').format('YYYY-MM-DD');
      const monthLabel = selectedDate.format('MMM YYYY');

      let allRecords: any[] = [];

      if (filterUserId) {
        const res = await fetchUserRange({ userId: filterUserId, from, to }).unwrap();
        const user = users.find((u: any) => u.id === filterUserId);
        allRecords = (res?.data || []).map((r: any) => ({
          ...r,
          userName: user?.fullName || r.userName || '',
          userRole: user?.roleName || r.userRole || '',
        }));
      } else {
        const res = await fetchRange({ from, to }).unwrap();
        allRecords = res?.data || [];
      }

      if (allRecords.length === 0) {
        message.warning('No attendance records to export for this period');
        return;
      }

      // Group by staff member
      const userMap = new Map<string, { name: string; role: string; records: any[] }>();
      allRecords.forEach((r: any) => {
        const key = r.userName;
        if (!userMap.has(key)) userMap.set(key, { name: r.userName, role: r.userRole, records: [] });
        userMap.get(key)!.records.push(r);
      });

      // Summary sheet
      const summaryRows = Array.from(userMap.values()).map(({ name, role, records: recs }) => {
        const present = recs.filter(r => r.status === 'PRESENT').length;
        const late    = recs.filter(r => r.status === 'LATE').length;
        const absent  = recs.filter(r => r.status === 'ABSENT').length;
        const absentDates = recs
          .filter(r => r.status === 'ABSENT')
          .sort((a, b) => a.attendanceDate.localeCompare(b.attendanceDate))
          .map(r => dayjs(r.attendanceDate).format('DD MMM YYYY'))
          .join(', ');
        return {
          'Name': name,
          'Role': role,
          'Present': present,
          'Late (counted as present)': late,
          'Absent': absent,
          'Total Tracked Days': present + late + absent,
          'Absent Dates': absentDates || '—',
        };
      });

      // Day-wise detail sheet
      const detailRows = [...allRecords]
        .sort((a, b) => a.attendanceDate.localeCompare(b.attendanceDate))
        .map((r: any) => ({
          'Date': dayjs(r.attendanceDate).format('DD MMM YYYY'),
          'Name': r.userName,
          'Role': r.userRole,
          'Status': r.status,
          'Check In': r.checkInTime ? dayjs(r.checkInTime).format('hh:mm A') : '—',
          'Check Out': r.checkOutTime ? dayjs(r.checkOutTime).format('hh:mm A') : '—',
        }));

      const wb = XLSX.utils.book_new();

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      wsSummary['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 24 }, { wch: 10 }, { wch: 20 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
      wsDetail['!cols'] = [{ wch: 16 }, { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsDetail, 'Day-wise Records');

      XLSX.writeFile(wb, `Attendance_${monthLabel}.xlsx`);
      message.success(`Attendance_${monthLabel}.xlsx downloaded`);
    } catch {
      message.error('Failed to export. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const statusCol = {
    title: 'Status',
    dataIndex: 'status',
    render: (s: string) => {
      const cfg = STATUS_CONFIG[s] || STATUS_CONFIG.ABSENT;
      return <Tag color={cfg.color}>{cfg.icon} {cfg.label}</Tag>;
    },
  };
  const checkInCol  = { title: 'Check In',  dataIndex: 'checkInTime',  render: fmt, align: 'right' as const };
  const checkOutCol = { title: 'Check Out', dataIndex: 'checkOutTime', render: fmt, align: 'right' as const };

  const columns = filterUserId ? [
    { title: 'Date', dataIndex: 'attendanceDate', render: (d: string) => dayjs(d).format('DD MMM YYYY') },
    statusCol,
    checkInCol,
    checkOutCol,
  ] : [
    {
      title: 'Name',
      dataIndex: 'userName',
      ...(isMobile ? { fixed: 'left' as const, width: 150 } : {}),
      sorter: (a: any, b: any) => a.userName.localeCompare(b.userName),
    },
    ...(!isMobile ? [{ title: 'Role', dataIndex: 'userRole', render: (r: string) => r }] : []),
    statusCol,
    checkInCol,
    checkOutCol,
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
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
            {!isMobile && 'Export Excel'}
          </Button>
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
            {!isMobile && 'Office Settings'}
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
          style={{ width: isMobile ? '100%' : 180 }}
        />
        <Select
          placeholder="Filter by staff member"
          style={{ width: isMobile ? '100%' : 220 }}
          allowClear
          value={filterUserId}
          onChange={setFilterUserId}
          showSearch
          filterOption={(input, option) =>
            ((option?.children as unknown) as string)?.toLowerCase().includes(input.toLowerCase())
          }
        >
          {users.map((u: any) => (
            <Option key={u.id} value={u.id}>{u.fullName} ({u.roleName})</Option>
          ))}
        </Select>
      </div>

      {/* Summary stats (daily view) */}
      {!filterUserId && records.length > 0 && (
        isMobile ? (
          <div style={{ display: 'flex', marginBottom: 16, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '10px 4px', borderRight: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{present}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Present</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '10px 4px', borderRight: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>{late}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Late</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '10px 4px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{absent}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Absent</div>
            </div>
          </div>
        ) : (
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
        )
      )}

      {/* Table */}
      <Spin spinning={attendanceLoading || userAttLoading}>
        <Table
          dataSource={records}
          columns={columns}
          rowKey="id"
          scroll={{ x: 480 }}
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
