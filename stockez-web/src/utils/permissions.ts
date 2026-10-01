export const getUser = () => JSON.parse(localStorage.getItem('user') || '{}');

export const getPermissions = (): string[] => getUser().permissions || [];

export const isAdmin = (): boolean => {
  const role = getUser().role;
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
};

export const hasPermission = (perm: string): boolean => {
  if (isAdmin()) return true;
  const perms = getPermissions();
  return perms.includes('ALL') || perms.includes(perm);
};

export const hasAnyPermission = (...perms: string[]): boolean =>
  perms.some(p => hasPermission(p));

const hasSalesPerms    = (): boolean => { const p = getPermissions(); return p.includes('ORDERS_CREATE') || p.includes('ORDERS_VIEW'); };
const hasDeliveryPerms = (): boolean => { const p = getPermissions(); return p.includes('DELIVERY_UPDATE') || p.includes('DELIVERY_VIEW'); };

// Field workers get the mobile FieldLayout. This is the built-in SALES/DELIVERY
// roles, plus any custom role explicitly flagged as "field staff" (set on the role
// in Roles & Permissions). Every other role gets the office MainLayout sidebar —
// regardless of which permissions it carries.
export const isFieldUser = (): boolean => {
  const u = getUser();
  if (u.role === 'SALES' || u.role === 'DELIVERY') return true;
  return u.fieldStaff === true;
};

// Determine initial route after login
export const getDefaultRoute = (): string => {
  const u = getUser();
  const role = u.role;
  if (role === 'SUPER_ADMIN') return '/superadmin/tenants';
  if (isAdmin()) return '/dashboard';
  if (u.fieldStaff === true) return '/field/dashboard';
  return '/dashboard';
};
