import React, { useState, useEffect, useRef } from 'react';
import { Select, Spin, Progress, Badge, Grid } from 'antd';
import { TrophyOutlined, FireOutlined, RocketOutlined, CheckCircleFilled, LockOutlined, SyncOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetMyIncentivesQuery } from '../../store/api/incentiveApi';

// Inject animation keyframes once
const STYLE_ID = 'incentive-anim';
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes floatUp {
      0%   { opacity: 1; transform: translateY(0)    scale(1.15); }
      30%  { opacity: 1; transform: translateY(-18px) scale(1.2);  }
      100% { opacity: 0; transform: translateY(-56px) scale(0.9);  }
    }
    @keyframes cardGlow {
      0%   { box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
      40%  { box-shadow: 0 0 0 4px rgba(5,150,105,0.25), 0 4px 16px rgba(5,150,105,0.18); }
      100% { box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
    }
    @keyframes totalPop {
      0%   { transform: scale(1);    }
      40%  { transform: scale(1.12); }
      100% { transform: scale(1);    }
    }
    .incentive-card-glow { animation: cardGlow 1.2s ease-out forwards; }
    .total-pop           { animation: totalPop 0.5s ease-out; }
  `;
  document.head.appendChild(style);
}

// ── Confetti shower ────────────────────────────────────────────────────────
interface ConfettiParticle {
  x: number; y: number;
  vx: number; vy: number;
  color: string; size: number;
  rotation: number; rotSpeed: number;
  opacity: number; shape: 'rect' | 'circle' | 'star';
}

const CONFETTI_COLORS = ['#f59e0b','#059669','#2563eb','#dc2626','#7c3aed','#ea580c','#0891b2','#db2777','#65a30d'];

function drawStar(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outer = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const inner = outer + Math.PI / 5;
    if (i === 0) ctx.moveTo(Math.cos(outer) * r, Math.sin(outer) * r);
    else         ctx.lineTo(Math.cos(outer) * r, Math.sin(outer) * r);
    ctx.lineTo(Math.cos(inner) * (r * 0.45), Math.sin(inner) * (r * 0.45));
  }
  ctx.closePath();
  ctx.fill();
}

const ConfettiShower: React.FC<{ trigger: number; count?: number }> = ({ trigger, count = 130 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (trigger === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const shapes: ConfettiParticle['shape'][] = ['rect', 'circle', 'star'];
    const particles: ConfettiParticle[] = Array.from({ length: count }, () => ({
      x:        Math.random() * canvas.width,
      y:        -20 - Math.random() * 120,
      vx:       (Math.random() - 0.5) * 5,
      vy:       2.5 + Math.random() * 4,
      color:    CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size:     5 + Math.random() * 9,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.18,
      opacity:  1,
      shape:    shapes[Math.floor(Math.random() * shapes.length)],
    }));

    if (animRef.current) cancelAnimationFrame(animRef.current);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      for (const p of particles) {
        if (p.opacity <= 0.02) continue;
        alive = true;

        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.06;
        p.vx += Math.sin(p.y * 0.04) * 0.08;
        p.rotation += p.rotSpeed;
        if (p.y > canvas.height * 0.65) p.opacity -= 0.018;

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle   = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.55);
        } else if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawStar(ctx, p.size / 2);
        }
        ctx.restore();
      }

      if (alive) animRef.current = requestAnimationFrame(animate);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [trigger, count]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }}
    />
  );
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const { useBreakpoint } = Grid;

const fmt = (v: any) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtShort = (v: any) => {
  const n = Number(v || 0);
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
};

const STATUS_CFG: Record<string, { color: string; bg: string; border: string; label: string; icon: React.ReactNode }> = {
  ACHIEVED:        { color: '#059669', bg: '#f0fdf4', border: '#86efac', label: 'Target Achieved!',  icon: <TrophyOutlined /> },
  NEAR_TARGET:     { color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', label: 'Near Target',       icon: <RocketOutlined /> },
  NEEDS_ATTENTION: { color: '#d97706', bg: '#fffbeb', border: '#fcd34d', label: 'Needs Attention',   icon: <FireOutlined />   },
  AT_RISK:         { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', label: 'At Risk',           icon: <FireOutlined />   },
};

interface SlabInfo { fromPct: number; toPct: number | null; incentiveAmount: number }
interface Increment { id: string; brand: string; amount: number }

interface BrandCard {
  brand: string; targetValue: number; achievedValue: number;
  achievementPct: number; achievementStatus: string;
  earnedIncentive: number; nextTierIncentive: number | null;
  gapToNextTier: number | null; nextTierTargetPct: number | null;
  slabs: SlabInfo[]; credited: boolean;
}

// ── Tier row inside each card ──────────────────────────────────────────────
const TierRow: React.FC<{ slab: SlabInfo; currentPct: number }> = ({ slab, currentPct }) => {
  const isActive = currentPct >= slab.fromPct && (slab.toPct == null || currentPct <= slab.toPct);
  const isPassed = slab.toPct != null && currentPct > slab.toPct;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 10px', borderRadius: 6, marginBottom: 3,
      background: isActive ? 'rgba(37,99,235,0.08)' : 'transparent',
      border: isActive ? '1px solid rgba(37,99,235,0.2)' : '1px solid transparent',
      transition: 'all 0.3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {isPassed
          ? <CheckCircleFilled style={{ color: '#059669', fontSize: 12 }} />
          : <div style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? '#2563eb' : '#e2e8f0', border: isActive ? 'none' : '1px solid #cbd5e1' }} />
        }
        <span style={{ fontSize: 12, color: isPassed ? '#059669' : isActive ? '#1e40af' : '#64748b', fontWeight: isActive ? 700 : 400 }}>
          {slab.fromPct}%{slab.toPct != null ? `–${slab.toPct}%` : '+'}
        </span>
        {isActive && (
          <span style={{ fontSize: 10, background: '#2563eb', color: '#fff', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
            YOU
          </span>
        )}
      </div>
      <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: isPassed ? '#059669' : isActive ? '#2563eb' : '#94a3b8' }}>
        {fmt(slab.incentiveAmount)}
      </span>
    </div>
  );
};

// ── Single brand card ──────────────────────────────────────────────────────
const BrandIncentiveCard: React.FC<{ card: BrandCard; increments: Increment[]; glowing: boolean }> = ({ card, increments, glowing }) => {
  const cfg = STATUS_CFG[card.achievementStatus] || STATUS_CFG.AT_RISK;
  const rawPct    = Number(card.achievementPct || 0);
  const hasEarned = Number(card.earnedIncentive) > 0;
  const hasNext   = card.gapToNextTier != null && Number(card.gapToNextTier) > 0;

  return (
    <div
      className={glowing ? 'incentive-card-glow' : ''}
      style={{
        background: '#fff',
        border: `1px solid ${cfg.border}`,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Floating "+₹X" increment bubbles */}
      {increments.filter(i => i.brand === card.brand).map(inc => (
        <div key={inc.id} style={{
          position: 'absolute', top: 56, right: 20, zIndex: 10,
          pointerEvents: 'none',
          animation: 'floatUp 1.8s ease-out forwards',
          fontSize: 18, fontWeight: 900, color: '#059669',
          fontFamily: 'monospace',
          textShadow: '0 1px 4px rgba(5,150,105,0.3)',
          whiteSpace: 'nowrap',
        }}>
          +{fmt(inc.amount)}
        </div>
      ))}

      {/* Card header */}
      <div style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.border}`, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', letterSpacing: -0.3 }}>{card.brand}</div>
          <div style={{ fontSize: 12, color: cfg.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            {cfg.icon} {cfg.label}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 30, fontWeight: 900, color: cfg.color, lineHeight: 1, fontFamily: 'monospace', transition: 'all 0.4s' }}>
            {rawPct.toFixed(1)}%
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>achievement</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px' }}>

        {/* Progress */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
          <span style={{ color: '#64748b' }}>{fmtShort(card.achievedValue)} sold</span>
          <span style={{ color: '#64748b' }}>Target: {fmtShort(card.targetValue)}</span>
        </div>
        <Progress
          percent={Math.min(rawPct, 100)}
          showInfo={false}
          strokeColor={cfg.color}
          trailColor="#e2e8f0"
          size={['100%', 8]}
          style={{ marginBottom: 0 }}
        />
        {rawPct > 100 && (
          <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginTop: 4, textAlign: 'right' }}>
            +{(rawPct - 100).toFixed(1)}% over target!
          </div>
        )}

        {/* Earned incentive box */}
        <div style={{
          marginTop: 14,
          background: hasEarned ? '#f0fdf4' : '#f8fafc',
          border: `1px solid ${hasEarned ? '#86efac' : '#e2e8f0'}`,
          borderRadius: 8, padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Incentive Earned
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: hasEarned ? '#059669' : '#94a3b8', fontFamily: 'monospace', lineHeight: 1.2, marginTop: 2, transition: 'all 0.4s' }}>
              {fmt(card.earnedIncentive)}
            </div>
          </div>
          {card.credited
            ? (
              <div style={{ textAlign: 'right' }}>
                <CheckCircleFilled style={{ color: '#059669', fontSize: 22 }} />
                <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginTop: 3 }}>Credited</div>
              </div>
            ) : hasEarned ? (
              <div style={{ textAlign: 'right' }}>
                <LockOutlined style={{ color: '#d97706', fontSize: 18 }} />
                <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600, marginTop: 3 }}>Pending</div>
              </div>
            ) : null}
        </div>

        {/* Next tier unlock */}
        {hasNext && (
          <div style={{
            marginTop: 10,
            background: 'linear-gradient(135deg, #fff7ed, #fffbeb)',
            border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 14px',
          }}>
            <div style={{ fontSize: 11, color: '#c2410c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              Next Tier Unlock
            </div>
            <div style={{ fontSize: 13, color: '#7c2d12', lineHeight: 1.5 }}>
              Sell{' '}
              <strong style={{ fontSize: 15, color: '#c2410c' }}>{fmt(card.gapToNextTier)}</strong>
              {' '}more → unlock{' '}
              <strong style={{ color: '#059669', fontSize: 15 }}>{fmt(card.nextTierIncentive)}</strong>
            </div>
            {card.nextTierTargetPct != null && (
              <div style={{ fontSize: 11, color: '#a16207', marginTop: 3 }}>
                Reach {card.nextTierTargetPct}% achievement to qualify
              </div>
            )}
          </div>
        )}

        {/* Tier table */}
        {card.slabs?.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Incentive Tiers
            </div>
            {card.slabs.map((slab, i) => <TierRow key={i} slab={slab} currentPct={rawPct} />)}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────
const SalesIncentivePage: React.FC = () => {
  const now = dayjs();
  const [month, setMonth] = useState(now.month() + 1);
  const [year, setYear]   = useState(now.year());
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [increments, setIncrements]       = useState<Increment[]>([]);
  const [glowingCards, setGlowingCards]   = useState<Set<string>>(new Set());
  const [totalPopKey, setTotalPopKey]     = useState(0);
  const [lastUpdated, setLastUpdated]     = useState<dayjs.Dayjs | null>(null);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [confettiCount, setConfettiCount]     = useState(130);
  const prevBrandsRef    = useRef<Record<string, number>>({});
  const isInitializedRef = useRef(false);

  const { data, isLoading, isFetching } = useGetMyIncentivesQuery(
    { month, year },
    { pollingInterval: 30_000 },
  );

  const view   = data?.data;
  const brands: BrandCard[] = view?.brands || [];
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.year() - 1 + i);

  // Detect increments between polls
  useEffect(() => {
    if (!view?.brands) return;

    setLastUpdated(dayjs());

    if (!isInitializedRef.current) {
      view.brands.forEach((c: BrandCard) => { prevBrandsRef.current[c.brand] = Number(c.achievedValue); });
      isInitializedRef.current = true;
      // Fire big confetti on load if any brand is already achieved
      const hasAchieved = view.brands.some((c: BrandCard) => Number(c.achievementPct) >= 100);
      if (hasAchieved) {
        setConfettiCount(160);
        setConfettiTrigger(t => t + 1);
      }
      return;
    }

    const newIncs: Increment[] = [];
    const newGlows = new Set<string>();
    let pushedToAchieved = false;

    view.brands.forEach((c: BrandCard) => {
      const prev = prevBrandsRef.current[c.brand] ?? Number(c.achievedValue);
      const curr = Number(c.achievedValue);
      if (curr > prev) {
        const id = `${c.brand}-${Date.now()}-${Math.random()}`;
        newIncs.push({ id, brand: c.brand, amount: curr - prev });
        newGlows.add(c.brand);
        prevBrandsRef.current[c.brand] = curr;
        if (Number(c.achievementPct) >= 100) pushedToAchieved = true;
      } else {
        prevBrandsRef.current[c.brand] = curr;
      }
    });

    if (newIncs.length > 0) {
      setIncrements(prev => [...prev, ...newIncs]);
      setGlowingCards(newGlows);
      setTotalPopKey(k => k + 1);
      // Big shower when crossing 100%, small burst for any new sale
      setConfettiCount(pushedToAchieved ? 180 : 70);
      setConfettiTrigger(t => t + 1);
      setTimeout(() => {
        setIncrements(prev => prev.filter(i => !newIncs.find(n => n.id === i.id)));
        setGlowingCards(new Set());
      }, 2000);
    }
  }, [view]);

  // Reset on month/year change
  useEffect(() => {
    isInitializedRef.current = false;
    prevBrandsRef.current = {};
    setIncrements([]);
    setGlowingCards(new Set());
  }, [month, year]);

  const achievedCount = brands.filter(b => b.achievementStatus === 'ACHIEVED').length;
  const nearCount     = brands.filter(b => b.achievementStatus === 'NEAR_TARGET').length;

  return (
    <div>
      <ConfettiShower trigger={confettiTrigger} count={confettiCount} />
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TrophyOutlined style={{ fontSize: 22, color: '#f59e0b' }} />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>
              My Incentives
            </h1>
            <Badge
              status="processing"
              text={
                <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', letterSpacing: 0.5 }}>
                  LIVE
                </span>
              }
            />
            {isFetching && !isLoading && (
              <SyncOutlined spin style={{ color: '#94a3b8', fontSize: 13 }} />
            )}
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            {MONTHS[month - 1]} {year} · Updates every 30 seconds
            {lastUpdated && !isMobile && (
              <span style={{ marginLeft: 8, color: '#94a3b8' }}>
                · Last refreshed {lastUpdated.format('h:mm:ss A')}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Select value={month} onChange={setMonth} style={{ width: 90 }}>
            {MONTHS.map((m, i) => <Select.Option key={i + 1} value={i + 1}>{m}</Select.Option>)}
          </Select>
          <Select value={year} onChange={setYear} style={{ width: 90 }}>
            {yearOptions.map(y => <Select.Option key={y} value={y}>{y}</Select.Option>)}
          </Select>
        </div>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
          <div style={{ color: '#64748b', marginTop: 12, fontSize: 14 }}>Loading your incentive data…</div>
        </div>
      )}

      {!isLoading && view && (
        <>
          {/* Summary banner */}
          <div style={{
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            borderRadius: 12, padding: '20px 24px', marginBottom: 24,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
          }}>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Total Earned This Month
              </div>
              <div
                key={totalPopKey}
                className={totalPopKey > 0 ? 'total-pop' : ''}
                style={{ fontSize: 36, fontWeight: 900, color: '#fff', fontFamily: 'monospace', lineHeight: 1.1, marginTop: 4 }}
              >
                {fmt(view.totalEarned)}
              </div>
              {Number(view.totalPotential) > Number(view.totalEarned) && (
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
                  Up to {fmt(view.totalPotential)} possible if all targets are hit
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              {achievedCount > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 30, fontWeight: 900, color: '#fff' }}>{achievedCount}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Achieved</div>
                </div>
              )}
              {nearCount > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 30, fontWeight: 900, color: '#bfdbfe' }}>{nearCount}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Near Target</div>
                </div>
              )}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 30, fontWeight: 900, color: '#fff' }}>{brands.length}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Brands</div>
              </div>
            </div>
          </div>

          {brands.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
              <TrophyOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b' }}>No targets set for this period</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                Your manager hasn't assigned brand targets for {MONTHS[month - 1]} {year} yet.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {[...brands]
                .sort((a, b) => Number(b.achievementPct) - Number(a.achievementPct))
                .map(card => (
                  <BrandIncentiveCard
                    key={card.brand}
                    card={card}
                    increments={increments}
                    glowing={glowingCards.has(card.brand)}
                  />
                ))}
            </div>
          )}
        </>
      )}

      {!isLoading && !view && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <TrophyOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b' }}>No incentive data</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Select a month to view your incentive progress.</div>
        </div>
      )}
    </div>
  );
};

export default SalesIncentivePage;
