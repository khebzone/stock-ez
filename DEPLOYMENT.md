# StockEz — Deployment & Scaling Plan

## Hosting Choice: Oracle Cloud Infrastructure (OCI)

Oracle Cloud is chosen over AWS and GCP for one reason: **Always Free tier never expires**.
AWS and GCP free tiers last 12 months then bill. Oracle's Always Free runs indefinitely.

---

## Infrastructure Stack

| Component | Technology | Why |
|---|---|---|
| Compute | Oracle Cloud A1 Flex (ARM) | 4 OCPU + 24 GB RAM — free forever |
| Database | PostgreSQL 15 | On OCI Block Storage |
| Connection Pool | PgBouncer | Prevents DB connection exhaustion at scale |
| Cache | Redis 7 | Per-tenant product/customer list caching |
| Web Server | Nginx | Reverse proxy + static frontend serving |
| Product Images | Cloudflare R2 | No egress fees, global CDN built-in |
| Frontend CDN | Cloudflare (free) | Edge caches JS/CSS globally |
| SSL | Let's Encrypt (Certbot) | Free, auto-renewal |

---

## Scaling Phases

### Phase 1 — Launch (0 to 20 clients) | Cost: ₹0/month

**Everything runs on one Oracle A1 instance (4 OCPU, 24 GB RAM)**

```
Oracle Cloud VM (ARM A1 — Free)
├── Nginx          → reverse proxy on port 80/443
├── Spring Boot    → port 8080
├── PostgreSQL     → port 5432
├── Redis          → port 6379
└── PgBouncer      → port 5433
```

- 20 clients × ~10 users = ~200 concurrent users — A1 handles this comfortably
- Cloudflare R2 for all product images from day 1
- Cloudflare free plan proxies the domain → free DDoS protection + CDN

**Migration effort to Phase 2:** ~2 hours. Provision a second VM, dump DB, restore, change one config line.

---

### Phase 2 — Growth (20 to 50 clients) | Cost: ~₹2,500/month

**Separate the database from the app server**

```
Oracle Cloud VM 1 (App) — A1 Flex paid: 4 OCPU, 16 GB
├── Nginx
├── Spring Boot (2 instances, ports 8080 + 8081)
├── Redis
└── PgBouncer

Oracle Cloud VM 2 (DB) — A1 Flex paid: 2 OCPU, 8 GB
└── PostgreSQL 15
```

Key additions:
- Run 2 Spring Boot instances behind Nginx load balancer (upstream round-robin)
- Redis caches: product catalog per tenant (TTL 10 min), customer list per tenant (TTL 5 min)
- PgBouncer pool size: 50 connections → serves 500+ app threads with 50 real DB connections
- Nightly PostgreSQL backup to Oracle Object Storage (free 20 GB)

**Migration effort to Phase 3:** ~2 hours. Spin up a new app VM, deploy the same JAR, add 2 lines to Nginx config.

---

### Phase 3 — Scale (50 to 150 clients) | Cost: ~₹8,000/month

**Horizontal app scaling + DB read replica**

```
Cloudflare (DNS + CDN + WAF)
        │
Nginx Load Balancer (Oracle A1)
        │
   ┌────┴────┐
App 1     App 2     App 3   (Spring Boot × 3)
   └────┬────┘
        │
   PgBouncer
        │
   ┌────┴────┐
Primary DB   Read Replica   (PostgreSQL streaming replication)
                 ↑
           Reports queries routed here
```

Key additions:
- 3 Spring Boot app nodes — stateless (JWT in browser), share Redis, any node serves any user
- PostgreSQL primary + 1 read replica — all report queries (aging, ledger, sales analysis) hit replica
- Cloudflare WAF (Web Application Firewall) — protects against SQL injection, bots
- Dedicated Redis node for session management

**Migration effort beyond Phase 3:** Move to any cloud in under 1 hour — `pg_dump` + copy JAR + update DNS. Zero vendor lock-in.

---

## Product Image Storage: Cloudflare R2

### Why R2 over S3 or Oracle Object Storage

