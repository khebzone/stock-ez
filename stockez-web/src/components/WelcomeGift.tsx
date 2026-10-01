import React, { useEffect, useState, useRef } from 'react';
import { isAdmin } from '../utils/permissions';

const COLORS = [
  '#059669','#10b981','#34d399','#f59e0b',
  '#f97316','#ef4444','#3b82f6','#8b5cf6','#ec4899',
];

type Piece = {
  id: number; x: number; delay: number; duration: number;
  color: string; size: number; isCircle: boolean; drift: number;
};

const PIECES: Piece[] = Array.from({ length: 70 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  delay: Math.random() * 3,
  duration: 3 + Math.random() * 3,
  color: COLORS[Math.floor(Math.random() * COLORS.length)],
  size: 5 + Math.random() * 11,
  isCircle: Math.random() > 0.4,
  drift: (Math.random() - 0.5) * 120,
}));

const COUNTDOWN = 6;

const WelcomeGift: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [count, setCount] = useState(COUNTDOWN);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isAdmin()) return;
    const tenantId = localStorage.getItem('tenantId') || 'default';
    if (!localStorage.getItem(`giftShown_${tenantId}`)) {
      const t = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    timerRef.current = setInterval(() => {
      setCount(c => {
        if (c <= 1) { handleClose(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [visible]);

  const handleClose = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const tenantId = localStorage.getItem('tenantId') || 'default';
    localStorage.setItem(`giftShown_${tenantId}`, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-30px) rotate(0deg);   opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateY(105vh) rotate(540deg); opacity: 0; }
        }
        @keyframes giftPop {
          0%   { opacity: 0; transform: scale(0.8) translateY(20px); }
          100% { opacity: 1; transform: scale(1)   translateY(0);    }
        }
        @keyframes giftIconBounce {
          0%,100% { transform: translateY(0)   scale(1);    }
          40%     { transform: translateY(-8px) scale(1.08); }
          70%     { transform: translateY(-3px) scale(1.03); }
        }
        .gift-card { animation: giftPop 0.5s cubic-bezier(0.22,1,0.36,1) 0.2s both; }
        .gift-icon { animation: giftIconBounce 1.6s ease-in-out infinite; display: inline-block; }
        .gift-close-btn {
          height: 46px; padding: 0 32px; border-radius: 12px;
          border: none; cursor: pointer; font-size: 15px; font-weight: 700;
          background: linear-gradient(135deg, #059669, #047857);
          color: #fff; letter-spacing: 0.2px;
          box-shadow: 0 6px 20px rgba(5,150,105,0.4);
          transition: transform 0.15s, box-shadow 0.2s;
        }
        .gift-close-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 26px rgba(5,150,105,0.5);
        }
        .gift-close-btn:active { transform: translateY(0); }
      `}</style>

      {/* Overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(5,20,40,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        overflow: 'hidden',
      }}>
        {/* Confetti */}
        {PIECES.map(p => (
          <div
            key={p.id}
            style={{
              position: 'fixed',
              left: `${p.x}%`,
              top: '-30px',
              width: p.size,
              height: p.isCircle ? p.size : p.size * 0.55,
              borderRadius: p.isCircle ? '50%' : 3,
              background: p.color,
              animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Card */}
        <div
          className="gift-card"
          style={{
            width: 460, maxWidth: '100%',
            background: '#fff',
            borderRadius: 24,
            padding: '40px 36px 32px',
            textAlign: 'center',
            boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Top decoration strip */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 5,
            background: 'linear-gradient(90deg, #059669, #10b981, #f59e0b, #ef4444, #3b82f6, #8b5cf6)',
            borderRadius: '24px 24px 0 0',
          }} />

          {/* Icon */}
          <div className="gift-icon" style={{ fontSize: 56, lineHeight: 1, marginBottom: 20 }}>
            🎁
          </div>

          <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5, marginBottom: 10 }}>
            Welcome to StockEz!
          </div>

          <div style={{ fontSize: 15, color: '#475569', lineHeight: 1.75, marginBottom: 8 }}>
            Your distribution business journey begins today.
          </div>

          <div style={{
            fontSize: 13, color: '#94a3b8', lineHeight: 1.7, marginBottom: 28,
            padding: '14px 16px',
            background: '#f8fafc',
            borderRadius: 10,
            border: '1px solid #edf0f4',
          }}>
            We are honoured to be part of your growth.<br />
            Every order, every route, every rupee — managed with confidence.
          </div>

          {/* Countdown dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
            {Array.from({ length: COUNTDOWN }, (_, i) => (
              <div key={i} style={{
                width: i < count ? 8 : 6,
                height: i < count ? 8 : 6,
                borderRadius: '50%',
                background: i < count ? '#059669' : '#e2e8f0',
                transition: 'all 0.4s',
                marginTop: i < count ? 0 : 1,
              }} />
            ))}
          </div>

          <button className="gift-close-btn" onClick={handleClose}>
            Let's get started &rarr;
          </button>

          <div style={{ marginTop: 14, fontSize: 12, color: '#cbd5e1' }}>
            Closes in {count}s
          </div>
        </div>
      </div>
    </>
  );
};

export default WelcomeGift;
