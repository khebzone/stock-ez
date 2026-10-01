const XLSX = require('./stockez-web/node_modules/xlsx');
const path = require('path');

const wb = XLSX.utils.book_new();

function addSheet(name, rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 8 },   // TC#
    { wch: 22 },  // col2
    { wch: 28 },  // col3
    { wch: 35 },  // col4
    { wch: 55 },  // Steps
    { wch: 45 },  // Expected
    { wch: 10 },  // Result
    { wch: 20 },  // Notes
  ];

  XLSX.utils.book_append_sheet(wb, ws, name);
}

// ─── Sheet 1 — Overview ──────────────────────────────────────────────────────
addSheet('Overview', [
  ['StockEz — Roles & Permissions Test Plan'],
  [''],
  ['PURPOSE: Verify that permissions configured at /roles are correctly enforced for every user.'],
  ['Key rule: If a permission checkbox is ENABLED on the role → user CAN access it. If DISABLED → user CANNOT.'],
  [''],
  ['ALL PERMISSIONS (from /roles page)'],
  ['Group', 'Module', 'Permission Code', 'What it controls'],
  ['Field Operations', 'Sales Orders', 'ORDERS_VIEW',    'Can see the orders list and open orders'],
  ['Field Operations', 'Sales Orders', 'ORDERS_CREATE',  'Can create a new order'],
  ['Field Operations', 'Sales Orders', 'ORDERS_EDIT',    'Can edit a draft order'],
  ['Field Operations', 'Sales Orders', 'ORDERS_CANCEL',  'Can cancel an order'],
  ['Field Operations', 'Sales Orders', 'ORDERS_DELETE',  'Can delete an order'],
  ['Field Operations', 'Delivery',     'DELIVERY_VIEW',  'Can see delivery list'],
  ['Field Operations', 'Delivery',     'DELIVERY_UPDATE','Can mark orders as delivered'],
  ['Field Operations', 'Routes',       'ROUTES_VIEW',    'Can view route and route places'],
  ['Field Operations', 'Routes',       'ROUTES_CREATE',  'Can create new routes'],
  ['Field Operations', 'Routes',       'ROUTES_EDIT',    'Can edit existing routes'],
  ['Field Operations', 'Attendance',   'ATTENDANCE_VIEW','Can see attendance records'],
  ['Field Operations', 'Attendance',   'ATTENDANCE_CHECKIN','Can check in / check out'],
  ['Finance', 'Customer Payments',     'PAYMENTS_VIEW',  'Can see customer payment list'],
  ['Finance', 'Customer Payments',     'PAYMENTS_CREATE','Can record a new customer payment'],
  ['Finance', 'Customer Payments',     'PAYMENTS_DELETE','Can delete a customer payment'],
  ['Finance', 'Supplier Payments',     'SUPPLIER_PAYMENTS_VIEW',  'Can see supplier payment list'],
  ['Finance', 'Supplier Payments',     'SUPPLIER_PAYMENTS_CREATE','Can record supplier payment'],
  ['Finance', 'Supplier Payments',     'SUPPLIER_PAYMENTS_DELETE','Can delete supplier payment'],
  ['Finance', 'Expenses',              'EXPENSES_VIEW',  'Can view expense records'],
  ['Finance', 'Expenses',              'EXPENSES_CREATE','Can add a new expense'],
  ['Finance', 'Expenses',              'EXPENSES_DELETE','Can delete an expense'],
  ['Finance', 'Day Closure',           'DAY_CLOSURE_VIEW',  'Can view day closure report'],
  ['Finance', 'Day Closure',           'DAY_CLOSURE_CREATE','Can submit day closure'],
  ['Inventory', 'Products',            'PRODUCTS_VIEW',  'Can view product list'],
  ['Inventory', 'Products',            'PRODUCTS_CREATE','Can add a new product'],
  ['Inventory', 'Products',            'PRODUCTS_EDIT',  'Can edit a product'],
  ['Inventory', 'Products',            'PRODUCTS_DELETE','Can delete a product'],
  ['Inventory', 'Purchases',           'PURCHASES_VIEW', 'Can view purchase entries'],
  ['Inventory', 'Purchases',           'PURCHASES_CREATE','Can create a purchase entry'],
  ['Inventory', 'Purchases',           'PURCHASES_EDIT', 'Can edit a purchase entry'],
  ['Inventory', 'Stock Batches',       'STOCK_VIEW',     'Can view stock batches'],
  ['Inventory', 'Goods Return',        'RETURNS_VIEW',   'Can view goods returns'],
  ['Inventory', 'Goods Return',        'RETURNS_CREATE', 'Can create a goods return'],
  ['Inventory', 'Goods Return',        'RETURNS_APPROVE','Can approve a goods return'],
  ['Inventory', 'Gate Pass',           'GATE_PASS_VIEW', 'Can view gate passes'],
  ['Inventory', 'Gate Pass',           'GATE_PASS_CREATE','Can create a gate pass'],
  ['Inventory', 'Warehouse Picklist',  'PICKLIST_VIEW',  'Can view picklists'],
  ['Inventory', 'Warehouse Picklist',  'PICKLIST_UPDATE','Can update picklist status'],
  ['Customers & Suppliers', 'Customers','CUSTOMERS_VIEW', 'Can view customer list'],
  ['Customers & Suppliers', 'Customers','CUSTOMERS_CREATE','Can add a customer'],
  ['Customers & Suppliers', 'Customers','CUSTOMERS_EDIT', 'Can edit a customer'],
  ['Customers & Suppliers', 'Customers','CUSTOMERS_DELETE','Can delete a customer'],
  ['Customers & Suppliers', 'Suppliers','SUPPLIERS_VIEW', 'Can view supplier list'],
  ['Customers & Suppliers', 'Suppliers','SUPPLIERS_CREATE','Can add a supplier'],
  ['Customers & Suppliers', 'Suppliers','SUPPLIERS_EDIT', 'Can edit a supplier'],
  ['Customers & Suppliers', 'Suppliers','SUPPLIERS_DELETE','Can delete a supplier'],
  ['Admin & Reports', 'Invoice Approval','INVOICE_VIEW',  'Can see invoice approval queue'],
  ['Admin & Reports', 'Invoice Approval','INVOICE_APPROVE','Can approve an invoice'],
  ['Admin & Reports', 'Incentives',     'INCENTIVES_VIEW','Can view incentive dashboard'],
  ['Admin & Reports', 'Incentives',     'INCENTIVES_MANAGE','Can set/edit incentive targets'],
  ['Admin & Reports', 'Field Monitor',  'FIELD_MONITOR_VIEW','Can see field activity monitor'],
  ['Admin & Reports', 'Vehicles',       'VEHICLES_VIEW', 'Can view vehicles list'],
  ['Admin & Reports', 'Vehicles',       'VEHICLES_CREATE','Can add a vehicle'],
  ['Admin & Reports', 'Vehicles',       'VEHICLES_EDIT', 'Can edit a vehicle'],
  ['Admin & Reports', 'Reports',        'REPORTS_VIEW',  'Can open and view reports'],
  ['Admin & Reports', 'Reports',        'REPORTS_EXPORT','Can export/download reports'],
  ['Admin & Reports', 'Data Import',    'IMPORT_VIEW',   'Can see the import page'],
  ['Admin & Reports', 'Data Import',    'IMPORT_EXECUTE','Can upload and execute an import'],
]);

