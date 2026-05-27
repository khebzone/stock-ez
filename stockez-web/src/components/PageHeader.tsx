import React from 'react';
import { Typography, Space, Grid } from 'antd';

const { Title, Text } = Typography;

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  count?: number;
  countLabel?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, action, count, countLabel }) => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 20,
    }}>
      <div style={{ minWidth: 0 }}>
        <Title level={4} style={{ margin: 0, color: '#1a1d2e', fontWeight: 800, fontSize: isMobile ? 18 : 22 }}>
          {title}
        </Title>
        <Space size={8} style={{ marginTop: 4, flexWrap: 'wrap' }}>
          {subtitle && <Text style={{ color: '#6b7280', fontSize: 13 }}>{subtitle}</Text>}
          {count !== undefined && (
            <span style={{
              background: '#ecfdf5', color: '#059669', fontSize: 12,
              fontWeight: 700, padding: '2px 10px', borderRadius: 20,
            }}>
              {count.toLocaleString('en-IN')} {countLabel || 'total'}
            </span>
          )}
        </Space>
      </div>
      {action && (
        <div style={{ flexShrink: 0, maxWidth: '100%' }}>
          {action}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
