import React, { useState } from 'react';
import { Button, Modal, Timeline, Typography, Spin, Empty, Tag } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { useGetAuditHistoryQuery } from '../store/api/auditApi';
import dayjs from 'dayjs';

const { Text } = Typography;

const ACTION_COLOR: Record<string, string> = {
  CREATED: 'green',
  UPDATED: 'blue',
  DELETED: 'red',
  DEACTIVATED: 'orange',
  APPROVED: 'blue',
  PACKING: 'cyan',
  PACKED: 'cyan',
  ASSIGNED: 'purple',
  DISPATCHED: 'geekblue',
  DELIVERED: 'green',
  CANCELLED: 'red',
  PAYMENT_COLLECTED: 'gold',
  PAYMENT_CLEARED: 'green',
};

interface Props {
  entityType: string;
  entityId: string;
  title?: string;
}

const AuditHistoryContent: React.FC<{ entityType: string; entityId: string }> = ({ entityType, entityId }) => {
  const { data, isLoading } = useGetAuditHistoryQuery({ entityType, entityId });

  if (isLoading) return <Spin style={{ display: 'block', textAlign: 'center', padding: 32 }} />;

  const logs: any[] = data?.data ?? [];
  if (!logs.length) return <Empty description="No audit history" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  return (
    <Timeline
      style={{ marginTop: 8 }}
      items={logs.map((log: any) => ({
        color: ACTION_COLOR[log.action] ?? 'blue',
        children: (
          <>
            <div style={{ marginBottom: 2 }}>
              <Tag color={ACTION_COLOR[log.action] ?? 'blue'} style={{ fontSize: 11, marginRight: 8 }}>
                {log.action}
              </Tag>
              <Text style={{ fontSize: 13 }}>{log.description}</Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {log.performedBy}
                {log.performedAt && (
                  <> &middot; {dayjs(log.performedAt).format('DD MMM YYYY, h:mm A')}</>
                )}
              </Text>
            </div>
          </>
        ),
      }))}
    />
  );
};

const AuditHistoryButton: React.FC<Props> = ({ entityType, entityId, title = 'Audit History' }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="text"
        size="small"
        icon={<HistoryOutlined />}
        onClick={() => setOpen(true)}
        title="Audit History"
      />
      <Modal
        title={title}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={560}
        destroyOnClose
      >
        {open && <AuditHistoryContent entityType={entityType} entityId={entityId} />}
      </Modal>
    </>
  );
};

export default AuditHistoryButton;
