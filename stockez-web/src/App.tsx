import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import FieldLayout from './layouts/FieldLayout';
import SuperAdminLayout from './layouts/SuperAdminLayout';
import TenantsPage from './pages/superadmin/TenantsPage';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ProductsPage from './pages/products/ProductsPage';
import CustomersPage from './pages/customers/CustomersPage';
import RoutesPage from './pages/routes/RoutesPage';
import UsersPage from './pages/users/UsersPage';
import RolesPage from './pages/roles/RolesPage';
import OrdersPage from './pages/orders/OrdersPage';
import PaymentsPage from './pages/payments/PaymentsPage';
import ReportsPage from './pages/reports/ReportsPage';
import AgingReportPage from './pages/reports/AgingReportPage';
import SalesAnalysisPage from './pages/reports/SalesAnalysisPage';
import LedgerPage from './pages/reports/LedgerPage';
import TargetsPage from './pages/reports/TargetsPage';
import MastersPage from './pages/masters/MastersPage';
import SalesDashboardPage from './pages/sales/SalesDashboardPage';
import SalesRoutePage from './pages/sales/SalesRoutePage';
import SalesOrderPage from './pages/sales/SalesOrderPage';
import SalesPaymentPage from './pages/sales/SalesPaymentPage';
import SalesHistoryPage from './pages/sales/SalesHistoryPage';
import InvoiceApproverPage from './pages/invoice/InvoiceApproverPage';
import InvoicePage from './pages/invoice/InvoicePage';
import PurchaseListPage from './pages/purchases/PurchaseListPage';
import PurchaseEntryPage from './pages/purchases/PurchaseEntryPage';
import DayClosurePage from './pages/dayclosure/DayClosurePage';
import GoodsReturnPage from './pages/goodsreturn/GoodsReturnPage';
import DeliveryDashboardPage from './pages/delivery/DeliveryDashboardPage';
import DeliveryOrdersPage from './pages/delivery/DeliveryOrdersPage';
import DeliveryPaymentsPage from './pages/delivery/DeliveryPaymentsPage';
import VehiclesPage from './pages/vehicles/VehiclesPage';
import GatePassPage from './pages/gatepasses/GatePassPage';
import StockBatchesPage from './pages/batches/StockBatchesPage';
import FieldMonitorPage from './pages/fieldmonitor/FieldMonitorPage';
import SuppliersPage from './pages/suppliers/SuppliersPage';
import SupplierPaymentsPage from './pages/purchases/SupplierPaymentsPage';
import CustomerOutstandingPage from './pages/payments/CustomerOutstandingPage';
import CompanySettingsPage from './pages/settings/CompanySettingsPage';
import ExpensesPage from './pages/expenses/ExpensesPage';
import WarehousePicklistPage from './pages/warehouse/WarehousePicklistPage';
import ImportPage from './pages/import/ImportPage';
import AttendancePage from './pages/attendance/AttendancePage';
import AttendanceCheckInPage from './pages/attendance/AttendanceCheckInPage';
import BrandTargetPage from './pages/incentives/BrandTargetPage';
import IncentiveSlabPage from './pages/incentives/IncentiveSlabPage';
import IncentiveCreditsPage from './pages/incentives/IncentiveCreditsPage';
import CollectionTargetPage from './pages/incentives/CollectionTargetPage';
import SalesIncentivePage from './pages/sales/SalesIncentivePage';
import CounterSalePage from './pages/countersale/CounterSalePage';
import AuditReportPage from './pages/reports/AuditReportPage';
import { isAdmin, isFieldUser, getDefaultRoute } from './utils/permissions';
import PlanGate from './components/PlanGate';

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

// Office users (admin + staff with office permissions) — desktop sidebar layout
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!isTokenValid(token)) { clearAuth(); return <Navigate to="/login" replace />; }
  const role = JSON.parse(localStorage.getItem('user') || '{}').role;
  if (role === 'SUPER_ADMIN') return <Navigate to="/superadmin/tenants" replace />;
  if (isFieldUser()) return <Navigate to={getDefaultRoute()} replace />;
  return <MainLayout>{children}</MainLayout>;
};

// Field users (sales + delivery) — mobile-first bottom nav layout
const FieldProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!isTokenValid(token)) { clearAuth(); return <Navigate to="/login" replace />; }
  return <FieldLayout>{children}</FieldLayout>;
};

// Admin-only pages — STAFF users redirected to dashboard
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!isTokenValid(token)) { clearAuth(); return <Navigate to="/login" replace />; }
  if (isFieldUser()) return <Navigate to={getDefaultRoute()} replace />;
  if (!isAdmin()) return <Navigate to="/dashboard" replace />;
  return <MainLayout>{children}</MainLayout>;
};

// Super Admin only
const SuperAdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!isTokenValid(token)) { clearAuth(); return <Navigate to="/login" replace />; }
  const role = JSON.parse(localStorage.getItem('user') || '{}').role;
  if (role !== 'SUPER_ADMIN') return <Navigate to="/dashboard" replace />;
  return <SuperAdminLayout>{children}</SuperAdminLayout>;
};