// ─── Sheet 2 — Role Config Tests ─────────────────────────────────────────────
addSheet('Role Config Tests', [
  ['TC#', 'Test Case', 'Steps', 'Expected Result', 'Result', 'Notes'],

  ['RC-01', 'Create a role with no permissions',
    '1. Go to /roles\n2. Click New Role\n3. Enter name "Empty Role"\n4. Do NOT check any permission\n5. Click Create Role',
    'Role created. Permissions column shows "No permissions assigned". User count = 0.', '', ''],

  ['RC-02', 'Create a role — enable single permission (ORDERS_VIEW only)',
    '1. New Role → name "View Only Sales"\n2. Check only ORDERS_VIEW\n3. Save',
    'Role saved with 1 permission. Tag shows "Sales Orders: View".', '', ''],

  ['RC-03', 'Toggle entire group using group checkbox',
    '1. New Role → name "All Finance"\n2. Click the "FINANCE" group checkbox\n3. All Finance permissions check at once\n4. Save',
    'All Finance permissions selected (PAYMENTS_VIEW, PAYMENTS_CREATE, PAYMENTS_DELETE, SUPPLIER_PAYMENTS_*, EXPENSES_*, DAY_CLOSURE_*). Count shows 9/9.', '', ''],

  ['RC-04', 'Toggle entire module using module checkbox',
    '1. Edit a role → click "Sales Orders" module checkbox\n2. All 5 order permissions check at once',
    'All 5 order permissions (VIEW, CREATE, EDIT, CANCEL, DELETE) check together.', '', ''],

  ['RC-05', 'Group indeterminate state',
    '1. New Role → check only ORDERS_VIEW (one of many field ops)\n2. Look at "Field Operations" group header checkbox',
    'Group checkbox shows indeterminate state (dash/partial) — not fully checked, not empty.', '', ''],

  ['RC-06', 'Select All / Clear All buttons',
    '1. New Role → click "Select All" button in drawer footer\n2. All permissions checked\n3. Click "Clear All"\n4. All unchecked',
    'Select All: all checkboxes checked. Counter shows X/X. Clear All: counter shows 0/X.', '', ''],

  ['RC-07', 'Role name is required',
    '1. New Role → leave name blank → click Create Role',
    'Error: "Role name is required". Role not created.', '', ''],

  ['RC-08', 'Edit role — add permission',
    '1. Create role "Sales Base" with only ORDERS_VIEW\n2. Click Edit on that role\n3. Add ORDERS_CREATE\n4. Save',
    'Role now shows ORDERS_VIEW + ORDERS_CREATE. Permission count increases by 1.', '', ''],

  ['RC-09', 'Edit role — remove permission',
    '1. Edit "Sales Base" role → uncheck ORDERS_CREATE\n2. Save',
    'Permission removed. Role back to 1 permission. Verify immediately: login as user with that role, ORDERS_CREATE button gone.', '', ''],

  ['RC-10', 'Delete role with no users',
    '1. Create role "Temp Role" with any permissions\n2. Do not assign to any user\n3. Click delete → confirm',
    'Role deleted. No longer appears in list.', '', ''],

  ['RC-11', 'Delete role with assigned users — blocked',
    '1. Assign a user to role "Sales Base"\n2. Try to delete "Sales Base" role',
    'Delete button disabled. Tooltip: "X user(s) assigned — cannot delete."', '', ''],

  ['RC-12', 'Permission count shown in drawer',
    '1. Open any role for editing\n2. Look at footer',
    'Footer shows "X / 60 permissions" where X is the count of checked permissions.', '', ''],

  ['RC-13', 'Assign role to user',
    '1. Go to /users → create/edit a user\n2. Role dropdown shows all roles created at /roles\n3. Assign "Sales Base" role\n4. Save user',
    'User saved with "Sales Base" role. Role\'s user count increments by 1 on /roles page.', '', ''],

  ['RC-14', 'Change user role — old role user count decreases',
    '1. User assigned to "Sales Base" (user count = 1)\n2. Edit user → change role to "All Finance"\n3. Save',
    '"Sales Base" user count goes to 0. "All Finance" user count goes to 1.', '', ''],
]);

