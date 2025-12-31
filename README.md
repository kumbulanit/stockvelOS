# Stockvel OS

A comprehensive financial management platform for South African stokvels (savings clubs).

## Overview

Stockvel OS supports four distinct stokvel types:
- **Savings Stokvel** - Monthly contributions with annual/scheduled payouts
- **Grocery Stokvel** - Bulk purchasing and distribution of groceries
- **Burial Society** - Emergency funeral expense coverage
- **ROSCA** (Rotating Savings) - Members take turns receiving the full pot

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        STOCKVEL OS                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Flutter    │  │   Flutter    │  │   Flutter    │          │
│  │   Mobile     │◄─┤   Offline    │──┤   Push       │          │
│  │   App        │  │   Storage    │  │   Notifs     │          │
│  └──────┬───────┘  └──────────────┘  └──────────────┘          │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │                    API Gateway                                ││
│  │         (Rate Limiting, Auth, Versioning)                     ││
│  └──────────────────────────────────────────────────────────────┘│
│         │                                                        │
│         ▼                                                        │
│  ┌────────────┬────────────┬────────────┬────────────┐          │
│  │ Contrib    │ Ledger     │ Grocery    │ Burial     │          │
│  │ Service    │ Service    │ Service    │ Service    │          │
│  └─────┬──────┴─────┬──────┴─────┬──────┴─────┬──────┘          │
│        │            │            │            │                  │
│        ▼            ▼            ▼            ▼                  │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │              PostgreSQL (Event Sourced Ledger)                ││
│  │                   + Audit Log Tables                          ││
│  └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile | Flutter 3.x + Riverpod |
| Backend | Node.js + Express/Fastify |
| Database | PostgreSQL 15+ |
| Cache | Redis |
| Queue | BullMQ |
| Storage | S3-compatible (POP uploads) |

## Project Structure

```
stockvelOS/
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── modules/        # Feature modules
│   │   ├── shared/         # Shared utilities
│   │   └── infrastructure/ # DB, queue, storage
│   └── tests/
├── mobile/                  # Flutter application
│   └── lib/
│       ├── features/       # Feature-based modules
│       ├── core/           # Shared widgets, utils
│       └── data/           # Repositories, models
├── docs/                    # Architecture & API docs
│   └── agents/             # AI agent prompts
└── shared/                  # Shared types/contracts
```

## Non-Negotiables

- ✅ Decimal types for all monetary values (no floats)
- ✅ Soft deletes only for financial records
- ✅ Audit logs for all sensitive operations
- ✅ Role-based access control (RBAC)
- ✅ One chairman per group type per member
- ✅ POPIA compliant data handling
- ✅ Offline-first mobile experience

## Getting Started

```bash
# Backend
cd backend && npm install && npm run dev

# Mobile
cd mobile && flutter pub get && flutter run
```

## License

Proprietary - All rights reserved
