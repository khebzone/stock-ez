import React, { useEffect, useRef, useState } from 'react';
import { Form, Input, Button, Modal } from 'antd';
import { UserOutlined, LockOutlined, CloseOutlined, InfoCircleOutlined, ArrowRightOutlined, CheckCircleFilled } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLoginMutation } from '../../store/api/authApi';
import { getDefaultRoute } from '../../utils/permissions';

const FEATURES = [
  { icon: '📦', title: 'Smart Order & Route Management', desc: 'Plan routes, assign salesmen, track orders live.' },
  { icon: '🧾', title: 'GST-Ready Invoicing', desc: 'Auto-generate tax invoices with CGST/SGST & HSN.' },
  { icon: '💰', title: 'Collection Tracking', desc: 'Cash, UPI & cheque collections per salesman daily.' },
  { icon: '📊', title: 'Business Analytics', desc: 'Revenue trends, pipeline & actionable insights.' },
];

function useCountUp(target: number, decimals: number, active: boolean) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start: number | null = null;
    const duration = 2000;
    const raf = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      setVal(parseFloat((ease * target).toFixed(decimals)));
      if (p < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [active, target, decimals]);
  return val;
}

const LoginPage: React.FC = () => {
  const [login, { isLoading }] = useLoginMutation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loginError, setLoginError] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [usernameReadOnly, setUsernameReadOnly] = useState(true);
  const [shakeForm, setShakeForm] = useState(false);
  const [statsActive, setStatsActive] = useState(false);
  const [typedIdx, setTypedIdx] = useState(0);
  const statsRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headline = 'distribution.';

  const c1 = useCountUp(500, 0, statsActive);
  const c2 = useCountUp(10, 0, statsActive);
  const c3 = useCountUp(99.9, 1, statsActive);

  // Typewriter
  useEffect(() => {
    if (typedIdx >= headline.length) return;
    const t = setTimeout(() => setTypedIdx(i => i + 1), 90);
    return () => clearTimeout(t);
  }, [typedIdx]);

  // Canvas mesh gradient animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf: number;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const pts = Array.from({ length: 6 }, (_, i) => ({
      x: (i % 3) * 0.5 + 0.1 + Math.random() * 0.2,
      y: Math.floor(i / 3) * 0.7 + 0.1 + Math.random() * 0.2,
      vx: (Math.random() - 0.5) * 0.0004,
      vy: (Math.random() - 0.5) * 0.0004,
      color: [
        [5, 150, 105],
        [4, 120, 87],
        [16, 185, 129],
        [6, 78, 59],
        [52, 211, 153],
        [4, 100, 70],
      ][i],
    }));

    const draw = () => {
      t += 0.005;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // dark base
      ctx.fillStyle = '#060e1a';
      ctx.fillRect(0, 0, w, h);

      // animated radial blobs
      pts.forEach(p => {
        p.x += p.vx + Math.sin(t + p.y * 10) * 0.0002;
        p.y += p.vy + Math.cos(t + p.x * 8) * 0.0002;
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
        const [r, g, b] = p.color;
        const grd = ctx.createRadialGradient(p.x * w, p.y * h, 0, p.x * w, p.y * h, w * 0.45);
        grd.addColorStop(0, `rgba(${r},${g},${b},0.28)`);
        grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
      });

      // subtle noise dots
      for (let i = 0; i < 80; i++) {
        const x = ((Math.sin(i * 1.7 + t * 0.3) + 1) / 2) * w;
        const y = ((Math.cos(i * 2.3 + t * 0.2) + 1) / 2) * h;
        const a = (Math.sin(t + i) + 1) / 2 * 0.25 + 0.05;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(16,185,129,${a})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  // Stats intersection
  useEffect(() => {
    if (!statsRef.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsActive(true); }, { threshold: 0.2 });
    obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  const onFinish = async (values: any) => {
    setLoginError('');
    try {
      const res = await login({ username: values.username, password: values.password }).unwrap();
      if (res.success && res.data) {
        localStorage.setItem('token', res.data.accessToken);
        localStorage.setItem('refreshToken', res.data.refreshToken);
        localStorage.setItem('tenantId', res.data.user.tenantId);
        localStorage.setItem('userId', res.data.user.id);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        navigate(getDefaultRoute());
      } else {
        setLoginError(res.message || 'Login failed');
        setShakeForm(true); setTimeout(() => setShakeForm(false), 500);
      }
    } catch (err: any) {
      const code = err.data?.errorCode;
      if (['VALIDATION_ERROR', 'INVALID_CREDENTIALS', 'INVALID_SUBDOMAIN'].includes(code)) {
        setLoginError('Incorrect username or password.');
      } else if (code === 'TENANT_SUSPENDED') {
        setLoginError('Account suspended. Contact support.');
      } else {
        setLoginError(err.data?.message || 'Incorrect username or password.');
      }
      setShakeForm(true); setTimeout(() => setShakeForm(false), 500);
    }
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        @keyframes fadeUp   { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
        @keyframes shimmer  { 0%,100% { background-position:0% 50%; } 50% { background-position:100% 50%; } }
        @keyframes pulseDot { 0%,100% { box-shadow:0 0 0 0 rgba(16,185,129,.6); } 70% { box-shadow:0 0 0 8px rgba(16,185,129,0); } }
        @keyframes shake    { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
        @keyframes blink    { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes slideInCard { from{opacity:0;transform:translateX(30px)} to{opacity:1;transform:translateX(0)} }
        @keyframes ripple   { to { transform:scale(4); opacity:0; } }
        @keyframes floatBadge { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }

        .lp-wrap {
          min-height: 100vh; display: flex;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background: #060e1a;
        }

        /* ─── LEFT ─── */
        .lp-left {
          flex: 1; min-width: 0; position: relative; overflow: hidden;
          display: flex; flex-direction: column; padding: 0;
        }
        .lp-canvas {
          position: absolute; inset: 0; width: 100%; height: 100%;
        }
        .lp-left-inner {
          position: relative; z-index: 2;
          display: flex; flex-direction: column; height: 100%;
          padding: 44px 52px 44px;
        }

        /* Logo */
        .lp-logo {
          display: flex; align-items: center; gap: 12px;
          animation: fadeUp .5s ease .05s both;
        }
        .lp-logo-mark {
          width: 42px; height: 42px; border-radius: 12px;
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 0 0 rgba(5,150,105,.5);
          animation: pulseDot 2.5s ease infinite;
          flex-shrink: 0;
        }
        .lp-logo-text {
          font-size: 18px; font-weight: 800; color: #fff; letter-spacing: -.3px;
        }

        /* Center content */
        .lp-hero {
          flex: 1; display: flex; flex-direction: column; justify-content: center;
          max-width: 540px;
        }
        .lp-badge {
          display: inline-flex; align-items: center; gap: 8px;
          border: 1px solid rgba(16,185,129,.25);
          background: rgba(16,185,129,.07);
          border-radius: 100px; padding: 5px 14px;
          width: fit-content; margin-bottom: 28px;
          animation: fadeUp .5s ease .15s both;
        }
        .lp-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
          animation: pulseDot 2s ease infinite;
        }
        .lp-badge span { color: rgba(255,255,255,.6); font-size: 12px; font-weight: 500; }

        .lp-headline {
          font-size: 46px; font-weight: 800; color: #fff;
          line-height: 1.15; letter-spacing: -1px; margin: 0 0 18px;
          animation: fadeUp .5s ease .25s both;
        }
        .lp-headline-accent {
          background: linear-gradient(90deg, #10b981, #34d399, #6ee7b7, #10b981);
          background-size: 300% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          animation: shimmer 3.5s linear infinite;
        }
        .lp-cursor {
          display: inline-block; width: 3px; height: .85em;
          background: #10b981; vertical-align: middle; margin-left: 1px; border-radius: 2px;
          animation: blink .7s step-end infinite;
        }
        .lp-sub {
          color: rgba(255,255,255,.45); font-size: 15px; line-height: 1.75;
          max-width: 420px; margin: 0 0 40px;
          animation: fadeUp .5s ease .35s both;
        }

        /* Feature cards */
        .lp-cards { display: flex; flex-direction: column; gap: 8px; }
        .lp-card {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 18px; border-radius: 14px;
          background: rgba(255,255,255,.03);
          border: 1px solid rgba(255,255,255,.06);
          backdrop-filter: blur(12px);
          cursor: default;
          opacity: 0; animation: fadeUp .45s ease both;
          transition: background .25s, border-color .25s, transform .25s;
          position: relative; overflow: hidden;
        }
        .lp-card::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, rgba(16,185,129,.04), transparent);
          transform: translateX(-100%);
          transition: transform .5s;
        }
        .lp-card:hover::before { transform: translateX(100%); }
        .lp-card:hover {
          background: rgba(255,255,255,.06);
          border-color: rgba(16,185,129,.2);
          transform: translateX(5px);
        }
        .lp-card-icon {
          width: 40px; height: 40px; border-radius: 11px;
          background: rgba(16,185,129,.1); border: 1px solid rgba(16,185,129,.15);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; flex-shrink: 0;
          transition: transform .25s;
        }
        .lp-card:hover .lp-card-icon { transform: scale(1.12) rotate(-4deg); }
        .lp-card-title { color: rgba(255,255,255,.88); font-weight: 600; font-size: 13px; margin-bottom: 1px; }
        .lp-card-desc  { color: rgba(255,255,255,.35); font-size: 12px; line-height: 1.5; }

        /* Stats */
        .lp-stats-row {
          display: flex; gap: 0; margin-top: 36px;
          padding-top: 24px; border-top: 1px solid rgba(255,255,255,.07);
          animation: fadeUp .5s ease .85s both;
        }
        .lp-stat { flex: 1; }
        .lp-stat + .lp-stat { border-left: 1px solid rgba(255,255,255,.07); padding-left: 24px; }
        .lp-stat-num {
          font-size: 26px; font-weight: 800;
          background: linear-gradient(180deg, #fff 0%, rgba(255,255,255,.55) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .lp-stat-lbl { color: rgba(255,255,255,.3); font-size: 11px; font-weight: 500; margin-top: 2px; letter-spacing: .4px; text-transform: uppercase; }

        /* ─── RIGHT ─── */
        .lp-right {
          width: 500px; flex-shrink: 0; position: relative;
          background: #fff; display: flex; align-items: center; justify-content: center;
          padding: 48px 52px;
          box-shadow: -20px 0 60px rgba(0,0,0,.15);
        }
        .lp-right-bg {
          position: absolute; inset: 0; pointer-events: none; overflow: hidden;
        }
        .lp-right-bg-circle-1 {
          position: absolute; top: -120px; right: -120px;
          width: 360px; height: 360px; border-radius: 50%;
          background: radial-gradient(circle, rgba(5,150,105,.06) 0%, transparent 70%);
        }
        .lp-right-bg-circle-2 {
          position: absolute; bottom: -100px; left: -80px;
          width: 280px; height: 280px; border-radius: 50%;
          background: radial-gradient(circle, rgba(99,102,241,.04) 0%, transparent 70%);
        }

        .lp-form-box {
          width: 100%; max-width: 400px; position: relative; z-index: 1;
          animation: slideInCard .65s cubic-bezier(.22,1,.36,1) .1s both;
        }
        .lp-form-box.shake { animation: shake .45s ease; }

        .lp-form-title {
          font-size: 30px; font-weight: 800; color: #0f172a;
          letter-spacing: -.6px; margin: 0 0 6px;
        }
        .lp-form-sub { color: #94a3b8; font-size: 14px; margin: 0 0 36px; }

        /* error */
        .lp-error {
          display: flex; gap: 10px; align-items: flex-start;
          background: #fff1f2; border: 1.5px solid #fecdd3;
          border-radius: 10px; padding: 11px 13px; margin-bottom: 22px;
          animation: fadeUp .3s ease;
        }

        /* form fields */
        .lp-field-label {
          font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 7px; display: block;
        }
        .lp-form .ant-input-affix-wrapper,
        .lp-form .ant-input {
          height: 52px !important; border-radius: 12px !important;
          border: 1.5px solid #e2e8f0 !important;
          font-size: 14px !important; background: #f8fafc !important;
          transition: all .22s !important;
          box-shadow: none !important;
        }
        .lp-form .ant-input-affix-wrapper:hover { border-color: #b0bec5 !important; background: #fff !important; }
        .lp-form .ant-input-affix-wrapper-focused,
        .lp-form .ant-input-affix-wrapper:focus-within {
          border-color: #059669 !important;
          background: #fff !important;
          box-shadow: 0 0 0 4px rgba(5,150,105,.1) !important;
        }
        .lp-form .ant-input-affix-wrapper .ant-input {
          height: auto !important; border: none !important; box-shadow: none !important; background: transparent !important;
        }
        .lp-form .ant-input-prefix { color: #94a3b8 !important; margin-right: 8px; }
        .lp-form .ant-form-item { margin-bottom: 20px; }
        .lp-form .ant-form-item-label { display: none; }

        .lp-pw-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px; }
        .lp-forgot { color: #059669; font-size: 12px; font-weight: 600; cursor: pointer; transition: color .2s; }
        .lp-forgot:hover { color: #047857; text-decoration: underline; }

        /* Submit button */
        .lp-submit-btn {
          height: 52px !important; border-radius: 12px !important;
          font-size: 15px !important; font-weight: 700 !important;
          background: #059669 !important;
          border: none !important;
          box-shadow: 0 4px 20px rgba(5,150,105,.35) !important;
          letter-spacing: .2px;
          transition: background .25s, box-shadow .25s, transform .2s !important;
          position: relative; overflow: hidden;
        }
        .lp-submit-btn:hover:not(:disabled) {
          background: #047857 !important;
          box-shadow: 0 8px 30px rgba(5,150,105,.5) !important;
          transform: translateY(-1px) !important;
        }
        .lp-submit-btn:active:not(:disabled) { transform: translateY(0) !important; }

        /* divider */
        .lp-sep { display: flex; align-items: center; gap: 12px; margin: 24px 0; }
        .lp-sep-line { flex: 1; height: 1px; background: #e8ecf0; }
        .lp-sep span { color: #cbd5e1; font-size: 12px; font-weight: 500; }

        /* trust badges */
        .lp-badges { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; }
        .lp-trust {
          display: flex; align-items: center; gap: 5px;
          border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 12px;
          font-size: 11px; color: #64748b; font-weight: 500; background: #fff;
          transition: border-color .2s, box-shadow .2s, transform .2s;
          cursor: default;
        }
        .lp-trust:hover { border-color: #10b981; box-shadow: 0 2px 10px rgba(5,150,105,.1); transform: translateY(-1px); }

        .lp-footer-note { margin-top: 24px; text-align: center; color: #94a3b8; font-size: 12px; }

        /* Mobile */
        @media (max-width: 900px) {
          .lp-left { display: none !important; }
          .lp-right { width: 100%; box-shadow: none; }
        }
      `}</style>

      <div className="lp-wrap">
        {/* LEFT */}
        <div className="lp-left">
          <canvas ref={canvasRef} className="lp-canvas" />
          <div className="lp-left-inner">
            {/* Logo */}
            <div className="lp-logo">
              <div className="lp-logo-mark">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 22V12h6v10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="lp-logo-text">StockEz</span>
            </div>

            {/* Hero */}
            <div className="lp-hero">
              <div className="lp-badge">
                <div className="lp-badge-dot" />
                <span>Trusted by 500+ FMCG Distributors</span>
              </div>

              <h1 className="lp-headline">
                The smarter way<br />to run{' '}
                <span className="lp-headline-accent">
                  {headline.slice(0, typedIdx)}
                </span>
                {typedIdx < headline.length && <span className="lp-cursor" />}
              </h1>

              <p className="lp-sub">
                Purpose-built for FMCG distributors in India. GST-ready invoicing, route management, real-time analytics — all in one platform.
              </p>

              <div className="lp-cards">
                {FEATURES.map((f, i) => (
                  <div className="lp-card" key={i} style={{ animationDelay: `${.45 + i * .09}s` }}>
                    <div className="lp-card-icon">{f.icon}</div>
                    <div>
                      <div className="lp-card-title">{f.title}</div>
                      <div className="lp-card-desc">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="lp-stats-row" ref={statsRef}>
                {[
                  { num: `${Math.floor(c1)}+`, lbl: 'Distributors' },
                  { num: `${Math.floor(c2)}K+`, lbl: 'Orders / Day' },
                  { num: `${c3}%`, lbl: 'Uptime SLA' },
                ].map((s, i) => (
                  <div className="lp-stat" key={i}>
                    <div className="lp-stat-num">{s.num}</div>
                    <div className="lp-stat-lbl">{s.lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="lp-right">
          <div className="lp-right-bg">
            <div className="lp-right-bg-circle-1" />
            <div className="lp-right-bg-circle-2" />
          </div>

          <div className={`lp-form-box${shakeForm ? ' shake' : ''}`}>
            <div style={{ marginBottom: 32 }}>
              <h2 className="lp-form-title">Welcome back</h2>
              <p className="lp-form-sub">Sign in to your distribution workspace</p>
            </div>

            {loginError && (
              <div className="lp-error">
                <CloseOutlined style={{ color: '#ef4444', marginTop: 2, flexShrink: 0 }} />
                <span style={{ color: '#be123c', fontSize: 13, fontWeight: 500, flex: 1 }}>{loginError}</span>
                <CloseOutlined style={{ color: '#f87171', cursor: 'pointer', fontSize: 11 }} onClick={() => setLoginError('')} />
              </div>
            )}

            <Form name="login" onFinish={onFinish} layout="vertical" requiredMark={false} className="lp-form" form={form}>
              <div>
                <span className="lp-field-label">Username</span>
                <Form.Item name="username" rules={[{ required: true, message: 'Enter your username' }]}>
                  <Input
                    prefix={<UserOutlined />}
                    placeholder="Phone number or email"
                    size="large"
                    autoComplete="off"
                    readOnly={usernameReadOnly}
                    onFocus={() => setUsernameReadOnly(false)}
                  />
                </Form.Item>
              </div>

              <div>
                <div className="lp-pw-row">
                  <span className="lp-field-label" style={{ marginBottom: 0 }}>Password</span>
                  <span className="lp-forgot" onClick={() => setForgotOpen(true)}>Forgot password?</span>
                </div>
                <Form.Item name="password" rules={[{ required: true, message: 'Enter your password' }]}>
                  <Input.Password prefix={<LockOutlined />} placeholder="Enter your password" size="large" autoComplete="current-password" />
                </Form.Item>
              </div>

              <Form.Item style={{ marginTop: 12, marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" block loading={isLoading} className="lp-submit-btn" size="large">
                  {isLoading ? 'Signing in…' : <>Sign In &nbsp;<ArrowRightOutlined /></>}
                </Button>
              </Form.Item>
            </Form>

            <div className="lp-sep">
              <div className="lp-sep-line" />
              <span>secured with</span>
              <div className="lp-sep-line" />
            </div>

            <div className="lp-badges">
              {[
                { label: '256-bit SSL', icon: '🔒' },
                { label: 'GST Compliant', icon: '✅' },
                { label: 'Made in India', icon: '🇮🇳' },
              ].map((b, i) => (
                <div className="lp-trust" key={i}>
                  <span style={{ fontSize: 12 }}>{b.icon}</span>
                  {b.label}
                </div>
              ))}
            </div>

            <p className="lp-footer-note">StockEz &copy; 2025 &middot; Enterprise Distribution Platform</p>
          </div>
        </div>
      </div>

      {/* Forgot password modal */}
      <Modal
        open={forgotOpen}
        onCancel={() => setForgotOpen(false)}
        footer={
          <Button type="primary" style={{ background: '#059669', borderColor: '#059669' }} onClick={() => setForgotOpen(false)}>
            Got it
          </Button>
        }
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
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>Password resets are managed by your system administrator.</div>
            </div>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Note your username (phone number or email)',
              'Contact your StockEz administrator',
              'Admin resets your password from Team Management → Users',
              'Log in with the new password and change it in Settings',
            ].map((text, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#059669', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
            Already know your password? Change it from <strong>Settings → Change Password</strong> after logging in.
          </div>
        </div>
      </Modal>
    </>
  );
};

export default LoginPage;