// ─── Sheet 3 — Large Agency (8 People) ───────────────────────────────────────
addSheet('Large Agency (8 People)', [
  ['Agency Setup: Large distributor with 8 dedicated staff — each person has a focused role.'],
  [''],
  ['COMPANY SETTINGS PREREQUISITES (set at /settings/company before running these tests)'],
  ['Setting', 'Value', 'Why required'],
  ['Invoice Approval Required', 'ON', 'Orders must wait for Invoice Approver (L-10, L-11, L-24)'],
  ['Warehouse Picklist Step', 'ON', 'Warehouse Accountant must verify picklist before dispatch (L-15, L-24)'],
  ['Goods Return Approval', 'ON', 'Warehouse Accountant approves returns using RETURNS_APPROVE (L-14)'],
  ['Credit Limit Enforcement', 'Hard Block', 'Back Office Accountant manages customer credit limits'],
  ['Lock Billing After Checkout', 'OFF', 'Sales staff bills throughout the day on route'],
  ['Require Gate Pass for Billing', 'OFF', 'Gate pass tested separately in L-15; leave OFF for other tests'],
  ['Workflow shown on settings page', 'Full workflow: Submit → Approve → Picklist → Dispatch → Deliver', ''],
  [''],
  ['ROLES TO CREATE:'],
  ['Role Name', 'Permissions to Enable', 'Assign To'],
  ['Sales Executive',
    'ORDERS_VIEW, ORDERS_CREATE, ORDERS_EDIT, ORDERS_CANCEL, ROUTES_VIEW, PAYMENTS_VIEW, PAYMENTS_CREATE, CUSTOMERS_VIEW, ATTENDANCE_CHECKIN, DELIVERY_VIEW, INCENTIVES_VIEW',
    'Sales Person 1, Sales Person 2'],
  ['Delivery Boy',
    'DELIVERY_VIEW, DELIVERY_UPDATE, PAYMENTS_VIEW, PAYMENTS_CREATE, ATTENDANCE_CHECKIN',
    'Delivery Person 1'],
  ['Invoice Approver',
    'INVOICE_VIEW, INVOICE_APPROVE, ORDERS_VIEW',
    'Invoice Staff 1'],
  ['Warehouse Accountant',
    'PRODUCTS_VIEW, PRODUCTS_CREATE, PRODUCTS_EDIT, PURCHASES_VIEW, PURCHASES_CREATE, PURCHASES_EDIT, STOCK_VIEW, RETURNS_VIEW, RETURNS_CREATE, RETURNS_APPROVE, GATE_PASS_VIEW, GATE_PASS_CREATE, PICKLIST_VIEW, PICKLIST_UPDATE, SUPPLIERS_VIEW',
    'Warehouse Staff 1'],
  ['Back Office Accountant',
    'PAYMENTS_VIEW, PAYMENTS_CREATE, PAYMENTS_DELETE, SUPPLIER_PAYMENTS_VIEW, SUPPLIER_PAYMENTS_CREATE, SUPPLIER_PAYMENTS_DELETE, EXPENSES_VIEW, EXPENSES_CREATE, DAY_CLOSURE_VIEW, DAY_CLOSURE_CREATE, CUSTOMERS_VIEW, CUSTOMERS_CREATE, CUSTOMERS_EDIT, SUPPLIERS_VIEW, SUPPLIERS_CREATE, REPORTS_VIEW, REPORTS_EXPORT, IMPORT_VIEW, IMPORT_EXECUTE',
    'Accountant 1'],
  ['Manager / Owner View',
    'REPORTS_VIEW, REPORTS_EXPORT, FIELD_MONITOR_VIEW, INCENTIVES_VIEW, INCENTIVES_MANAGE, ORDERS_VIEW, PAYMENTS_VIEW, DAY_CLOSURE_VIEW, CUSTOMERS_VIEW',
    'Manager 1'],
  [''],
  ['TC#', 'User', 'Test Case', 'Steps', 'Expected Result', 'Result', 'Notes'],

  ['L-01', 'Sales Executive', 'Can create an order',
    '1. Login as Sales Person 1\n2. Navigate to Orders\n3. Click New Order',
    'Order form opens. Can add items, customer, save as draft.', '', ''],

  ['L-02', 'Sales Executive', 'Cannot access Purchase Entry',
    '1. Login as Sales Person 1\n2. Type /purchase in URL',
    'Access denied. No "Purchase" link in sidebar.', '', ''],

  ['L-03', 'Sales Executive', 'Cannot delete an order (ORDERS_DELETE not given)',
    '1. Login as Sales Person 1\n2. Open an existing order',
    'No Delete button visible on the order.', '', ''],

  ['L-04', 'Sales Executive', 'Can view own route (ROUTES_VIEW only)',
    '1. Login as Sales Person 1\n2. Go to Routes',
    'Can see routes. No Add/Edit route buttons (ROUTES_CREATE and ROUTES_EDIT not given).', '', ''],

  ['L-05', 'Sales Executive', 'Can collect customer payment',
    '1. Login as Sales Person 1\n2. Go to Payments → New Payment',
    'Payment form opens. Can record cash/UPI collection.', '', ''],

  ['L-06', 'Sales Executive', 'Cannot see supplier payments',
    '1. Login as Sales Person 1\n2. Look for Supplier Payments',
    'No supplier payments menu item visible. URL /supplier-payments → access denied.', '', ''],

  ['L-07', 'Delivery Boy', 'Can mark order as delivered',
    '1. Login as Delivery Person 1\n2. Go to Delivery list\n3. Click Update Status on a DISPATCHED order → mark DELIVERED',
    'Order status changes to DELIVERED.', '', ''],

  ['L-08', 'Delivery Boy', 'Cannot create a new order',
    '1. Login as Delivery Person 1\n2. Look for New Order button',
    'No New Order button. ORDERS_CREATE not in their role.', '', ''],

  ['L-09', 'Delivery Boy', 'Cannot access products/inventory',
    '1. Login as Delivery Person 1\n2. Try /products, /purchase, /stock-batches',
    'All three return access denied.', '', ''],

  ['L-10', 'Invoice Approver', 'Can view and approve invoices',
    '1. Login as Invoice Staff 1\n2. Go to Invoice Approval\n3. Click Approve on a pending order',
    'Invoice approved. Order status moves forward.', '', ''],

  ['L-11', 'Invoice Approver', 'Cannot create or edit orders',
    '1. Login as Invoice Staff 1\n2. Look for New Order / Edit order buttons',
    'No create or edit buttons. ORDERS_CREATE and ORDERS_EDIT not in role.', '', ''],

  ['L-12', 'Invoice Approver', 'Cannot access finance screens',
    '1. Login as Invoice Staff 1\n2. Try /payments, /expenses, /day-closure',
    'All return access denied.', '', ''],

  ['L-13', 'Warehouse Accountant', 'Can create purchase entry',
    '1. Login as Warehouse Staff 1\n2. Go to Purchases → New Purchase Entry\n3. Add product, supplier, qty, rates → Save',
    'Purchase saved. Batch created. Stock increases.', '', ''],

  ['L-14', 'Warehouse Accountant', 'Can approve goods return',
    '1. Login as Warehouse Staff 1\n2. Go to Goods Returns\n3. Click Approve on a pending return',
    'Return approved. RETURNS_APPROVE permission enabled.', '', ''],

  ['L-15', 'Warehouse Accountant', 'Can manage gate pass and picklist',
    '1. Login as Warehouse Staff 1\n2. Go to Gate Pass → Create new\n3. Go to Warehouse Picklist → Update status',
    'Both actions succeed.', '', ''],

  ['L-16', 'Warehouse Accountant', 'Cannot delete products (PRODUCTS_DELETE not given)',
    '1. Login as Warehouse Staff 1\n2. Go to Products\n3. Look for delete button',
    'No delete button on products. PRODUCTS_DELETE not in role.', '', ''],

  ['L-17', 'Back Office Accountant', 'Can close the day',
    '1. Login as Accountant 1\n2. Go to Day Closure\n3. Enter physical cash → Submit',
    'Day closure saved successfully.', '', ''],

  ['L-18', 'Back Office Accountant', 'Can import customers',
    '1. Login as Accountant 1\n2. Go to Import\n3. Download template → fill data → Upload',
    'Import executes. Customers created.', '', ''],

  ['L-19', 'Back Office Accountant', 'Can export reports',
    '1. Login as Accountant 1\n2. Go to Reports → any report → Export',
    'Report downloads. REPORTS_EXPORT enabled.', '', ''],

  ['L-20', 'Back Office Accountant', 'Cannot create or approve orders',
    '1. Login as Accountant 1\n2. Try /orders — if accessible, look for New Order\n3. Try /invoice-approval',
    'ORDERS_CREATE not in role — no New Order button. Invoice Approval page not accessible.', '', ''],

  ['L-21', 'Manager', 'Can view field monitor',
    '1. Login as Manager 1\n2. Go to Field Monitor',
    'Field monitor dashboard visible with staff activity.', '', ''],

  ['L-22', 'Manager', 'Can manage incentive targets',
    '1. Login as Manager 1\n2. Go to Incentives → set/edit a target',
    'Can set targets. INCENTIVES_MANAGE enabled.', '', ''],

  ['L-23', 'Manager', 'Cannot create customers or suppliers',
    '1. Login as Manager 1\n2. Go to Customers → look for Add button',
    'No Add Customer button. CUSTOMERS_CREATE not in role.', '', ''],

  ['L-24', 'Full Workflow', 'End-to-end: Sales → Invoice → Warehouse → Delivery → Accountant',
    '1. Sales Person 1: Create order → DRAFT\n2. Invoice Staff: Approve invoice → APPROVED\n3. Warehouse Staff: Update picklist → PREPARED\n4. Manager: Dispatch order → DISPATCHED\n5. Delivery Person: Mark DELIVERED\n6. Accountant: Record payment → close day',
    'All 6 people perform only their permitted actions. No one blocked from their own action. No one can do someone else\'s action.', '', ''],
]);

