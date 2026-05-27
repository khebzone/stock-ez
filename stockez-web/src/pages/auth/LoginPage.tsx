import React, { useEffect, useRef, useState } from 'react';
import { Form, Input, Button, Modal } from 'antd';
import { UserOutlined, LockOutlined, CloseOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLoginMutation } from '../../store/api/authApi';

const LoginPage: React.FC = () => {
  const [login, { isLoading }] = useLoginMutation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loginError, setLoginError] = useState<string>('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);

  // Subtle orb drift animation
  useEffect(() => {
    let frame: number;
    let t = 0;
    const animate = () => {
      t += 0.004;
      if (orb1Ref.current) {
        orb1Ref.current.style.transform = `translate(${Math.sin(t) * 30}px, ${Math.cos(t * 0.7) * 20}px)`;
      }
      if (orb2Ref.current) {
        orb2Ref.current.style.transform = `translate(${Math.cos(t * 0.8) * 25}px, ${Math.sin(t * 1.1) * 18}px)`;
      }
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(frame);
  }, []);

  const onFinish = async (values: any) => {
    setLoginError('');
    try {
      const response = await login({ username: values.username, password: values.password }).unwrap();
      if (response.success && response.data) {
        localStorage.setItem('token', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        localStorage.setItem('tenantId', response.data.user.tenantId);
        localStorage.setItem('userId', response.data.user.id);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        const role = response.data.user.role;
        if (role === 'SALES') {
          navigate('/sales/dashboard');
        } else if (role === 'INVOICE') {
          navigate('/invoice/approver');
        } else if (role === 'DELIVERY') {
          navigate('/delivery/dashboard');
        } else if (role === 'WAREHOUSE') {
          navigate('/orders');
        } else {
          navigate('/dashboard');
        }
      } else {
        setLoginError(response.message || 'Login failed');
      }
    } catch (err: any) {
      // Always show a clean message regardless of backend error type
      const code = err.data?.errorCode;
      if (code === 'VALIDATION_ERROR' || code === 'INVALID_CREDENTIALS' || code === 'INVALID_SUBDOMAIN') {
        setLoginError('Incorrect username or password. Please try again.');
      } else if (code === 'TENANT_SUSPENDED') {
        setLoginError('Your account is suspended. Please contact support.');
      } else {
        setLoginError(err.data?.message || 'Incorrect username or password. Please try again.');
      }
    }
  };

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(5,150,105,0.4); }
          70%  { box-shadow: 0 0 0 12px rgba(5,150,105,0); }
          100% { box-shadow: 0 0 0 0 rgba(5,150,105,0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        .lp-root {
          min-height: 100vh;
          display: flex;
          font-family: 'Inter', -apple-system, sans-serif;
          background: #fff;
        }

        /* ── LEFT PANEL ── */
        .lp-left {
          flex: 1; min-width: 0;
          background: #0a1628;
          position: relative; overflow: hidden;
          display: flex; flex-direction: column;
          justify-content: center;
          padding: 60px 56px;
          animation: fadeIn 0.6s ease;
        }
        .lp-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          transition: transform 0.1s linear;
        }
        .lp-orb-1 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(5,150,105,0.35) 0%, transparent 70%);
          top: -60px; left: -80px;
        }
        .lp-orb-2 {
          width: 360px; height: 360px;
          background: radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%);
          bottom: -60px; right: -40px;
        }
        .lp-grid-overlay {
          position: absolute; inset: 0; opacity: 0.03;
          background-image:
            linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px);
          background-size: 64px 64px;
          pointer-events: none;
        }
        .lp-logo {
          position: absolute; top: 40px; left: 56px;
          display: flex; align-items: center; gap: 10px;
          animation: fadeSlideIn 0.5s ease 0.1s both;
        }
        .lp-logo-icon {
          width: 38px; height: 38px; border-radius: 11px;
          background: linear-gradient(135deg, #059669, #047857);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 16px rgba(5,150,105,0.45);
          animation: pulse-ring 3s ease infinite;
        }
        .lp-left-content { position: relative; z-index: 1; max-width: 520px; }
        .lp-pill {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(5,150,105,0.1); border: 1px solid rgba(5,150,105,0.2);
          border-radius: 100px; padding: 6px 16px; margin-bottom: 32px;
          animation: fadeSlideIn 0.5s ease 0.2s both;
        }
        .lp-pill-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px #10b981, 0 0 16px rgba(16,185,129,0.4);
        }
        .lp-h1 {
          color: #fff; font-weight: 800; font-size: 40px;
          line-height: 1.18; margin: 0 0 20px; letter-spacing: -0.8px;
          animation: fadeSlideIn 0.5s ease 0.3s both;
        }
        .lp-h1 .gradient-text {
          background: linear-gradient(90deg, #059669, #10b981, #34d399);
          background-size: 200% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          animation: shimmer 3s linear infinite;
        }
        .lp-desc {
          color: rgba(255,255,255,0.42); font-size: 15px;
          line-height: 1.72; margin: 0 0 44px; max-width: 420px;
          animation: fadeSlideIn 0.5s ease 0.4s both;
        }
        .lp-features {
          display: flex; flex-direction: column; gap: 12px;
          animation: fadeSlideIn 0.5s ease 0.5s both;
        }
        .lp-feature {
          display: flex; gap: 14px; align-items: center;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px; padding: 14px 18px;
          backdrop-filter: blur(8px);
          transition: background 0.25s, border-color 0.25s, transform 0.25s;
          cursor: default;
        }
        .lp-feature:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(5,150,105,0.25);
          transform: translateX(4px);
        }
        .lp-feature-icon {
          width: 38px; height: 38px; border-radius: 11px;
          display: flex; align-items: center; justify-content: center;
          font-size: 19px; flex-shrink: 0;
        }
        .lp-stats {
          display: flex; gap: 0;
          margin-top: 48px; padding-top: 28px;
          border-top: 1px solid rgba(255,255,255,0.07);
          position: relative; z-index: 1;
          animation: fadeSlideIn 0.5s ease 0.6s both;
        }
        .lp-stat { flex: 1; border-right: 1px solid rgba(255,255,255,0.07); padding-right: 24px; }
        .lp-stat:last-child { border-right: none; }
        .lp-stat:not(:first-child) { padding-left: 24px; }
        .lp-stat-value {
          font-weight: 800; font-size: 22px;
          background: linear-gradient(90deg, #fff, rgba(255,255,255,0.65));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .lp-stat-label { color: rgba(255,255,255,0.28); font-size: 11px; margin-top: 3px; font-weight: 500; }

        /* ── RIGHT PANEL ── */
        .lp-right {
          width: 480px; flex-shrink: 0;
          display: flex; flex-direction: column;
          justify-content: center; align-items: center;
          padding: 48px 44px;
          background: #f8fafc;
          border-left: 1px solid #edf0f4;
        }
        .lp-form-wrap {
          width: 100%; max-width: 380px;
          animation: fadeSlideIn 0.6s ease 0.15s both;
        }
        .lp-form-header { margin-bottom: 36px; }
        .lp-form-header h2 {
          margin: 0 0 6px; font-weight: 800; font-size: 27px;
          color: #0f172a; letter-spacing: -0.4px;
        }
        .lp-form-header p { margin: 0; color: #94a3b8; font-size: 14px; }

        /* Input styles */
        .lp-form .ant-form-item-label > label {
          font-size: 13px !important; font-weight: 600 !important; color: #475569 !important;
          text-transform: none !important;
        }
        .lp-form .ant-input-affix-wrapper,
        .lp-form .ant-input {
          height: 50px !important; border-radius: 12px !important;
          border: 1.5px solid #e2e8f0 !important;
          font-size: 14px !important; background: #fff !important;
          transition: all 0.2s !important;
        }
        .lp-form .ant-input-affix-wrapper:hover,
        .lp-form .ant-input:hover {
          border-color: #cbd5e1 !important;
        }
        .lp-form .ant-input-affix-wrapper-focused,
        .lp-form .ant-input-affix-wrapper:focus-within,
        .lp-form .ant-input:focus {
          border-color: #059669 !important;
          box-shadow: 0 0 0 3px rgba(5,150,105,0.1) !important;
          background: #fff !important;
        }
        .lp-form .ant-input-affix-wrapper .ant-input {
          height: auto !important; border: none !important; box-shadow: none !important;
        }
        .lp-form .ant-input-prefix { color: #94a3b8 !important; margin-right: 8px; }

        .lp-btn {
          height: 50px !important; border-radius: 12px !important;
          font-size: 15px !important; font-weight: 700 !important;
          background: linear-gradient(135deg, #059669, #047857) !important;
          border: none !important;
          box-shadow: 0 4px 18px rgba(5,150,105,0.38) !important;
          letter-spacing: 0.3px;
          transition: all 0.22s !important;
        }
        .lp-btn:hover:not(:disabled) {
          box-shadow: 0 6px 28px rgba(5,150,105,0.55) !important;
          transform: translateY(-2px);
        }
        .lp-btn:active:not(:disabled) { transform: translateY(0); }

        .lp-divider { height: 1px; background: #e8ecf0; margin: 28px 0; }
        .lp-trust {
          display: flex; justify-content: center; gap: 8px;
          flex-wrap: wrap; margin-top: 24px;
        }
        .lp-trust-badge {
          display: flex; align-items: center; gap: 5px;
          background: #fff; border: 1px solid #e2e8f0;
          border-radius: 8px; padding: 5px 11px;
          font-size: 11px; color: #64748b; font-weight: 500;
        }
        .lp-footer { margin-top: 32px; text-align: center; color: #94a3b8; font-size: 12px; }

        @media (max-width: 960px) {
          .lp-left { display: none !important; }
          .lp-right { width: 100%; border-left: none; background: #fff; }
          .lp-mobile-logo { display: flex !important; }
        }
      `}</style>

      <div className="lp-root">
        {/* ── LEFT BRAND PANEL ── */}
        <div className="lp-left">
          <div ref={orb1Ref} className="lp-orb lp-orb-1" />
          <div ref={orb2Ref} className="lp-orb lp-orb-2" />
          <div className="lp-grid-overlay" />

          <div className="lp-logo">
            <div className="lp-logo-icon">
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>D</span>
            </div>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 18, letterSpacing: -0.3 }}>StockEz</span>
          </div>

          <div className="lp-left-content">
            <div className="lp-pill">
              <div className="lp-pill-dot" />
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 500 }}>
                Trusted by 500+ FMCG Distributors
              </span>
            </div>

            <h1 className="lp-h1">
              The smarter way to<br />run <span className="gradient-text">distribution.</span>
            </h1>

            <p className="lp-desc">
              Purpose-built for FMCG distributors in India. GST-ready invoicing, route management, real-time analytics and collections — all in one platform.
            </p>

            <div className="lp-features">
              {[
                { icon: '📦', title: 'Order & Route Management', desc: 'Plan routes, assign salesmen, track orders in real-time.', bg: 'rgba(5,150,105,0.15)' },
                { icon: '🧾', title: 'GST-Ready Invoicing', desc: 'Auto-generate tax invoices with CGST/SGST & HSN codes.', bg: 'rgba(16,185,129,0.15)' },
                { icon: '💰', title: 'Collection Tracking', desc: 'Cash, UPI & cheque collections tracked per salesman daily.', bg: 'rgba(245,158,11,0.15)' },
                { icon: '📊', title: 'Business Analytics', desc: 'Revenue trends, order pipeline & actionable insights.', bg: 'rgba(139,92,246,0.15)' },
              ].map((f, i) => (
                <div className="lp-feature" key={i}>
                  <div className="lp-feature-icon" style={{ background: f.bg }}>{f.icon}</div>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{f.title}</div>
                    <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12, lineHeight: 1.5 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="lp-stats">
              {[{ value: '500+', label: 'Distributors' }, { value: '10K+', label: 'Orders / Day' }, { value: '99.9%', label: 'Uptime SLA' }].map((s, i) => (
                <div className="lp-stat" key={i}>
                  <div className="lp-stat-value">{s.value}</div>
                  <div className="lp-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT LOGIN FORM ── */}
        <div className="lp-right">
          <div className="lp-form-wrap">
            {/* Mobile logo */}
            <div className="lp-mobile-logo" style={{ display: 'none', alignItems: 'center', gap: 10, marginBottom: 36 }}>
              <div className="lp-logo-icon">
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 17 }}>D</span>
              </div>
              <span style={{ fontWeight: 800, fontSize: 18, color: '#0f172a' }}>StockEz</span>
            </div>

            <div className="lp-form-header">
              <h2>Welcome back</h2>
              <p>Sign in to your distribution workspace</p>
            </div>

            {loginError && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: '#fff1f2', border: '1.5px solid #fecdd3',
                borderRadius: 10, padding: '12px 14px', marginBottom: 20,
              }}>
                <CloseOutlined style={{ color: '#ef4444', marginTop: 2, flexShrink: 0 }} />
                <span style={{ color: '#be123c', fontSize: 13, fontWeight: 500, flex: 1 }}>
                  {loginError}
                </span>
                <CloseOutlined
                  style={{ color: '#f87171', cursor: 'pointer', flexShrink: 0, fontSize: 11 }}
                  onClick={() => setLoginError('')}
                />
              </div>
            )}

            <Form
              name="login"
              onFinish={onFinish}
              layout="vertical"
              requiredMark={false}
              className="lp-form"
              form={form}
            >
              <Form.Item
                name="username"
                label="Username"
                rules={[{ required: true, message: 'Enter your username' }]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="Phone number or email"
                  size="large"
                  autoComplete="username"
                  autoFocus
                />
              </Form.Item>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Password</label>
                <span
                  style={{ color: '#059669', fontWeight: 600, fontSize: 12, cursor: 'pointer', textDecoration: 'none' }}
                  onClick={() => setForgotOpen(true)}
                >
                  Forgot password?
                </span>
              </div>
              <Form.Item
                name="password"
                rules={[{ required: true, message: 'Enter your password' }]}
                style={{ marginBottom: 28 }}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Enter your password"
                  size="large"
                  autoComplete="current-password"
                />
              </Form.Item>

              <Form.Item style={{ marginTop: 8, marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={isLoading}
                  className="lp-btn"
                  size="large"
                >
                  {isLoading ? 'Signing in...' : 'Sign In →'}
                </Button>
              </Form.Item>
            </Form>

            <div className="lp-divider" />

            <div className="lp-trust">
              {['256-bit SSL', 'GST Compliant', 'Made in India'].map((b, i) => (
                <div className="lp-trust-badge" key={i}>
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="#10b981">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {b}
                </div>
              ))}
            </div>

            <div className="lp-footer">
              StockEz &copy; 2025 &middot; Enterprise Distribution Platform
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={forgotOpen}
        onCancel={() => setForgotOpen(false)}
        footer={<Button type="primary" style={{ background: '#059669', borderColor: '#059669' }} onClick={() => setForgotOpen(false)}>Got it</Button>}
        title={null}
        width={420}
        centered
      >
        <div style={{ padding: '8px 0' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <InfoCircleOutlined style={{ color: '#059669', fontSize: 22 }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#0f172a', marginBottom: 4 }}>Forgot your password?</div>
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                Password resets are managed by your system administrator.
              </div>
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { step: '1', text: 'Note your username (phone number or email)' },
              { step: '2', text: 'Contact your StockEz administrator' },
              { step: '3', text: 'Admin resets your password from Team Management → Users' },
              { step: '4', text: 'Log in with the new password and change it in Settings' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#059669', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  {s.step}
                </div>
                <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{s.text}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
            Already know your password? You can change it from <strong>Settings → Change Password</strong> after logging in.
          </div>
        </div>
      </Modal>
    </>
  );
};

export default LoginPage;