| | Cloudflare R2 | AWS S3 | Oracle Object Storage |
|---|---|---|---|
| Storage cost | $0.015/GB | $0.023/GB | Free 20 GB then $0.0255/GB |
| Egress (downloads) | **₹0 forever** | $0.09/GB | $0.0085/GB |
| Free tier | 10 GB + 10M reads/month | 5 GB (12 months only) | 20 GB (no bandwidth) |
| CDN | Built-in globally | Extra cost (CloudFront) | No |
| API | S3-compatible | S3 | Proprietary |

### Image Upload Flow

1. Admin opens Product Master → edits a product → clicks Upload Image
2. Frontend sends image to Spring Boot backend (multipart/form-data)
3. Backend uploads to Cloudflare R2 via S3-compatible API
4. R2 returns a public CDN URL → saved in `products.image_url` column
5. Salesmen load product images directly from Cloudflare edge — fast globally

### R2 Cost by Client Count

| Clients | Products | Storage | Reads/month | Monthly Cost |
|---|---|---|---|---|
| 20 | ~6,000 images | ~0.9 GB | ~600K | **₹0** |
| 50 | ~15,000 images | ~2.2 GB | ~1.5M | **₹0** |
| 100 | ~30,000 images | ~4.5 GB | ~3M | **₹0** |
| 200 | ~60,000 images | ~9 GB | ~6M | **₹0** |
| 500 | ~1,50,000 images | ~22 GB | ~15M | **~₹165** |

*Assumption: 300 products per client, 150 KB avg image size, 10M free reads/month on R2 free tier.*

All within free tier up to ~200 clients. After that, still negligible — ₹165/month for 500 clients.

---

## Performance at 100+ Parallel Clients

### What makes it fast

**1. PgBouncer (connection pooling)**
Without it: 500 users × Spring Boot threads = 500 PostgreSQL connections → DB crashes.
With it: 500 app threads → 50 real DB connections → DB stays healthy.

**2. Redis caching per tenant**
Product list for a tenant: fetched from DB once, cached 10 minutes.
100 salesmen opening the order screen simultaneously = 1 DB query, not 100.

**3. Nginx gzip compression**
API responses compressed ~70%. Order list of 100 items: 40 KB → 12 KB over the wire.

**4. Cloudflare CDN for frontend**
React JS/CSS bundle served from Cloudflare's nearest edge city — not from the India Oracle server.
Page load: ~200ms instead of ~800ms.

**5. Stateless Spring Boot**
No server-side sessions. JWT lives in the browser. Any app server handles any request.
Scaling = just adding more app servers behind Nginx.

**6. Database indexes on tenant_id (critical)**
Every query in this app filters by `tenant_id`. Without composite indexes, every query does a full table scan across all tenants.

```sql
CREATE INDEX idx_orders_tenant_date      ON orders (tenant_id, created_at DESC);
CREATE INDEX idx_products_tenant         ON products (tenant_id, is_active);
CREATE INDEX idx_customers_tenant_route  ON customers (tenant_id, route_id);
CREATE INDEX idx_stock_batches_tenant    ON stock_batches (tenant_id, product_id);
CREATE INDEX idx_payments_tenant_date    ON payments (tenant_id, payment_date DESC);
CREATE INDEX idx_order_items_tenant      ON order_items (tenant_id, order_id);
CREATE INDEX idx_goods_return_tenant     ON goods_returns (tenant_id, return_date DESC);
```

---

## Deployment Architecture Diagram

```
User (Browser / Salesman / Delivery)
        │
   Cloudflare DNS + CDN + DDoS Protection
   ├── stockez.in/app      → React frontend (Cloudflare edge cache)
   ├── stockez.in/api/*    → Nginx (OCI VM) → Spring Boot
   └── images.stockez.in   → Cloudflare R2 (product images, CDN)
        │
   Nginx (OCI VM — port 80/443 + SSL)
   ├── /api/*              → Spring Boot :8080
   └── /*                  → /var/www/stockez (React build)
        │
   Spring Boot (Java 21, HikariCP)
   ├── DB connections      → PgBouncer :5433
   └── Cache               → Redis :6379
        │
   PgBouncer → PostgreSQL :5432
```

---

## Migration Path — Zero Lock-In

Spring Boot is stateless (JWT in browser). PostgreSQL is standard. R2 is S3-compatible.

To move everything to any other cloud:
1. `pg_dump` on old server → `pg_restore` on new server — 30 minutes
2. Copy the Spring Boot JAR — 2 minutes
3. Update Cloudflare DNS to point to new server IP — live in under 1 minute

