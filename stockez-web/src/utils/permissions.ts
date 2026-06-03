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

// FIELD users: have sales orders, delivery, or route access → mobile layout
export const isFieldUser = (): boolean => {
  if (isAdmin()) return false;
  return hasAnyPermission('ORDERS_VIEW', 'ORDERS_CREATE', 'DELIVERY_VIEW', 'DELIVERY_UPDATE', 'ROUTES_VIEW');
};

// Determine initial route after login
export const getDefaultRoute = (): string => {
  const role = getUser().role;
  if (role === 'SUPER_ADMIN') return '/superadmin/tenants';
  if (isAdmin()) return '/dashboard';
  if (hasPermission('ORDERS_VIEW') || hasPermission('ORDERS_CREATE')) return '/sales/dashboard';
  if (hasPermission('DELIVERY_VIEW') || hasPermission('DELIVERY_UPDATE')) return '/delivery/dashboard';
  if (isFieldUser()) return '/sales/dashboard';
  return '/dashboard';
};
