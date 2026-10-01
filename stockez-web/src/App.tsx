import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Spin } from 'antd';
import MainLayout from './layouts/MainLayout';
import FieldLayout from './layouts/FieldLayout';
import SuperAdminLayout from './layouts/SuperAdminLayout';
import { isAdmin, isFieldUser, getDefaultRoute } from './utils/permissions';
import PlanGate from './components/PlanGate';

const TenantsPage           = React.lazy(() => import('./pages/superadmin/TenantsPage'));
const LoginPage             = React.lazy(() => import('./pages/auth/LoginPage'));
const DashboardPage         = React.lazy(() => import('./pages/dashboard/DashboardPage'));
const ProductsPage          = React.lazy(() => import('./pages/products/ProductsPage'));
const CustomersPage         = React.lazy(() => import('./pages/customers/CustomersPage'));
const RoutesPage            = React.lazy(() => import('./pages/routes/RoutesPage'));
const UsersPage             = React.lazy(() => import('./pages/users/UsersPage'));
const RolesPage             = React.lazy(() => import('./pages/roles/RolesPage'));
const OrdersPage            = React.lazy(() => import('./pages/orders/OrdersPage'));
const PaymentsPage          = React.lazy(() => import('./pages/payments/PaymentsPage'));
const ReportsPage           = React.lazy(() => import('./pages/reports/ReportsPage'));
const AgingReportPage       = React.lazy(() => import('./pages/reports/AgingReportPage'));
const DailyReportPage       = React.lazy(() => import('./pages/reports/DailyReportPage'));
const SalesAnalysisPage     = React.lazy(() => import('./pages/reports/SalesAnalysisPage'));
const LedgerPage            = React.lazy(() => import('./pages/reports/LedgerPage'));
const TargetsPage           = React.lazy(() => import('./pages/reports/TargetsPage'));
const MastersPage           = React.lazy(() => import('./pages/masters/MastersPage'));
const SalesRoutePage        = React.lazy(() => import('./pages/sales/SalesRoutePage'));
const SalesOrderPage        = React.lazy(() => import('./pages/sales/SalesOrderPage'));
const SalesPaymentPage      = React.lazy(() => import('./pages/sales/SalesPaymentPage'));
const SalesHistoryPage      = React.lazy(() => import('./pages/sales/SalesHistoryPage'));
const InvoiceApproverPage   = React.lazy(() => import('./pages/invoice/InvoiceApproverPage'));
const InvoicePage           = React.lazy(() => import('./pages/invoice/InvoicePage'));
const PurchaseListPage      = React.lazy(() => import('./pages/purchases/PurchaseListPage'));
const PurchaseEntryPage     = React.lazy(() => import('./pages/purchases/PurchaseEntryPage'));
const DayClosurePage        = React.lazy(() => import('./pages/dayclosure/DayClosurePage'));
const BankClearancePage     = React.lazy(() => import('./pages/payments/BankClearancePage'));
const GoodsReturnPage       = React.lazy(() => import('./pages/goodsreturn/GoodsReturnPage'));
const FieldGoodsReturnPage  = React.lazy(() => import('./pages/goodsreturn/FieldGoodsReturnPage'));
const FieldDashboardPage    = React.lazy(() => import('./pages/field/FieldDashboardPage'));
const DeliveryOrdersPage    = React.lazy(() => import('./pages/delivery/DeliveryOrdersPage'));
const DeliveryHistoryPage   = React.lazy(() => import('./pages/delivery/DeliveryHistoryPage'));
const DeliveryPaymentsPage  = React.lazy(() => import('./pages/delivery/DeliveryPaymentsPage'));
const VehiclesPage          = React.lazy(() => import('./pages/vehicles/VehiclesPage'));
const GatePassPage          = React.lazy(() => import('./pages/gatepasses/GatePassPage'));
const StockBatchesPage      = React.lazy(() => import('./pages/batches/StockBatchesPage'));
const FieldMonitorPage      = React.lazy(() => import('./pages/fieldmonitor/FieldMonitorPage'));
const SuppliersPage         = React.lazy(() => import('./pages/suppliers/SuppliersPage'));
const SupplierPaymentsPage  = React.lazy(() => import('./pages/purchases/SupplierPaymentsPage'));
const CustomerOutstandingPage = React.lazy(() => import('./pages/payments/CustomerOutstandingPage'));
const RefundsClaimsPage      = React.lazy(() => import('./pages/finance/RefundsClaimsPage'));
const CompanySettingsPage   = React.lazy(() => import('./pages/settings/CompanySettingsPage'));
const ExpensesPage          = React.lazy(() => import('./pages/expenses/ExpensesPage'));
const WarehousePicklistPage   = React.lazy(() => import('./pages/warehouse/WarehousePicklistPage'));
const WarehouseReturnsPage    = React.lazy(() => import('./pages/warehouse/WarehouseReturnsPage'));
const WarehouseDashboardPage  = React.lazy(() => import('./pages/warehouse/WarehouseDashboardPage'));
const ImportPage            = React.lazy(() => import('./pages/import/ImportPage'));
const AttendancePage        = React.lazy(() => import('./pages/attendance/AttendancePage'));
const AttendanceCheckInPage = React.lazy(() => import('./pages/attendance/AttendanceCheckInPage'));
const BrandTargetPage       = React.lazy(() => import('./pages/incentives/BrandTargetPage'));
const IncentiveSlabPage     = React.lazy(() => import('./pages/incentives/IncentiveSlabPage'));
const IncentiveCreditsPage  = React.lazy(() => import('./pages/incentives/IncentiveCreditsPage'));
const CollectionTargetPage  = React.lazy(() => import('./pages/incentives/CollectionTargetPage'));
const SalesIncentivePage    = React.lazy(() => import('./pages/sales/SalesIncentivePage'));
const CounterSalePage       = React.lazy(() => import('./pages/countersale/CounterSalePage'));
const StockAdjustmentPage   = React.lazy(() => import('./pages/stockadjustment/StockAdjustmentPage'));
const AuditReportPage       = React.lazy(() => import('./pages/reports/AuditReportPage'));
const DeadStockPage         = React.lazy(() => import('./pages/reports/DeadStockPage'));
const ClosingStockPage      = React.lazy(() => import('./pages/inventory/ClosingStockPage'));
const CustomerSalesReportPage = React.lazy(() => import('./pages/reports/CustomerSalesReportPage'));
const CustomerItemReportPage  = React.lazy(() => import('./pages/reports/CustomerItemReportPage'));
const RouteItemReportPage     = React.lazy(() => import('./pages/reports/RouteItemReportPage'));
const ItemHistoryPage         = React.lazy(() => import('./pages/reports/ItemHistoryPage'));
const RouteOutstandingPage    = React.lazy(() => import('./pages/reports/RouteOutstandingPage'));

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
    <Spin size="large" />
  </div>
);