**Total: under 1 hour. No code changes. No data loss.**

---

## Demo Instance (demo.stockez.com)

A separate Oracle Cloud A1 free-tier VM is used exclusively for sales demos — zero cost, zero risk to production.

### Why separate?

| | Production (app.stockez.com) | Demo (demo.stockez.com) |
|---|---|---|
| Purpose | Real paying clients | Sales demonstrations only |
| Database | PostgreSQL — client data | PostgreSQL — dummy data |
| Reset | Never | Anytime — wipe and reload |
| Risk | Zero tolerance | Freely breakable |

### Architecture

```
demo.stockez.com
        │
   Cloudflare DNS → Oracle Cloud VM 2 (A1 free tier)
   ├── Nginx
   ├── Spring Boot (same JAR as production)
   └── PostgreSQL (stockez_demo database)
```

Same codebase as production. Only `application.properties` differs:

```properties
# Production (VM 1)
spring.datasource.url=jdbc:postgresql://localhost:5432/stockez_prod

# Demo (VM 2)
spring.datasource.url=jdbc:postgresql://localhost:5432/stockez_demo
```

### Resetting demo data

```sql
-- Run on demo VM only — never on production
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

Then restart Spring Boot. Flyway reapplies V1 + V2, giving a clean slate with the seed tenant and admin user. Reload demo-specific sample data (products, customers, orders) from a SQL script kept in the repo.

### Trial Tenants vs Demo

| | Trial Tenant | Demo Instance |
|---|---|---|
| Who uses it | The prospect themselves | You (sales presentation) |
| Where | Production database | Separate demo database |
| Data | Their real data | Dummy data you control |
| Reset | Never (their data) | Anytime |
| Plan | TRIAL (full access) | PREMIUM (show everything) |
| After expiry | Downgrades to ESSENTIALS | You wipe and reload |

Trial tenants are real tenants on production with the TRIAL plan. After trial expires, plan downgrades to ESSENTIALS — features lock, data stays. Archive/delete tenant after 90 days of inactivity.

---

## Go-Live Checklist (Sunday)

- [ ] Create Oracle Cloud account → provision A1 Flex instance (Ubuntu 22.04)
- [ ] Install: Java 21, PostgreSQL 15, Redis 7, Nginx, PgBouncer, Certbot
- [ ] Create Cloudflare account → add domain → enable proxy
- [ ] Create Cloudflare R2 bucket → generate API keys
- [ ] Configure R2 keys in Spring Boot `application.properties`
- [ ] Build React frontend: `npm run build` → copy dist/ to `/var/www/stockez`
- [ ] Package Spring Boot: `.\mvnw.cmd package -DskipTests` → upload JAR to server
- [ ] Configure Nginx reverse proxy (API + frontend + SSL)
- [ ] Configure systemd service for Spring Boot (auto-restart on crash)
- [ ] Drop + recreate PostgreSQL schema → Flyway applies V1 + V2
- [ ] SSL certificate: `certbot --nginx -d stockez.in`
- [ ] Smoke test: login → create order → upload product image → run report

---

## Full Cost Summary

### Infrastructure (Oracle Cloud)

| Phase | Clients | Oracle Cost | R2 (Images) | Total/month |
|---|---|---|---|---|
| Phase 1 | 0–20 | ₹0 (always free) | ₹0 | **₹0** |
| Phase 2 | 20–50 | ~₹2,500 | ₹0 | **~₹2,500** |
| Phase 3 | 50–150 | ~₹8,000 | ₹0 | **~₹8,000** |
| Beyond | 150–500 | ~₹15,000 | ~₹165 | **~₹15,165** |

### Revenue vs Infrastructure

| Clients | SaaS Revenue (₹2,000/client) | Infra Cost | Infra as % of Revenue |
|---|---|---|---|
| 20 | ₹40,000 | ₹0 | 0% |
| 50 | ₹1,00,000 | ₹2,500 | 2.5% |
| 100 | ₹2,00,000 | ₹8,000 | 4% |
| 150 | ₹3,00,000 | ₹8,000 | 2.7% |
| 500 | ₹10,00,000 | ₹15,165 | 1.5% |

Infrastructure cost as a percentage of revenue **decreases as you scale** — the business becomes more profitable per client over time.
