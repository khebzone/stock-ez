# StockEz — FMCG Distribution Management Platform

> Multi-tenant SaaS for FMCG distributors — products and batch stock, sales routes, orders and
> invoicing, warehouse picking, delivery runs, collections, goods returns, GST reporting.

Live since 15 June 2026.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Java 21 + Spring Boot 3.4.1 |
| Frontend | React 19 + TypeScript + Vite + Ant Design |
| Database | PostgreSQL 15 + Flyway |
| Cache | Redis 7 |
| Object storage | Cloudflare R2 (S3 API) — product and tenant images |
| Auth | JWT + Spring Security, tenant bound in the token |
| PDF | OpenPDF — invoices, payment receipts, debit notes |
| API docs | OpenAPI 3 / Swagger |
| Build | Maven multi-module |
| Production | Docker Compose behind nginx |

## Quick Start

Prerequisites: Java 21+, Node.js 18+, Docker.

Double-click **`start.bat`** in the project root — it brings up the database, API and web app
together. To run the pieces separately:

```bash
docker compose up -d          # PostgreSQL + Redis

cd stockez-api
.\mvnw.cmd spring-boot:run     # API on :8080, Swagger at /swagger-ui.html

cd stockez-web
npm run dev                    # web app on :5173
```

Dev login credentials are in [CLAUDE.md](CLAUDE.md).

## Project Structure

```
StockEz/
├── start.bat             ← runs everything
├── deploy/               ← prod compose, nginx, backups, runbooks
├── stockez-common/       ← exceptions, response wrappers
├── stockez-api/          ← Spring Boot REST API
├── stockez-web/          ← React admin + field app
├── docker-compose.yml    ← local dev database
└── pom.xml               ← parent Maven POM
```

## Modules

**Selling** — orders (Draft → Submitted → Approved → Packed → Dispatched → Delivered), counter
sale, invoice approval, gate passes, route allocations.

**Stock** — purchase entry with auto batch numbering, FIFO batch deduction, expiry tracking,
goods returns (sales / purchase / damage / old stock), stock adjustments and shortages.

**Money** — collections with cheque clearance, day closure, customer and supplier outstanding,
credit limits, expenses, incentives.

**Reports** — daily, aging, sales analysis, profit, customer and supplier statements, closing and
dead stock, sales and purchase registers, **GSTR-1 filing** (B2B / B2C / HSN / credit notes).

**Platform** — multi-tenant with per-tenant settings and invoice branding, role-based permissions,
attendance, audit log, notifications, Excel import/export.

## Database Migrations

The schema is live. **Never edit an applied migration** — Flyway tracks checksums and the
application will refuse to start. Every change is a new `V<n>__description.sql`; run
`ls stockez-api/src/main/resources/db/migration/` first to find the next number. Details and the
rest of the working conventions are in [CLAUDE.md](CLAUDE.md).

## Tests

```bash
cd stockez-api && .\mvnw.cmd test
```

`GoodsReturnQueryParseTest` parses every `@Query` in the application as JPQL without a database.
A malformed query stops the app from starting, so run this before any deploy that touches a
repository.

## Deployment

See [deploy/DEPLOY_RUNBOOK.md](deploy/DEPLOY_RUNBOOK.md). Production runs on Docker Compose with
PostgreSQL and Redis on an internal-only network, nginx terminating TLS, and database backups
every five minutes to Cloudflare R2.

## License

Proprietary.