const isTokenValid = (token: string | null): boolean => {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('tenantId');
  localStorage.removeItem('userId');
  localStorage.removeItem('user');
};

const loginUrl = () => {
  const tenant = new URLSearchParams(window.location.search).get('tenant');
  return tenant ? `/login?tenant=${tenant}` : '/login';
};

// ── Layout route components ──────────────────────────────────────────────────
// These mount ONCE and stay mounted while navigating between child routes.
// Only <Outlet /> (page content) swaps — the sidebar/header never remounts.

const OfficeLayout: React.FC = () => {
  const token = localStorage.getItem('token');
  if (!isTokenValid(token)) { clearAuth(); return <Navigate to={loginUrl()} replace />; }
  const role = JSON.parse(localStorage.getItem('user') || '{}').role;
  if (role === 'SUPER_ADMIN') return <Navigate to="/superadmin/tenants" replace />;
  if (isFieldUser()) return <Navigate to={getDefaultRoute()} replace />;
  return (
    <MainLayout>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </MainLayout>
  );
};

const AdminOnlyGuard: React.FC = () => {
  if (isFieldUser()) return <Navigate to={getDefaultRoute()} replace />;
  if (!isAdmin()) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
};

const FieldUserLayout: React.FC = () => {
  const token = localStorage.getItem('token');
  if (!isTokenValid(token)) { clearAuth(); return <Navigate to={loginUrl()} replace />; }
  return (
    <FieldLayout>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </FieldLayout>
  );
};

const SuperAdminLayoutRoute: React.FC = () => {
  const token = localStorage.getItem('token');
  if (!isTokenValid(token)) { clearAuth(); return <Navigate to={loginUrl()} replace />; }
  const role = JSON.parse(localStorage.getItem('user') || '{}').role;
  if (role !== 'SUPER_ADMIN') return <Navigate to="/dashboard" replace />;
  return (
    <SuperAdminLayout>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </SuperAdminLayout>
  );
};

