import React from 'react';
import { Row, Col, Typography, Space } from 'antd';

const { Title, Text } = Typography;

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  count?: number;
  countLabel?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, action, count, countLabel }) => (
  <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
    <Col>
      <Title level={4} style={{ margin: 0, color: '#1a1d2e', fontWeight: 800, fontSize: 22 }}>
        {title}
      </Title>
      <Space size={8} style={{ marginTop: 4 }}>
        {subtitle && <Text style={{ color: '#6b7280', fontSize: 14 }}>{subtitle}</Text>}
        {count !== undefined && (
          <span style={{
            background: '#ecfdf5', color: '#059669', fontSize: 12,
            fontWeight: 700, padding: '2px 10px', borderRadius: 20,
          }}>
            {count.toLocaleString('en-IN')} {countLabel || 'total'}
          </span>
        )}
      </Space>
    </Col>
    {action && <Col>{action}</Col>}
  </Row>
);

export default PageHeader;