// ─── Sheet 4 — Medium Agency (5 People) ──────────────────────────────────────
addSheet('Medium Agency (5 People)', [
  ['Agency Setup: Mid-size distributor. Roles are slightly broader — some staff share responsibilities.'],
  [''],
  ['COMPANY SETTINGS PREREQUISITES (set at /settings/company before running these tests)'],
  ['Setting', 'Value', 'Why required'],
  ['Invoice Approval Required', 'ON', 'Office Manager handles invoice approval (M-05)'],
  ['Warehouse Picklist Step', 'OFF', 'Stock Manager packs and dispatches — no separate picklist step needed'],
  ['Goods Return Approval', 'OFF', 'Stock Manager directly processes returns without extra approval step (M-08)'],
  ['Credit Limit Enforcement', 'Hard Block', 'Standard credit enforcement'],
  ['Lock Billing After Checkout', 'OFF', 'Sales staff bills throughout the day'],
  ['Workflow shown on settings page', 'Lean workflow: Submit → Approve → Dispatch → Deliver', ''],
  [''],
  ['ROLES TO CREATE:'],
  ['Role Name', 'Permissions to Enable', 'Assign To'],
  ['Sales + Payments',
    'ORDERS_VIEW, ORDERS_CREATE, ORDERS_EDIT, ORDERS_CANCEL, ROUTES_VIEW, PAYMENTS_VIEW, PAYMENTS_CREATE, CUSTOMERS_VIEW, DELIVERY_VIEW, ATTENDANCE_CHECKIN, INCENTIVES_VIEW',
    'Sales Person 1, Sales Person 2'],
  ['Delivery + Collection',
    'DELIVERY_VIEW, DELIVERY_UPDATE, PAYMENTS_VIEW, PAYMENTS_CREATE, ORDERS_VIEW, ATTENDANCE_CHECKIN',
    'Delivery Person 1'],
  ['Office Manager',
    'PAYMENTS_VIEW, PAYMENTS_CREATE, PAYMENTS_DELETE, SUPPLIER_PAYMENTS_VIEW, SUPPLIER_PAYMENTS_CREATE, EXPENSES_VIEW, EXPENSES_CREATE, DAY_CLOSURE_VIEW, DAY_CLOSURE_CREATE, CUSTOMERS_VIEW, CUSTOMERS_CREATE, CUSTOMERS_EDIT, SUPPLIERS_VIEW, SUPPLIERS_CREATE, REPORTS_VIEW, REPORTS_EXPORT, INVOICE_VIEW, INVOICE_APPROVE, IMPORT_VIEW, IMPORT_EXECUTE',
    'Office Manager 1'],
  ['Stock Manager',
    'PRODUCTS_VIEW, PRODUCTS_CREATE, PRODUCTS_EDIT, PURCHASES_VIEW, PURCHASES_CREATE, STOCK_VIEW, RETURNS_VIEW, RETURNS_CREATE, RETURNS_APPROVE, GATE_PASS_VIEW, GATE_PASS_CREATE, PICKLIST_VIEW, PICKLIST_UPDATE, SUPPLIERS_VIEW',
    'Stock Manager 1'],
  [''],
  ['TC#', 'User', 'Test Case', 'Steps', 'Expected Result', 'Result', 'Notes'],

  ['M-01', 'Sales + Payments', 'Can create order AND collect payment in same session',
    '1. Login as Sales Person 1\n2. Create a new order for a customer\n3. After delivery: go to Payments → record payment for same customer',
    'Both create order and collect payment work. No role switch needed.', '', ''],

  ['M-02', 'Sales + Payments', 'Cannot access supplier or stock screens',
    '1. Login as Sales Person 1\n2. Try /purchases, /stock-batches, /suppliers',
    'All three denied. No inventory access in this role.', '', ''],

  ['M-03', 'Delivery + Collection', 'Can collect payment at time of delivery',
    '1. Login as Delivery Person 1\n2. Open a DISPATCHED order → Mark DELIVERED\n3. Immediately record payment from customer',
    'Delivery update and payment collection both succeed.', '', ''],

  ['M-04', 'Delivery + Collection', 'Can view orders (read-only)',
    '1. Login as Delivery Person 1\n2. Go to Orders list\n3. Open an order to see details',
    'Can view. No New Order or Edit buttons — ORDERS_CREATE/EDIT not in role.', '', ''],

  ['M-05', 'Office Manager', 'Does the invoice approval AND the day closure',
    '1. Login as Office Manager 1\n2. Go to Invoice Approval → approve pending invoices\n3. End of day: go to Day Closure → submit',
    'Both invoice approval and day closure succeed. One person handles both.', '', ''],

  ['M-06', 'Office Manager', 'Can add a new customer',
    '1. Login as Office Manager 1\n2. Go to Customers → Add Customer → fill form → Save',
    'Customer created. CUSTOMERS_CREATE enabled.', '', ''],

  ['M-07', 'Office Manager', 'Cannot delete a customer (CUSTOMERS_DELETE not given)',
    '1. Login as Office Manager 1\n2. Go to Customers list → look for delete button',
    'No delete button. CUSTOMERS_DELETE not in role.', '', ''],

  ['M-08', 'Stock Manager', 'Can create purchase AND approve return',
    '1. Login as Stock Manager 1\n2. Create purchase entry\n3. Go to Goods Returns → Approve a pending return',
    'Both succeed. One stock person handles full inventory lifecycle.', '', ''],

  ['M-09', 'Stock Manager', 'Cannot access finance (no DAY_CLOSURE, PAYMENTS, EXPENSES)',
    '1. Login as Stock Manager 1\n2. Try /payments, /expenses, /day-closure',
    'All three denied.', '', ''],

  ['M-10', 'All 4 users', 'No two roles overlap on sensitive actions',
    '1. Verify Sales cannot approve invoice\n2. Verify Delivery cannot create purchase\n3. Verify Office Manager cannot update picklist\n4. Verify Stock Manager cannot collect payment',
    'Each user\'s restricted actions return access denied.', '', ''],
]);

