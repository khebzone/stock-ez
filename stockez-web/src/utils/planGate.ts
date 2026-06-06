const PLAN_RANK: Record<string, number> = {
  TRIAL: 3,
  ESSENTIALS: 1,
  PROFESSIONAL: 2,
  PREMIUM: 3,
};

export type RequiredPlan = 'PROFESSIONAL' | 'PREMIUM';

export function getCurrentPlan(): string {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.plan ?? 'ESSENTIALS';
  } catch {
    return 'ESSENTIALS';
  }
}

export function hasPlan(required: RequiredPlan): boolean {
  const rank = PLAN_RANK[getCurrentPlan()] ?? 0;
  return rank >= (PLAN_RANK[required] ?? 99);
}

export const PLAN_META: Record<RequiredPlan, { label: string; price: string; features: string[] }> = {
  PROFESSIONAL: {
    label: 'Professional',
    price: '₹2,500/month',
    features: [
      'Routes & Route Allocations',
      'Full Reports Suite (Aging, Sales, Ledger, Targets)',
      'Attendance & Field Monitor',
      'Vehicles & Gate Pass',
    ],
  },
  PREMIUM: {
    label: 'Premium',
    price: '₹4,000/month',
    features: [
      'Custom Roles & Permissions',
      'Incentive Management',
      'Brand & Collection Targets',
      'Incentive Slabs & Credits',
    ],
  },
};
