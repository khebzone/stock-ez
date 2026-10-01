import React from 'react';
import dayjs from 'dayjs';
import AttendanceSelfCheckIn from '../../components/AttendanceSelfCheckIn';

const AttendanceCheckInPage: React.FC = () => {
  const today = dayjs().format('DD MMM YYYY');

  return (
    <div style={{ maxWidth: 440, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{today}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
          Attendance
        </div>
      </div>
      <AttendanceSelfCheckIn />
    </div>
  );
};

export default AttendanceCheckInPage;