// ─── Sheet 5 — Small Agency (3 People) ───────────────────────────────────────
addSheet('Small Agency (3 People)', [
  ['Agency Setup: Small local distributor. 1 sales-delivery combo, 1 "does everything" office person, 1 admin.'],
  [''],
  ['COMPANY SETTINGS PREREQUISITES (set at /settings/company before running these tests)'],
  ['Setting', 'Value', 'Why required'],
  ['Invoice Approval Required', 'ON', 'Office All-Rounder approves invoices (SM-04). Field Staff cannot self-approve (SM-02)'],
  ['Warehouse Picklist Step', 'OFF', 'Small team — no dedicated picklist step'],
  ['Goods Return Approval', 'OFF', 'Direct returns allowed — no separate approver'],
  ['Lock Billing After Checkout', 'OFF', 'Field Staff creates orders throughout the day (SM-01)'],
  ['Require Gate Pass for Billing', 'OFF', 'Not used in small agency setup'],
  ['Workflow shown on settings page', 'Lean workflow: Submit → Approve → Dispatch → Deliver', ''],
  [''],
  ['ROLES TO CREATE:'],
  ['Role Name', 'Permissions to Enable', 'Assign To'],
  ['Sales + Delivery Combo',
    'ORDERS_VIEW, ORDERS_CREATE, ORDERS_EDIT, ORDERS_CANCEL, DELIVERY_VIEW, DELIVERY_UPDATE, PAYMENTS_VIEW, PAYMENTS_CREATE, ROUTES_VIEW, CUSTOMERS_VIEW, ATTENDANCE_CHECKIN, INCENTIVES_VIEW',
    'Field Staff 1'],
  ['Office All-Rounder',
    'ORDERS_VIEW, INVOICE_VIEW, INVOICE_APPROVE, PAYMENTS_VIEW, PAYMENTS_CREATE, PAYMENTS_DELETE, SUPPLIER_PAYMENTS_VIEW, SUPPLIER_PAYMENTS_CREATE, EXPENSES_VIEW, EXPENSES_CREATE, DAY_CLOSURE_VIEW, DAY_CLOSURE_CREATE, CUSTOMERS_VIEW, CUSTOMERS_CREATE, CUSTOMERS_EDIT, SUPPLIERS_VIEW, SUPPLIERS_CREATE, SUPPLIERS_EDIT, REPORTS_VIEW, REPORTS_EXPORT, IMPORT_VIEW, IMPORT_EXECUTE, PRODUCTS_VIEW, PURCHASES_VIEW, STOCK_VIEW, RETURNS_VIEW, GATE_PASS_VIEW, PICKLIST_VIEW, INCENTIVES_VIEW, INCENTIVES_MANAGE, VEHICLES_VIEW',
    'Office Person 1'],
  [''],
  ['TC#', 'User', 'Test Case', 'Steps', 'Expected Result', 'Result', 'Notes'],

  ['SM-01', 'Sales + Delivery Combo', 'Creates order, delivers, collects payment — all in one trip',
    '1. Login as Field Staff 1\n2. Create order for Customer A → DRAFT\n3. (Admin approves on behalf)\n4. Field Staff marks DELIVERED\n5. Field Staff records payment on same visit',
    'Single person handles field side completely. Stock deducted at approval. Payment recorded.', '', ''],

  ['SM-02', 'Sales + Delivery Combo', 'Cannot approve own order (no INVOICE_APPROVE)',
    '1. Login as Field Staff 1\n2. Look for Invoice Approval or Approve button on order',
    'No approve capability. Must wait for Admin or Office Person to approve.', '', ''],

  ['SM-03', 'Sales + Delivery Combo', 'Cannot add a product or create purchase entry',
    '1. Login as Field Staff 1\n2. Try /products → no Add Product button\n3. Try /purchase → access denied',
    'Field staff is read-only on inventory (PRODUCTS_VIEW given but not CREATE/EDIT).', '', ''],

  ['SM-04', 'Office All-Rounder', 'Can approve invoice, close day, manage suppliers in same session',
    '1. Login as Office Person 1\n2. Approve pending invoices\n3. Record supplier payment\n4. Add new expense\n5. Close the day',
    'All 4 actions succeed. One person manages all back-office work.', '', ''],

  ['SM-05', 'Office All-Rounder', 'Can view reports and export',
    '1. Login as Office Person 1\n2. Go to Reports → view Sales Analysis\n3. Click Export',
    'Report loads and exports successfully.', '', ''],

  ['SM-06', 'Office All-Rounder', 'Cannot update delivery status (not a field role)',
    '1. Login as Office Person 1\n2. Go to Delivery list → look for "Update Status" button',
    'No update status button. DELIVERY_UPDATE not in Office All-Rounder role.', '', ''],

  ['SM-07', 'Both roles', 'Full day workflow: 3-person agency',
    '1. Field Staff creates 5 orders in the morning\n2. Office Person approves all invoices\n3. Admin dispatches\n4. Field Staff delivers and collects\n5. Office Person records supplier payment and closes day',
    'Entire business day runs with just 3 people. Each stays within their permissions.', '', ''],

  ['SM-08', 'Office All-Rounder', 'Cannot delete a product (only view given)',
    '1. Login as Office Person 1\n2. Go to Products → check for Delete button',
    'No delete button. PRODUCTS_DELETE not in role.', '', ''],
]);

