# BMA3 — F&B Financial Performance Engine

![CI](https://github.com/AshutoshMahindru/BMA3/actions/workflows/ci.yml/badge.svg)

A full-stack financial projection dashboard for F&B cloud kitchen operations in the UAE. Built for audit-readiness, multi-scenario planning, and investor reporting.

## Architecture

```
BMA3/
├── web/              # Next.js 14 frontend (20 dashboard screens)
│   ├── app/dashboard/ # Page routes (executive, pnl, cashflow, etc.)
│   ├── lib/data/      # Centralized financial data (single source of truth)
│   ├── lib/api.ts     # API client (try-first, fallback-silently)
│   └── components/    # Shared UI components
├── api/              # Express + TypeScript backend
│   └── src/routes/v1/ # 16 REST API modules
├── db/               # PostgreSQL schema & seed data
│   ├── 01-schema.sql
│   └── 02-seed.sql
└── docker-compose.yml # PostgreSQL 15 + Redis 7
```

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (for database)

### 1. Clone & Install

```bash
git clone https://github.com/AshutoshMahindru/BMA3.git
cd BMA3

# Install frontend dependencies
cd web && npm install && cd ..

# Install backend dependencies
cd api && npm install && cd ..
```

### 2. Start Database

```bash
docker compose up -d
```

### 3. Run Development Servers

```bash
# Terminal 1 — Frontend (http://localhost:3000)
cd web && npm run dev

# Terminal 2 — API (http://localhost:4000)
cd api && npm run dev
```

## Dashboard Screens

| # | Screen | Route | Description |
|---|--------|-------|-------------|
| S01 | Global Overview | `/dashboard` | Portfolio KPIs, P&L snapshot, market status |
| S02 | Executive Cockpit | `/dashboard/executive` | Revenue/EBITDA trends, scenario panel |
| S03 | Scenario Comparison | `/dashboard/scenario` | 4 scenarios × 3-year P&L, tornado chart |
| S04 | Cash & Funding | `/dashboard/cash` | Monthly CF waterfall, funding timeline |
| S05 | Capital Strategy | `/dashboard/capital` | Investment ladder, sensitivity matrix |
| S06 | Assumptions | `/dashboard/assumptions` | 4-tab editor with engine trigger |
| S10 | Monte Carlo Sim | `/dashboard/simulation` | Distribution analysis, output metrics |
| S11 | P&L Console | `/dashboard/pnl` | 14 line items × 12 months, EBITDA bridge |
| S12 | Cash Flow | `/dashboard/cashflow` | Quarterly CF statement, FCF trend |
| S13 | Balance Sheet | `/dashboard/balance-sheet` | BS projection, financial ratios |
| S14 | Unit Economics | `/dashboard/unit-economics` | Per-order waterfall, kitchen ranking |

*Plus 9 additional screens: Attractiveness, Confidence, Decisions, Explainability, Governance, Markets, Portfolio, Risk, Triggers, Versions.*

## Data Architecture

All financial data flows from centralized modules in `web/lib/data/`:

| Module | Contents |
|--------|----------|
| `kpis.ts` | Portfolio-level KPIs, quarterly P&L, market data |
| `pnl.ts` | Monthly P&L (14 rows × 12 months), EBITDA bridge |
| `balance-sheet.ts` | BS line items (28 rows), 6 financial ratios |
| `cashflow.ts` | Quarterly CF statement, FCF monthly, burn rate |
| `scenarios.ts` | 4 scenario definitions, 3-year comparison |
| `capital.ts` | Investment ladder, 5×5 sensitivity matrix |
| `unit-economics.ts` | Per-order waterfall, kitchen ranking |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | Express, TypeScript, BullMQ |
| Database | PostgreSQL 15 |
| Cache/Queue | Redis 7 |
| CI/CD | GitHub Actions |

## Environment Variables

```env
# web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1

# api/.env
PORT=4000
DATABASE_URL=postgresql://fpe_admin:fpe_password@localhost:5432/fpe_db
REDIS_URL=redis://localhost:6379
```

## License

Private — All rights reserved.