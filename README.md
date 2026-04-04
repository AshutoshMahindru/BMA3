# BMA3 — Food Business Modelling Engine

Full-stack financial projection engine for dark kitchen / cloud kitchen operations.

## Architecture

- **Frontend:** Next.js 14 (App Router), AG Grid, Tailwind CSS
- **API:** Express + TypeScript REST at `/api/v1/`
- **Database:** PostgreSQL 15 (50 tables, multi-tenant)
- **Compute:** BullMQ + Redis (18-step computation DAG)
- **Spec:** SpecOS v2 submodule at `specos/` — all code traces to spec artifacts

## Quick Start

```bash
# Clone with submodule
git clone --recurse-submodules https://github.com/AshutoshMahindru/BMA3.git
cd BMA3

# Start database + redis
docker-compose up -d

# API
cd api && npm install && npm run dev

# Web
cd web && npm install && npm run dev
```

## Repository Structure

```
BMA3/
├── AGENTS.md              — AI agent onboarding (conventions, rules, lookups)
├── CODEGEN.md             — SpecOS artifact → code-file mapping
├── specos/                — SpecOS v2 submodule (canonical spec)
│   ├── artifacts/         — Buildable specs (schema, APIs, DDL, compute graph)
│   ├── specos/            — Phase orchestration indexes
│   └── validate_specos.py — Self-verification (12 checks)
├── api/                   — Express + TypeScript backend
│   └── src/
│       ├── routes/v1/     — REST endpoints
│       ├── compute/       — BullMQ computation nodes
│       ├── schemas/       — Zod validation schemas
│       └── types/         — TypeScript interfaces
├── db/                    — PostgreSQL schema + migrations
├── web/                   — Next.js dashboard frontend
├── tests/                 — Integration + API + E2E tests
└── docker-compose.yml     — PostgreSQL 15 + Redis 7
```

## Spec-Driven Development

All code in this repo traces to SpecOS artifacts. See [AGENTS.md](AGENTS.md) for conventions and [CODEGEN.md](CODEGEN.md) for the artifact → code mapping.

| Need | Open |
|---|---|
| Entity fields / column names | `specos/artifacts/canonical_schema.json` |
| API endpoint contracts | `specos/artifacts/api_contracts.json` |
| Variable formulas | `specos/artifacts/variable_registry.json` |
| Computation pipeline | `specos/artifacts/computation_graph.json` |
| Database DDL | `specos/artifacts/ddl.sql` |
| Screen → API binding | `specos/artifacts/traceability.json` |

## CI

Three parallel jobs on every PR:
1. **SpecOS** — validates spec integrity (12 cross-artifact checks)
2. **Web** — lint + type check + build
3. **API** — type check + build