// ─── Sheet 6 — Solo / Micro Agency ───────────────────────────────────────────
addSheet('Solo - Micro Agency', [
  ['Agency Setup: Owner runs everything — 1 person doing all operations. Uses Admin role directly.'],
  ['Note: Admin always has full access. These tests verify the Admin can perform every action.'],
  [''],
  ['TC#', 'User', 'Test Case', 'Steps', 'Expected Result', 'Result', 'Notes'],

  ['SO-01', 'Admin', 'Full order lifecycle — one person',
    '1. Login as Admin\n2. Create product HAPPY HAPPY (12U) RS-10\n3. Add purchase entry → batch created\n4. Create order for customer\n5. Approve invoice\n6. Mark prepared, dispatched, delivered\n7. Record payment\n8. Close day',
    'All 8 steps succeed. Admin has no restrictions.', '', ''],

  ['SO-02', 'Admin', 'Can manage all roles and users',
    '1. Login as Admin\n2. Go to /roles → create, edit, delete roles\n3. Go to /users → create users, assign roles',
    'Full control over roles and users.', '', ''],

  ['SO-03', 'Admin', 'Can access every URL directly',
    '1. Try /orders, /purchase, /payments, /expenses, /reports, /import, /roles, /users, /settings/company',
    'All pages load without "access denied".', '', ''],
]);

