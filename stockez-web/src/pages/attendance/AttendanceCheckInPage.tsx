import React, { useState } from 'react';
import { Button, message, Spin, Alert, Result } from 'antd';
import {
  EnvironmentOutlined, CheckCircleOutlined, ClockCircleOutlined,
  LoginOutlined, LogoutOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetTodayStatusQuery,
  useCheckInMutation,
  useCheckOutMutation,
} from '../../store/api/attendanceApi';

const STATUS_COLORS: Record<string, string> = {
  PRESENT: '#16a34a',
  LATE: '#d97706',
  ABSENT: '#94a3b8',
};

const AttendanceCheckInPage: React.FC = () => {
  const [locating, setLocating] = useState(false);

  const { data: statusData, isLoading, refetch } = useGetTodayStatusQuery();
  const status = statusData?.data;

  const [checkIn, { isLoading: checkingIn }] = useCheckInMutation();
  const [checkOut, { isLoading: checkingOut }] = useCheckOutMutation();

  const handleCheckIn = () => {
    if (!navigator.geolocation) {
      message.error('Geolocation is not supported by your browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocating(false);
        try {
          await checkIn({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }).unwrap();
          message.success('Checked in successfully');
          refetch();
        } catch (err: any) {
          message.error(err?.data?.message || 'Check-in failed');
        }
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          message.error('Location permission denied. Please allow location access and try again.');
        } else {
          message.error('Could not get your location. Try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleCheckOut = async () => {
    try {
      await checkOut().unwrap();
      message.success('Checked out successfully');
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Check-out failed');
    }
  };

  if (isLoading) return <Spin style={{ display: 'block', marginTop: 80 }} />;

  const today = dayjs().format('DD MMM YYYY');
  const busy = locating || checkingIn || checkingOut;

  if (!status?.configured) {
    return (
      <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center', padding: '0 16px' }}>
        <Alert
          type="warning"
          message="Attendance not configured"
          description="Your admin has not set up the office location yet. Please contact your admin to configure attendance settings."
          showIcon
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 440, margin: '40px auto', padding: '0 16px' }}>
      {/* Date header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{today}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
          Attendance
        </div>
      </div>

      {/* Status card */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '28px 24px',
        textAlign: 'center',
        marginBottom: 24,
      }}>
        {!status?.checkedIn ? (
          <>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: '#f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <ClockCircleOutlined style={{ fontSize: 28, color: '#94a3b8' }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
              Not checked in
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              Your location will be verified when you check in
            </div>
          </>
        ) : (
          <>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: STATUS_COLORS[status.status || 'PRESENT'] + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <CheckCircleOutlined style={{ fontSize: 28, color: STATUS_COLORS[status.status || 'PRESENT'] }} />
            </div>
            <div style={{
              fontSize: 18, fontWeight: 700,
              color: STATUS_COLORS[status.status || 'PRESENT'],
              marginBottom: 4,
            }}>
              {status.status === 'LATE' ? 'Checked In (Late)' : 'Checked In'}
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              Check-in: {dayjs(status.checkInTime).format('hh:mm A')}
            </div>
            {status.checkedOut && (
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                Check-out: {dayjs(status.checkOutTime).format('hh:mm A')}
              </div>
            )}
          </>
        )}
      </div>

      {/* Action button */}
      {!status?.checkedIn && (
        <Button
          type="primary"
          size="large"
          block
          icon={<LoginOutlined />}
          loading={busy}
          onClick={handleCheckIn}
          style={{ height: 52, fontSize: 15, fontWeight: 700, borderRadius: 10 }}
        >
          {locating ? 'Getting your location…' : 'Check In'}
        </Button>
      )}

      {status?.checkedIn && !status?.checkedOut && (
        <Button
          size="large"
          block
          icon={<LogoutOutlined />}
          loading={checkingOut}
          onClick={handleCheckOut}
          style={{ height: 52, fontSize: 15, fontWeight: 700, borderRadius: 10, borderColor: '#e2e8f0' }}
        >
          Check Out
        </Button>
      )}

      {status?.checkedIn && status?.checkedOut && (
        <Result
          status="success"
          title="You're done for today"
          subTitle={`Checked in at ${dayjs(status.checkInTime).format('hh:mm A')} · Checked out at ${dayjs(status.checkOutTime).format('hh:mm A')}`}
        />
      )}

      {/* Location note */}
      {!status?.checkedIn && (
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <EnvironmentOutlined />
          You must be at the office to check in
        </div>
      )}
    </div>
  );
};

export default AttendanceCheckInPage;
