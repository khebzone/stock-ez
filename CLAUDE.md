# DistroIQ — Project Reference

## What is DistroIQ?
A professional SaaS platform for FMCG distributors. The standard to match is **Zoho Books / Zoho Inventory** — clean, dense, data-first UI. No toy UI, no colorful dashboards for the sake of it. Every screen must look like it belongs in a real business application.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Spring Boot 3.4.1, Java 21, PostgreSQL 15, Flyway, Spring Security + JWT |
| Frontend | React 19, TypeScript, Vite, Ant Design 5, RTK Query |
| Auth | JWT token in localStorage, X-Tenant-Id header on all API calls |
| Run backend | `.\mvnw.cmd spring-boot:run` (never `mvn`) |
| Run frontend | `npm run dev` (never `npm start`) |
| Quick start | Double-click `start.bat` in project root |

---

## Login Credentials (dev)
- **Username:** `9876543210`
- **Password:** `Admin@1234`

---

## Database Reset (when migrations change)
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```
Then restart backend. Flyway will apply V1 + V2 fresh.

---

## Migration Rules
- All schema lives in **V1__init_schema.sql** — add new tables/columns directly here
- **V2__seed_data.sql** — only tenant + admin user seed
- No separate ALTER TABLE migration files — consolidate into V1
- If V1 changes: drop and recreate the DB, then restart

---

## Architecture

### Multi-Tenant
- Every entity has `tenant_id`
- `X-Tenant-Id` header sent on every API request
- Tenant resolved in `JwtAuthenticationFilter`

### Roles
| Role | Access |
|---|---|
| ADMIN | Full access — all screens |
| SALES | Sales-only layout: dashboard, route, order, payments |
| DELIVERY | Delivery layout: dashboard, orders, payments |
| INVOICE | Invoice approver screen only |
| WAREHOUSE | Stock & purchase screens |

### Stock / Inventory
- FIFO batch deduction on every sale
- Batch number auto-generated on purchase: `BCH-YYYYMMDD-NNN`
- Price discrepancy on purchase → new batch with its own min/max sale rate
- Each batch: `minSaleRate`, `maxSaleRate` — salesperson must sell within range
- `purchaseRate` stored is **inclusive of GST** (user enters it that way)
- Display shows **purchase rate excluding GST** = `purchaseRate / (1 + purchaseGstPercent/100)`

### Orders
- States: DRAFT → APPROVED → PREPARED → DISPATCHED → DELIVERED
- FIFO stock deducted at APPROVED stage
- Each order item records `batchNumber` and `batchExpiryDate`

---

## UI / UX Standards — NON-NEGOTIABLE

### General
- Match **Zoho Books / Zoho Inventory** quality — professional, dense, business-grade
- No excessive colors. Color only for **critical status**: out-of-stock (red), expired (red), low-stock (amber), inactive (grey)
- Consistent font size throughout a table — do not mix large/small fonts for visual decoration
- Do not add colored sub-labels under every cell. One value per cell unless the second value is genuinely needed
- No emoji in the UI unless the user explicitly requests it
- No gradient backgrounds, no card shadows on every element, no rainbow pill badges

### Tables
- Plain Ant Design Table — no alternating column background shading
- Headers: default Ant Design style, no custom coloring
- Each column shows **one primary value** — a sub-line is acceptable only when it adds real information (e.g., HSN code under product name)
- Status column: text only (`Active` / `Inactive`) — no colored badge unless it's a critical warning
- Action column: icon buttons only (Edit, Delete), no labels

### Forms / Drawers
- Grouped in cards with a small uppercase section label
- Required fields marked with `*`
- Validation messages inline under the field
- No multi-paragraph help text — one short tooltip is enough
- Submit button in footer of drawer, right-aligned

### Numbers / Currency
- Always `₹X.XX` format (2 decimal places)
- Right-align all numeric columns
- Negative values in red

### Dates
- Display: `DD MMM YYYY` (e.g., 22 Apr 2026)
- Input: Ant Design DatePicker with `DD MMM YYYY` format

---

## Feature List & Status

### Core Admin
| Feature | Status |
|---|---|
| Login / JWT auth | ✅ Done |
| Dashboard (KPIs) | ✅ Done |
| Products (with batch-aware pricing, GST split) | ✅ Done |
| Customers | ✅ Done |
| Routes & Route Places | ✅ Done |
| Route Allocations | ✅ Done |
| Users (all roles) | ✅ Done |
| Product Masters (Brand, Category, Unit, Tax Rate) | ✅ Done |

### Orders & Payments
| Feature | Status |
|---|---|
| Orders (FIFO stock deduction) | ✅ Done |
| Invoice Approver | ✅ Done |
| Payments (Cash, UPI, Cheque, NEFT, Credit) | ✅ Done |
| Day Counter / Cash Closing | ✅ Done |

### Stock / Purchase
| Feature | Status |
|---|---|
| Purchase Entry (auto batch number, price discrepancy alert) | ✅ Done |
| Stock Batches (FIFO, expiry tracking) | ✅ Done |
| Goods Return & Damage Entry | ✅ Done |

### Sales Person App
| Feature | Status |
|---|---|
| Sales Dashboard | ✅ Done |
| Sales Route | ✅ Done |
| Sales Order | ✅ Done |
| Sales Payments | ✅ Done |

### Delivery Person App
| Feature | Status |
|---|---|
| Delivery Dashboard | ✅ Done |
| Delivery Orders | ✅ Done |
| Delivery Payments | ✅ Done |

### Reports
| Feature | Status |
|---|---|
| Reports Hub | ✅ Done |
| Aging Report | ✅ Done |
| Sales Analysis | ✅ Done |
| Ledger | ✅ Done |
| Targets | ✅ Done |

---

## Key Business Rules

### Purchase Rate & GST
- `purchaseRate` entered by user = **price inclusive of GST** (manually calculated by user)
- `purchaseGstPercent` = GST rate paid to supplier (input tax)
- Display formula: `purchaseRate / (1 + purchaseGstPercent / 100)` = price excluding GST
- `salesGstPercent` = GST charged to customers (output tax) — can differ from purchase GST

### Batch Pricing
- Every purchase creates a new batch with auto-generated `batchNumber`
- If `purchaseRate` differs from product's current `purchaseRate` → price discrepancy warning
- User sets `batchMinSaleRate` and `batchMaxSaleRate` for the new batch
- Salesperson cannot sell below `minSaleRate` or above `maxSaleRate` of the batch

### Day Closure
- Opening cash = previous day's `physicalCashEntered` (not calculated — prevents compounding errors)
- Difference = physical cash counted - expected cash (opening + today's cash collections)

### Goods Return
- `SALES_RETURN`: adds stock back to most recent batch, reduces customer balance
- `PURCHASE_RETURN`: FIFO deduct stock
- `DAMAGE`: FIFO deduct stock, records as loss

### Order Numbering
- Orders: `ORD-YYYY-NNNNN`
- Purchase entries: `PUR-YYYY-NNNNN`
- Goods returns: `RTN-YYYY-NNNNN`
- Batches: `BCH-YYYYMMDD-NNN`

---

## What NOT to Do
- Do NOT run the application — the user runs it via `start.bat`
- Do NOT create separate migration files for ALTER TABLE — edit V1 directly
- Do NOT add excessive inline styles for decoration (colors, font sizes, shadows)
- Do NOT add comments explaining what the code does — code should be self-explanatory
- Do NOT ask for confirmation before implementing — just implement
- Do NOT add features beyond what is requested
- Do NOT mock the database in tests
- Do NOT use `npm start` or `mvn` commands

---

## File Structure (key paths)

```
distroiq/
├── start.bat                          ← double-click to run everything
├── distroiq-api/
│   └── src/main/
│       ├── java/com/distroiq/api/module/
│       │   ├── product/               ← Product, ProductMaster
│       │   ├── purchase/              ← PurchaseEntry, StockBatch
│       │   ├── order/                 ← Order, OrderItem
│       │   ├── payment/               ← Payment, PaymentMethod
│       │   ├── customer/              ← Customer
│       │   ├── route/                 ← Route, RoutePlace, RouteAllocation
│       │   ├── user/                  ← User
│       │   ├── dayclosure/            ← DayClosure
│       │   ├── goodsreturn/           ← GoodsReturn, GoodsReturnItem
│       │   └── reports/               ← Report queries
│       └── resources/db/migration/
│           ├── V1__init_schema.sql    ← ALL schema here
│           └── V2__seed_data.sql      ← tenant + admin only
└── distroiq-web/
    └── src/
        ├── pages/                     ← one folder per feature
        ├── store/api/                 ← RTK Query endpoints
        ├── layouts/                   ← MainLayout, SalesLayout, DeliveryLayout
        └── App.tsx                    ← all routes
```
