import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import SalesLayout from './layouts/SalesLayout';
import DeliveryLayout from './layouts/DeliveryLayout';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ProductsPage from './pages/products/ProductsPage';
import CustomersPage from './pages/customers/CustomersPage';
import RoutesPage from './pages/routes/RoutesPage';
import UsersPage from './pages/users/UsersPage';
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
import InvoiceApproverPage from './pages/invoice/InvoiceApproverPage';
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

// ── Protected Route for admin/regular users ──
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  const role = JSON.parse(localStorage.getItem('user') || '{}').role;
  if (role === 'SALES')    return <Navigate to="/sales/dashboard" replace />;
  if (role === 'DELIVERY') return <Navigate to="/delivery/dashboard" replace />;
  return <MainLayout>{children}</MainLayout>;
};

// ── Protected Route for SALES role ──
const SalesProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <SalesLayout>{children}</SalesLayout>;
};

// ── Protected Route for DELIVERY role ──
const DeliveryProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <DeliveryLayout>{children}</DeliveryLayout>;
};

// ── Root redirect: check role after login ──
const RootRedirect: React.FC = () => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = user.role;

  if (role === 'SALES') return <Navigate to="/sales/dashboard" replace />;
  if (role === 'INVOICE') return <Navigate to="/invoice/approver" replace />;
  if (role === 'DELIVERY') return <Navigate to="/delivery/dashboard" replace />;
  return <Navigate to="/dashboard" replace />;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* ── Admin / General routes ── */}
        <Route path="/dashboard"   element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/products"    element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
        <Route path="/customers"   element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
        <Route path="/routes"      element={<ProtectedRoute><RoutesPage /></ProtectedRoute>} />
        <Route path="/users"       element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
        <Route path="/orders"      element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
        <Route path="/payments"    element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
        <Route path="/reports"          element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
        <Route path="/reports/aging"    element={<ProtectedRoute><AgingReportPage /></ProtectedRoute>} />
        <Route path="/reports/sales"    element={<ProtectedRoute><SalesAnalysisPage /></ProtectedRoute>} />
        <Route path="/reports/ledger"   element={<ProtectedRoute><LedgerPage /></ProtectedRoute>} />
        <Route path="/reports/targets"  element={<ProtectedRoute><TargetsPage /></ProtectedRoute>} />
        <Route path="/masters"     element={<ProtectedRoute><MastersPage /></ProtectedRoute>} />

        {/* ── Invoice Approver ── */}
        <Route path="/invoice/approver" element={<ProtectedRoute><InvoiceApproverPage /></ProtectedRoute>} />

        {/* ── Purchases ── */}
        <Route path="/purchases"           element={<ProtectedRoute><PurchaseListPage /></ProtectedRoute>} />
        <Route path="/purchases/new"       element={<ProtectedRoute><PurchaseEntryPage /></ProtectedRoute>} />
        <Route path="/supplier-payments"      element={<ProtectedRoute><SupplierPaymentsPage /></ProtectedRoute>} />
        <Route path="/customer-outstanding"  element={<ProtectedRoute><CustomerOutstandingPage /></ProtectedRoute>} />

        {/* ── Day Closure ── */}
        <Route path="/day-closure" element={<ProtectedRoute><DayClosurePage /></ProtectedRoute>} />

        {/* ── Goods Return & Damage ── */}
        <Route path="/goods-return"   element={<ProtectedRoute><GoodsReturnPage /></ProtectedRoute>} />
        <Route path="/stock-batches"  element={<ProtectedRoute><StockBatchesPage /></ProtectedRoute>} />

        {/* ── Gate Pass & Vehicles ── */}
        <Route path="/gate-pass"      element={<ProtectedRoute><GatePassPage /></ProtectedRoute>} />
        <Route path="/vehicles"       element={<ProtectedRoute><VehiclesPage /></ProtectedRoute>} />
        <Route path="/field-monitor"  element={<ProtectedRoute><FieldMonitorPage /></ProtectedRoute>} />

        {/* ── Suppliers ── */}
        <Route path="/suppliers" element={<ProtectedRoute><SuppliersPage /></ProtectedRoute>} />

        {/* ── Expenses ── */}
        <Route path="/expenses" element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />

        {/* ── Warehouse ── */}
        <Route path="/warehouse/picklist" element={<ProtectedRoute><WarehousePicklistPage /></ProtectedRoute>} />

        {/* ── Import ── */}
        <Route path="/import" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />

        {/* ── Settings ── */}
        <Route path="/settings/company" element={<ProtectedRoute><CompanySettingsPage /></ProtectedRoute>} />

        {/* ── Sales Person routes ── */}
        <Route path="/sales/dashboard" element={<SalesProtectedRoute><SalesDashboardPage /></SalesProtectedRoute>} />
        <Route path="/sales/route"     element={<SalesProtectedRoute><SalesRoutePage /></SalesProtectedRoute>} />
        <Route path="/sales/order"     element={<SalesProtectedRoute><SalesOrderPage /></SalesProtectedRoute>} />
        <Route path="/sales/payments"  element={<SalesProtectedRoute><SalesPaymentPage /></SalesProtectedRoute>} />

        {/* ── Delivery Person routes ── */}
        <Route path="/delivery/dashboard" element={<DeliveryProtectedRoute><DeliveryDashboardPage /></DeliveryProtectedRoute>} />
        <Route path="/delivery/orders"    element={<DeliveryProtectedRoute><DeliveryOrdersPage /></DeliveryProtectedRoute>} />
        <Route path="/delivery/payments"  element={<DeliveryProtectedRoute><DeliveryPaymentsPage /></DeliveryProtectedRoute>} />

        {/* ── Root redirect ── */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
