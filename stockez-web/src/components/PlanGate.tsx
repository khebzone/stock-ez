import React from 'react';
import { LockOutlined, CheckOutlined } from '@ant-design/icons';
import { hasPlan, getCurrentPlan, PLAN_META, type RequiredPlan } from '../utils/planGate';

const PlanGate: React.FC<{ required: RequiredPlan; children: React.ReactNode }> = ({ required, children }) => {
  if (hasPlan(required)) return <>{children}</>;

  const meta = PLAN_META[required];
  const currentPlan = getCurrentPlan();

  return (
    <div style={{ position: 'relative', minHeight: 480, overflow: 'hidden' }}>
      <div style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.3 }}>
        {children}
      </div>

      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(248,250,252,0.55)',
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
          padding: '40px 48px',
          textAlign: 'center',
          maxWidth: 440,
          width: '90%',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12,
            background: '#f1f5f9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <LockOutlined style={{ fontSize: 24, color: '#64748b' }} />
          </div>

          <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
            {meta.label} Plan Required
          </div>
          <div style={{ fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 1.7 }}>
            This feature is available on the <strong>{meta.label}</strong> plan ({meta.price}) and above.
          </div>

          <div style={{ textAlign: 'left', marginBottom: 28, background: '#f8fafc', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Included in {meta.label}
            </div>
            {meta.features.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, color: '#374151' }}>
                <CheckOutlined style={{ color: '#059669', fontSize: 12, flexShrink: 0 }} />
                {f}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 13, color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
            Your current plan: <strong style={{ color: '#1e293b' }}>{currentPlan}</strong>
            <br />
            Contact your StockEz account manager to upgrade.
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanGate;