const RootRedirect: React.FC = () => {
  const token = localStorage.getItem('token');
  if (!isTokenValid(token)) { clearAuth(); return <Navigate to="/login" replace />; }
  return <Navigate to={getDefaultRoute()} replace />;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/invoice/:orderNumber" element={<InvoicePage />} />

        {/* ── Office / Admin routes ── */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
        <Route path="/routes" element={<ProtectedRoute><PlanGate required="PROFESSIONAL"><RoutesPage /></PlanGate></ProtectedRoute>} />
        <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
        <Route path="/roles" element={<AdminRoute><PlanGate required="PREMIUM"><RolesPage /></PlanGate></AdminRoute>} />
        <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><PlanGate required="PROFESSIONAL"><ReportsPage /></PlanGate></ProtectedRoute>} />
        <Route path="/reports/aging" element={<ProtectedRoute><PlanGate required="PROFESSIONAL"><AgingReportPage /></PlanGate></ProtectedRoute>} />
        <Route path="/reports/sales" element={<ProtectedRoute><PlanGate required="PROFESSIONAL"><SalesAnalysisPage /></PlanGate></ProtectedRoute>} />
        <Route path="/reports/ledger" element={<ProtectedRoute><PlanGate required="PROFESSIONAL"><LedgerPage /></PlanGate></ProtectedRoute>} />
        <Route path="/reports/targets" element={<ProtectedRoute><PlanGate required="PROFESSIONAL"><TargetsPage /></PlanGate></ProtectedRoute>} />
        <Route path="/masters" element={<AdminRoute><MastersPage /></AdminRoute>} />
        <Route path="/invoice/approver" element={<ProtectedRoute><InvoiceApproverPage /></ProtectedRoute>} />
        <Route path="/purchases" element={<ProtectedRoute><PurchaseListPage /></ProtectedRoute>} />
        <Route path="/purchases/new" element={<ProtectedRoute><PurchaseEntryPage /></ProtectedRoute>} />
        <Route path="/supplier-payments" element={<ProtectedRoute><SupplierPaymentsPage /></ProtectedRoute>} />
        <Route path="/customer-outstanding" element={<ProtectedRoute><CustomerOutstandingPage /></ProtectedRoute>} />
        <Route path="/day-closure" element={<ProtectedRoute><DayClosurePage /></ProtectedRoute>} />
        <Route path="/goods-return" element={<ProtectedRoute><GoodsReturnPage /></ProtectedRoute>} />
        <Route path="/stock-batches" element={<ProtectedRoute><StockBatchesPage /></ProtectedRoute>} />
        <Route path="/gate-pass" element={<ProtectedRoute><PlanGate required="PROFESSIONAL"><GatePassPage /></PlanGate></ProtectedRoute>} />
        <Route path="/vehicles" element={<ProtectedRoute><PlanGate required="PROFESSIONAL"><VehiclesPage /></PlanGate></ProtectedRoute>} />
        <Route path="/field-monitor" element={<ProtectedRoute><PlanGate required="PROFESSIONAL"><FieldMonitorPage /></PlanGate></ProtectedRoute>} />
        <Route path="/suppliers" element={<ProtectedRoute><SuppliersPage /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />
        <Route path="/warehouse/picklist" element={<ProtectedRoute><PlanGate required="PROFESSIONAL"><WarehousePicklistPage /></PlanGate></ProtectedRoute>} />
        <Route path="/import" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />
        <Route path="/attendance" element={<AdminRoute><PlanGate required="PROFESSIONAL"><AttendancePage /></PlanGate></AdminRoute>} />
        <Route path="/incentives/targets" element={<AdminRoute><PlanGate required="PREMIUM"><BrandTargetPage /></PlanGate></AdminRoute>} />
        <Route path="/incentives/slabs" element={<AdminRoute><PlanGate required="PREMIUM"><IncentiveSlabPage /></PlanGate></AdminRoute>} />
        <Route path="/incentives/credits" element={<AdminRoute><PlanGate required="PREMIUM"><IncentiveCreditsPage /></PlanGate></AdminRoute>} />
        <Route path="/incentives/collection/targets" element={<AdminRoute><PlanGate required="PREMIUM"><CollectionTargetPage /></PlanGate></AdminRoute>} />
        <Route path="/counter-sale" element={<ProtectedRoute><CounterSalePage /></ProtectedRoute>} />
        <Route path="/reports/audit" element={<AdminRoute><PlanGate required="PROFESSIONAL"><AuditReportPage /></PlanGate></AdminRoute>} />
        <Route path="/settings/company" element={<AdminRoute><CompanySettingsPage /></AdminRoute>} />

        {/* ── Field routes (sales + delivery combined) ── */}
        <Route path="/sales/dashboard" element={<FieldProtectedRoute><SalesDashboardPage /></FieldProtectedRoute>} />
        <Route path="/sales/route" element={<FieldProtectedRoute><SalesRoutePage /></FieldProtectedRoute>} />
        <Route path="/sales/order" element={<FieldProtectedRoute><SalesOrderPage /></FieldProtectedRoute>} />
        <Route path="/sales/payments" element={<FieldProtectedRoute><SalesPaymentPage /></FieldProtectedRoute>} />
        <Route path="/sales/history" element={<FieldProtectedRoute><SalesHistoryPage /></FieldProtectedRoute>} />
        <Route path="/sales/attendance" element={<FieldProtectedRoute><AttendanceCheckInPage /></FieldProtectedRoute>} />
        <Route path="/sales/incentives" element={<FieldProtectedRoute><SalesIncentivePage /></FieldProtectedRoute>} />
        <Route path="/delivery/dashboard" element={<FieldProtectedRoute><DeliveryDashboardPage /></FieldProtectedRoute>} />
        <Route path="/delivery/orders" element={<FieldProtectedRoute><DeliveryOrdersPage /></FieldProtectedRoute>} />
        <Route path="/delivery/payments" element={<FieldProtectedRoute><DeliveryPaymentsPage /></FieldProtectedRoute>} />
        <Route path="/delivery/attendance" element={<FieldProtectedRoute><AttendanceCheckInPage /></FieldProtectedRoute>} />

        {/* ── Super Admin ── */}
        <Route path="/superadmin/tenants" element={<SuperAdminProtectedRoute><TenantsPage /></SuperAdminProtectedRoute>} />

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
