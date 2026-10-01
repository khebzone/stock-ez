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
} from '../store/api/attendanceApi';

const STATUS_COLORS: Record<string, string> = {
  PRESENT: '#16a34a',
  LATE: '#d97706',
  ABSENT: '#94a3b8',
};

interface AttendanceSelfCheckInProps {
  /** Renders as a plain block for embedding inside an existing Card, instead of its own bordered card */
  compact?: boolean;
}

const AttendanceSelfCheckIn: React.FC<AttendanceSelfCheckInProps> = ({ compact }) => {
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

  if (isLoading) return <Spin style={{ display: 'block', margin: '20px 0' }} />;

  const busy = locating || checkingIn || checkingOut;

  if (!status?.configured) {
    return (
      <Alert
        type="warning"
        message="Attendance not configured"
        description="Your admin has not set up the office location yet. Configure it above to enable check-in."
        showIcon
      />
    );
  }

  return (
    <div>
      {/* Status card */}
      <div style={{
        background: compact ? '#f8fafc' : '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: compact ? '20px 16px' : '28px 24px',
        textAlign: 'center',
        marginBottom: 16,
      }}>
        {!status?.checkedIn ? (
          <>
            <div style={{
              width: compact ? 48 : 64, height: compact ? 48 : 64, borderRadius: '50%',
              background: '#f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
            }}>
              <ClockCircleOutlined style={{ fontSize: compact ? 22 : 28, color: '#94a3b8' }} />
            </div>
            <div style={{ fontSize: compact ? 14 : 16, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
              Not checked in
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              Your location will be verified when you check in
            </div>
          </>
        ) : (
          <>
            <div style={{
              width: compact ? 48 : 64, height: compact ? 48 : 64, borderRadius: '50%',
              background: STATUS_COLORS[status.status || 'PRESENT'] + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
            }}>
              <CheckCircleOutlined style={{ fontSize: compact ? 22 : 28, color: STATUS_COLORS[status.status || 'PRESENT'] }} />
            </div>
            <div style={{
              fontSize: compact ? 15 : 18, fontWeight: 700,
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
          size={compact ? 'middle' : 'large'}
          block
          icon={<LoginOutlined />}
          loading={busy}
          onClick={handleCheckIn}
          style={compact ? undefined : { height: 52, fontSize: 15, fontWeight: 700, borderRadius: 10 }}
        >
          {locating ? 'Getting your location…' : 'Check In'}
        </Button>
      )}

      {status?.checkedIn && !status?.checkedOut && (
        <Button
          size={compact ? 'middle' : 'large'}
          block
          icon={<LogoutOutlined />}
          loading={checkingOut}
          onClick={handleCheckOut}
          style={compact ? undefined : { height: 52, fontSize: 15, fontWeight: 700, borderRadius: 10, borderColor: '#e2e8f0' }}
        >
          Check Out
        </Button>
      )}

      {status?.checkedIn && status?.checkedOut && (
        compact ? (
          <div style={{ textAlign: 'center', fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
            You're done for today
          </div>
        ) : (
          <Result
            status="success"
            title="You're done for today"
            subTitle={`Checked in at ${dayjs(status.checkInTime).format('hh:mm A')} · Checked out at ${dayjs(status.checkOutTime).format('hh:mm A')}`}
          />
        )
      )}

      {/* Location note */}
      {!status?.checkedIn && (
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <EnvironmentOutlined />
          You must be at the office to check in
        </div>
      )}
    </div>
  );
};

export default AttendanceSelfCheckIn;