const RootRedirect: React.FC = () => {
  const token = localStorage.getItem('token');
  if (!isTokenValid(token)) { clearAuth(); return <Navigate to={loginUrl()} replace />; }
  return <Navigate to={getDefaultRoute()} replace />;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ── Public ── */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/invoice/:id" element={<InvoicePage />} />

          {/* ── Office / Admin — MainLayout mounts once, Outlet swaps pages ── */}
          <Route element={<OfficeLayout />}>
            <Route path="/dashboard"           element={<DashboardPage />} />
            <Route path="/products"            element={<ProductsPage />} />
            <Route path="/customers"           element={<CustomersPage />} />
            <Route path="/routes"              element={<PlanGate required="PROFESSIONAL"><RoutesPage /></PlanGate>} />
            <Route path="/orders"              element={<OrdersPage />} />
            <Route path="/payments"            element={<PaymentsPage />} />
            <Route path="/reports"             element={<PlanGate required="PROFESSIONAL"><ReportsPage /></PlanGate>} />
            <Route path="/reports/daily"       element={<PlanGate required="PROFESSIONAL"><DailyReportPage /></PlanGate>} />
            <Route path="/reports/aging"       element={<PlanGate required="PROFESSIONAL"><AgingReportPage /></PlanGate>} />
            <Route path="/reports/sales"       element={<PlanGate required="PROFESSIONAL"><SalesAnalysisPage /></PlanGate>} />
            <Route path="/reports/ledger"      element={<PlanGate required="PROFESSIONAL"><LedgerPage /></PlanGate>} />
            <Route path="/reports/targets"     element={<PlanGate required="PROFESSIONAL"><TargetsPage /></PlanGate>} />
            <Route path="/invoice/approver"    element={<InvoiceApproverPage />} />
            <Route path="/purchases"           element={<PurchaseListPage />} />
            <Route path="/purchases/new"       element={<PurchaseEntryPage />} />
            <Route path="/supplier-payments"   element={<SupplierPaymentsPage />} />
            <Route path="/customer-outstanding" element={<CustomerOutstandingPage />} />
            <Route path="/refunds-claims"      element={<RefundsClaimsPage />} />
            <Route path="/day-closure"         element={<DayClosurePage />} />
            <Route path="/bank-clearance"      element={<BankClearancePage />} />
            <Route path="/goods-return"        element={<GoodsReturnPage />} />
            <Route path="/stock-adjustments"   element={<StockAdjustmentPage />} />
            <Route path="/stock-batches"       element={<StockBatchesPage />} />
            <Route path="/gate-pass"           element={<PlanGate required="PROFESSIONAL"><GatePassPage /></PlanGate>} />
            <Route path="/vehicles"            element={<PlanGate required="PROFESSIONAL"><VehiclesPage /></PlanGate>} />
            <Route path="/field-monitor"       element={<PlanGate required="PROFESSIONAL"><FieldMonitorPage /></PlanGate>} />
            <Route path="/suppliers"           element={<SuppliersPage />} />
            <Route path="/expenses"            element={<ExpensesPage />} />
            <Route path="/warehouse/picklist"  element={<PlanGate required="PROFESSIONAL"><WarehousePicklistPage /></PlanGate>} />
            <Route path="/warehouse/my-tasks"  element={<PlanGate required="PROFESSIONAL"><WarehousePicklistPage /></PlanGate>} />
            <Route path="/warehouse/returns"   element={<WarehouseReturnsPage />} />
            <Route path="/import"              element={<ImportPage />} />
            <Route path="/counter-sale"        element={<CounterSalePage />} />
            <Route path="/reports/dead-stock"  element={<PlanGate required="PROFESSIONAL"><DeadStockPage /></PlanGate>} />
            <Route path="/reports/customer-sales"     element={<PlanGate required="PROFESSIONAL"><CustomerSalesReportPage /></PlanGate>} />
            <Route path="/reports/customer-item"      element={<PlanGate required="PROFESSIONAL"><CustomerItemReportPage /></PlanGate>} />
            <Route path="/reports/route-item"         element={<PlanGate required="PROFESSIONAL"><RouteItemReportPage /></PlanGate>} />
            <Route path="/reports/item-history"       element={<PlanGate required="PROFESSIONAL"><ItemHistoryPage /></PlanGate>} />
            <Route path="/reports/route-outstanding"  element={<PlanGate required="PROFESSIONAL"><RouteOutstandingPage /></PlanGate>} />
            <Route path="/closing-stock"       element={<PlanGate required="PROFESSIONAL"><ClosingStockPage /></PlanGate>} />

            {/* Permission-gated pages — accessible to any office user whose role has the permission */}
            <Route path="/attendance"                     element={<PlanGate required="PROFESSIONAL"><AttendancePage /></PlanGate>} />
            <Route path="/incentives/targets"             element={<PlanGate required="PREMIUM"><BrandTargetPage /></PlanGate>} />
            <Route path="/incentives/slabs"               element={<PlanGate required="PREMIUM"><IncentiveSlabPage /></PlanGate>} />
            <Route path="/incentives/credits"             element={<PlanGate required="PREMIUM"><IncentiveCreditsPage /></PlanGate>} />
            <Route path="/incentives/collection/targets"  element={<PlanGate required="PREMIUM"><CollectionTargetPage /></PlanGate>} />

            {/* Admin-only pages — no permission checkbox exists for these */}
            <Route element={<AdminOnlyGuard />}>
              <Route path="/users"                          element={<UsersPage />} />
              <Route path="/roles"                          element={<PlanGate required="PREMIUM"><RolesPage /></PlanGate>} />
              <Route path="/masters"                        element={<MastersPage />} />
              <Route path="/reports/audit"                  element={<PlanGate required="PROFESSIONAL"><AuditReportPage /></PlanGate>} />
              <Route path="/settings/company"               element={<CompanySettingsPage />} />
            </Route>
          </Route>

          {/* ── Field routes — FieldLayout mounts once, Outlet swaps pages ── */}
          <Route element={<FieldUserLayout />}>
            <Route path="/sales/route"              element={<SalesRoutePage />} />
            <Route path="/sales/order"              element={<SalesOrderPage />} />
            <Route path="/sales/payments"           element={<SalesPaymentPage />} />
            <Route path="/sales/history"            element={<SalesHistoryPage />} />
            <Route path="/sales/attendance"         element={<AttendanceCheckInPage />} />
            <Route path="/sales/incentives"         element={<SalesIncentivePage />} />
            <Route path="/field/dashboard"          element={<FieldDashboardPage />} />
            <Route path="/delivery/orders"          element={<DeliveryOrdersPage />} />
            <Route path="/delivery/history"         element={<DeliveryHistoryPage />} />
            <Route path="/delivery/payments"        element={<DeliveryPaymentsPage />} />
            <Route path="/delivery/attendance"      element={<AttendanceCheckInPage />} />
            <Route path="/warehouse/dashboard"      element={<WarehouseDashboardPage />} />
            <Route path="/sales/customers"          element={<CustomersPage />} />
            <Route path="/sales/products"           element={<ProductsPage />} />
            <Route path="/sales/stock-batches"      element={<StockBatchesPage />} />
            <Route path="/sales/gate-pass"          element={<GatePassPage />} />
            <Route path="/sales/field-monitor"      element={<FieldMonitorPage />} />
            <Route path="/sales/purchases"          element={<PurchaseListPage />} />
            <Route path="/sales/goods-return"       element={<FieldGoodsReturnPage />} />
            <Route path="/sales/warehouse/picklist" element={<WarehousePicklistPage />} />
            <Route path="/sales/suppliers"          element={<SuppliersPage />} />
            <Route path="/sales/supplier-payments"  element={<SupplierPaymentsPage />} />
            <Route path="/sales/expenses"           element={<ExpensesPage />} />
            <Route path="/sales/day-closure"        element={<DayClosurePage />} />
            <Route path="/sales/invoice/approver"   element={<InvoiceApproverPage />} />
            <Route path="/sales/vehicles"           element={<VehiclesPage />} />
            <Route path="/sales/reports"            element={<ReportsPage />} />
            <Route path="/sales/import"             element={<ImportPage />} />
          </Route>

          {/* ── Super Admin ── */}
          <Route element={<SuperAdminLayoutRoute />}>
            <Route path="/superadmin/tenants" element={<TenantsPage />} />
          </Route>

          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
