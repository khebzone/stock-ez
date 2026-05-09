# DistroIQ — Enterprise FMCG Distribution Management Platform

> **SaaS platform for FMCG distributors** — manage products, routes, customers, sales orders, invoicing, warehouse preparation, delivery tracking, payments & accounting.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Java 21 + Spring Boot 3.5.x |
| Frontend | React 18 + TypeScript + Ant Design |
| Mobile | Flutter (Android + iOS) |
| Database | PostgreSQL 15 |
| Cache | Redis 7 |
| Auth | JWT (HS512) + Spring Security |
| API Docs | OpenAPI 3 / Swagger |
| Build | Maven Multi-Module |
| DevOps | Docker + Docker Compose |

## Quick Start

### Prerequisites
- Java 21+
- Docker & Docker Compose
- Node.js 18+

### 1. Start Database
```bash
docker-compose up -d
```
PostgreSQL: `localhost:5432` | pgAdmin: `localhost:5050`

### 2. Run Backend
```bash
cd distroiq-api
./mvnw spring-boot:run
```
API: `http://localhost:8080` | Swagger: `http://localhost:8080/swagger-ui.html`

### 3. Demo Login
- **Subdomain:** `demo`
- **Phone:** `9876543211` | **Password:** `Demo@123` (ADMIN)
- **Phone:** `9876543212` | **Password:** `Demo@123` (SALES)

## Project Structure
```
distroiq/
├── distroiq-common/    ← Shared module (exceptions, response wrappers)
├── distroiq-api/       ← Spring Boot REST API
├── distroiq-web/       ← React Admin Panel (TODO)
├── distroiq-mobile/    ← Flutter App (TODO)
├── docker-compose.yml  ← Local dev environment
└── pom.xml             ← Parent Maven POM
```

## API Modules
- **Auth** — Login, refresh token, logout
- **Tenants** — Multi-tenant distributor management
- **Users** — Role-based user management (7 roles)
- **Products** — Product catalogue with HSN, GST, pricing
- **Routes** — Sales routes with sub-places
- **Customers** — Customer management with route/place mapping
- **Orders** — Full lifecycle: Draft → Submitted → Approved → Prepared → Dispatched → Delivered
- **Payments** — Collection + Accountant clearance workflow

## License
Proprietary — DistroIQ Platform