// ─── Sheet 7 — Permission Boundary Tests ─────────────────────────────────────
addSheet('Permission Boundary Tests', [
  ['These tests verify the exact boundary: enable one permission → user gets it. Disable → user loses it.'],
  [''],
  ['TC#', 'Permission', 'Test: Enabled', 'Test: Disabled', 'Result (Enabled)', 'Result (Disabled)', 'Notes'],

  ['PB-01', 'ORDERS_VIEW',    'User can open /orders page and see list',         'User gets access denied at /orders', '', '', ''],
  ['PB-02', 'ORDERS_CREATE',  '"New Order" button is visible and functional',    'No "New Order" button on orders page', '', '', ''],
  ['PB-03', 'ORDERS_EDIT',    '"Edit" button visible on DRAFT orders',           'No edit button on orders', '', '', ''],
  ['PB-04', 'ORDERS_CANCEL',  '"Cancel" button visible on orders',               'No cancel button', '', '', ''],
  ['PB-05', 'ORDERS_DELETE',  '"Delete" button visible on orders',               'No delete button', '', '', ''],
  ['PB-06', 'DELIVERY_VIEW',  'Delivery menu item visible in sidebar',           'No delivery item in sidebar', '', '', ''],
  ['PB-07', 'DELIVERY_UPDATE','Update status button on delivery orders',         'No update button — read only', '', '', ''],
  ['PB-08', 'ROUTES_VIEW',    'Routes page accessible',                          'Routes page denied', '', '', ''],
  ['PB-09', 'ROUTES_CREATE',  '"Add Route" button visible',                      'No add button on routes', '', '', ''],
  ['PB-10', 'ATTENDANCE_CHECKIN', 'Check In button functional on attendance',    'No check-in button — read only', '', '', ''],
  ['PB-11', 'PAYMENTS_VIEW',  'Payments page opens with list',                   'Payments page denied', '', '', ''],
  ['PB-12', 'PAYMENTS_CREATE','New Payment form accessible',                     'No New Payment button', '', '', ''],
  ['PB-13', 'PAYMENTS_DELETE','Delete icon on payment records',                  'No delete icon on payments', '', '', ''],
  ['PB-14', 'SUPPLIER_PAYMENTS_CREATE', 'Can record supplier payment',           'No supplier payment form accessible', '', '', ''],
  ['PB-15', 'EXPENSES_CREATE','Add Expense button visible',                      'No add expense button', '', '', ''],
  ['PB-16', 'DAY_CLOSURE_CREATE', 'Submit Day Closure button active',            'Day closure read-only or denied', '', '', ''],
  ['PB-17', 'PRODUCTS_VIEW',  'Products page opens',                             'Products page denied', '', '', ''],
  ['PB-18', 'PRODUCTS_CREATE','"Add Product" button visible',                    'No add product button', '', '', ''],
  ['PB-19', 'PRODUCTS_EDIT',  '"Edit" button on product rows',                   'No edit button on products', '', '', ''],
  ['PB-20', 'PRODUCTS_DELETE','"Delete" button on product rows',                 'No delete on products', '', '', ''],
  ['PB-21', 'PURCHASES_VIEW', 'Purchase Entry page opens',                       'Purchase page denied', '', '', ''],
  ['PB-22', 'PURCHASES_CREATE','"New Purchase" button visible',                  'No new purchase button', '', '', ''],
  ['PB-23', 'STOCK_VIEW',     'Stock Batches page opens',                        'Stock Batches page denied', '', '', ''],
  ['PB-24', 'RETURNS_CREATE', '"New Return" button on Goods Return page',        'No create return button', '', '', ''],
  ['PB-25', 'RETURNS_APPROVE','"Approve" button on pending returns',             'No approve button on returns', '', '', ''],
  ['PB-26', 'GATE_PASS_CREATE','"New Gate Pass" button visible',                 'No new gate pass button', '', '', ''],
  ['PB-27', 'PICKLIST_UPDATE','Update picklist status button active',            'Picklist is read-only', '', '', ''],
  ['PB-28', 'CUSTOMERS_CREATE','"Add Customer" button visible',                  'No add customer button', '', '', ''],
  ['PB-29', 'CUSTOMERS_EDIT', '"Edit" on customer rows',                         'No edit on customers', '', '', ''],
  ['PB-30', 'CUSTOMERS_DELETE','"Delete" on customer rows',                      'No delete on customers', '', '', ''],
  ['PB-31', 'SUPPLIERS_CREATE','"Add Supplier" button visible',                  'No add supplier button', '', '', ''],
  ['PB-32', 'INVOICE_VIEW',   'Invoice Approval page opens',                     'Invoice Approval page denied', '', '', ''],
  ['PB-33', 'INVOICE_APPROVE','"Approve" button on invoice queue',               'No approve button on invoice page', '', '', ''],
  ['PB-34', 'INCENTIVES_VIEW','Incentives page accessible',                      'Incentives page denied', '', '', ''],
  ['PB-35', 'INCENTIVES_MANAGE','"Set Target" / edit target buttons visible',    'Incentives read-only', '', '', ''],
  ['PB-36', 'FIELD_MONITOR_VIEW', 'Field Monitor page opens',                    'Field Monitor page denied', '', '', ''],
  ['PB-37', 'VEHICLES_CREATE','"Add Vehicle" button visible',                    'No add vehicle button', '', '', ''],
  ['PB-38', 'REPORTS_VIEW',   'Reports hub page opens',                          'Reports page denied', '', '', ''],
  ['PB-39', 'REPORTS_EXPORT', '"Export" button on report results',               'No export button', '', '', ''],
  ['PB-40', 'IMPORT_VIEW',    'Import page opens',                               'Import page denied', '', '', ''],
  ['PB-41', 'IMPORT_EXECUTE', '"Upload" button functional on import page',       'No upload button — read only', '', '', ''],
  ['PB-42', 'Role change takes effect on next login',
    '1. User logged in with Role A\n2. Admin removes a permission from Role A\n3. User logs out and back in',
    'After re-login, removed permission no longer accessible', '', '', ''],
]);

// ─── Write ────────────────────────────────────────────────────────────────────
const outputPath = path.join(__dirname, 'StockEz_Roles_TestPlan.xlsx');
XLSX.writeFile(wb, outputPath);
console.log('Generated:', outputPath);
