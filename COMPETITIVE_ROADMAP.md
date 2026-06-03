# StockEz — Competitive Roadmap
**Target: Match Bizom / FieldAssist / GoFrugal**

---

## Current State (Done ✅)

| Module | Status |
|---|---|
| Multi-tenant SaaS | ✅ |
| Orders (DRAFT → APPROVED → DISPATCHED → DELIVERED) | ✅ |
| FIFO stock with batch tracking | ✅ |
| Purchases with price discrepancy alerts | ✅ |
| Customers, Suppliers, Products | ✅ |
| Routes, Route Allocation, Gate Pass | ✅ |
| Warehouse Picklist | ✅ |
| Customer Payments (Cash, UPI, Cheque, NEFT, Credit) | ✅ |
| Supplier Payments | ✅ |
| Goods Return & Damage entry | ✅ |
| Day Closure / Cash Reconciliation | ✅ |
| Invoice Approval workflow | ✅ |
| Attendance & Incentives | ✅ |
| Field Monitor (live rep tracking) | ✅ |
| Vehicles | ✅ |
| Reports (Aging, Sales Analysis, Ledger, Targets) | ✅ |
| Field app (mobile layout, auto-detected from permissions) | ✅ |
| Data Import (Excel — Products, Customers, Suppliers) | ✅ |
| **Two-level CRUD permission system (55 permissions)** | ✅ |

---

## Gap vs Competitors (No Offline — Removed by Design)

| Feature | StockEz | Bizom / FieldAssist | GoFrugal |
|---|---|---|---|
| Scheme & promotions engine | ❌ | ✅ | ✅ |
| Credit limit enforcement | ❌ | ✅ | ✅ |
| Discount control per role | ❌ | ✅ | ✅ |
| Approval workflows (order value, discount, return) | ❌ | ✅ | ✅ |
| Audit log (who did what, when) | ❌ | ✅ | ✅ |
| Soft delete (data recovery) | ❌ | ✅ | ✅ |
| Territory isolation (salesman sees only his customers) | ❌ | ✅ | ✅ |
| Beat planning / Journey plan | ❌ | ✅ | ✅ |
| Purchase Order (PO) with supplier approval | ❌ | ✅ | ✅ |
| Tally integration | ❌ | ✅ | ✅ |
| GST reports (GSTR-1, GSTR-3B) | ❌ | ✅ | ✅ |
| E-way bill generation | ❌ | ✅ | ✅ |
| Retailer self-ordering portal / app | ❌ | ✅ | ❌ |
| Barcode scanning (stock-in, stock-out) | ❌ | ✅ | ✅ |
| WhatsApp / SMS notifications (order, payment) | ❌ | ✅ | ❌ |
| Price lists (customer-group-wise pricing) | ❌ | ✅ | ✅ |
| Multi-currency / multi-language | ❌ | ✅ | ❌ |

---

## Phase 1 — Before First Paid Customer
> *Without these, no serious distributor will pay. Can't change after go-live.*

| # | Feature | Why Critical |
|---|---|---|
| 1 | **Credit limit enforcement** | Block order if customer outstanding exceeds limit. Every large distributor asks this on demo. |
| 2 | **Discount control** | Salesman can give max X% discount. Beyond that → needs manager approval. Prevents margin leakage. |
| 3 | **Approval workflow** | Orders above ₹50K need manager sign-off. Goods return above ₹X needs approval before stock added back. |
| 4 | **Audit log** | Who created / edited / deleted what, with timestamp. Mandatory for trust in enterprise sales. |
| 5 | **Soft delete** | Nothing permanently deleted. `is_deleted = true`. Data recovery when something deleted by mistake. |

---

## Phase 2 — Beat GoFrugal
> *6–8 months. Closes mid-market deals (15–50 users).*

| # | Feature | Why Critical |
|---|---|---|
| 6 | **Territory isolation** | Each salesman sees only his assigned customers + routes. Senior staff sees all. Franchise owners need this. |
| 7 | **Beat planning** | Pre-plan which outlets each rep visits on which day. Shows visit history, last order date per outlet. |
| 8 | **Purchase Order (PO)** | Raise PO to supplier → supplier confirms → GRN on delivery. Full procurement cycle. |
| 9 | **GST reports (GSTR-1, GSTR-3B)** | Auto-generated from sales data. Required for tax filing. Accountants ask for this on every demo. |
| 10 | **Price lists** | Different prices for different customer groups (wholesaler, retailer, hotel). Applied automatically on order. |
| 11 | **Tally integration** | Export vouchers to Tally. Most Indian distributors use Tally for accounts. Big objection-remover. |

---

## Phase 3 — Match Bizom / FieldAssist
> *Year 2. Justifies premium pricing (₹12,000+/month).*

| # | Feature | Why Critical |
|---|---|---|
| 12 | **Scheme & promotions engine** | Buy 10 get 1 free, ₹500 off on 5 cases, % discount on volume. Applied automatically on order. Complex but powerful. |
| 13 | **E-way bill** | Auto-generate e-way bill for orders above ₹50,000. Required by GST law for inter-state movement. |
| 14 | **WhatsApp / SMS notifications** | Order confirmation to customer. Payment receipt. Low stock alert. Uses WhatsApp Business API. |
| 15 | **Retailer self-ordering portal** | Retailers place orders directly through a portal. Reduces salesman's data-entry work. Bizom differentiator. |
| 16 | **Barcode scanning** | Scan product barcode on purchase GRN and stock-out. Reduces entry errors. Mobile camera-based. |

---

## Permanently Excluded (By Design Decision)

| Feature | Reason |
|---|---|
| **Offline mode** | Complex to build, complex to maintain. Pre-sales model works fully online. Removed by design. |
| **Multi-godown** | 90% of FMCG distributors operate from single godown. Add as paid add-on only if demanded. |
| **Van sales (load/unload)** | Requires offline mode. Excluded along with offline. |

---

## Summary: What Closes the Gap

```
Today (after this session):    Two-level CRUD permissions ✅

Phase 1 (next sprint):         Credit limit + Discount control + Approval workflow + Audit log + Soft delete
                               → First paid customer possible

Phase 2 (6–8 months):          Territory + Beat planning + PO + GST reports + Price lists + Tally
                               → Beat GoFrugal, close mid-market

Phase 3 (Year 2):              Schemes + E-way bill + WhatsApp + Retailer portal + Barcode
                               → Match Bizom, justify ₹12,000+/month
```
