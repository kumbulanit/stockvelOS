# StockvelOS - Savings Module

A complete implementation of the **Savings Stokvel Module** for StockvelOS, the South African stokvel management platform. This module provides end-to-end functionality for managing rotating savings groups (stokvels), including contributions, payouts, and financial ledger tracking.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                  │
├────────────────────────────────┬────────────────────────────────────────┤
│       Web (React + Vite)       │      Mobile (Flutter + Riverpod)       │
│   - TailwindCSS + Radix UI     │   - Offline-first with Drift (SQLite)  │
│   - React Query for caching    │   - Background sync queue              │
│   - Zustand for auth state     │   - Secure storage for tokens          │
└────────────────────────────────┴────────────────────────────────────────┘
                                   │
                                   │ HTTPS / REST
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY                                    │
│                     NestJS 10 + TypeScript                              │
├─────────────────────────────────────────────────────────────────────────┤
│  JWT Auth │ RBAC Guards │ Rate Limiting │ Audit Logging │ Validation   │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
┌─────────────────┐   ┌─────────────────────┐   ┌──────────────────────┐
│ PostgreSQL 16   │   │      Redis 7        │   │      MinIO (S3)      │
│ - Users/Groups  │   │ - Session cache     │   │ - POP documents      │
│ - Contributions │   │ - Rate limiting     │   │ - Signed URLs        │
│ - Ledger        │   │ - BullMQ jobs       │   │                      │
│ - Audit logs    │   │                     │   │                      │
└─────────────────┘   └─────────────────────┘   └──────────────────────┘
```

## Overview

Stockvel OS supports four distinct stokvel types:
- **Savings Stokvel** - Monthly contributions with annual/scheduled payouts (✅ Implemented)
- **Grocery Stokvel** - Bulk purchasing and distribution of groceries
- **Burial Society** - Emergency funeral expense coverage
- **ROSCA** (Rotating Savings) - Members take turns receiving the full pot
| Database | PostgreSQL 15+ |
| Cache | Redis |
| Queue | BullMQ |
| Storage | S3-compatible (POP uploads) |

## Project Structure

## 📁 Project Structure

```
stockvelOS/
├── backend-nest/                 # NestJS Backend
│   ├── prisma/
│   │   └── schema.prisma         # Database schema
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/             # JWT authentication & RBAC
│   │   │   ├── audit/            # Audit logging
│   │   │   ├── groups/           # Group management
│   │   │   ├── memberships/      # Member roles & status
│   │   │   ├── savings/          # Savings rules & balance
│   │   │   ├── contributions/    # Contribution CRUD & approval
│   │   │   ├── payouts/          # Payout scheduling & processing
│   │   │   ├── ledger/           # Double-entry ledger
│   │   │   ├── documents/        # S3 document storage
│   │   │   ├── notifications/    # Email, SMS, push, in-app
│   │   │   └── health/           # Health checks
│   │   └── main.ts
│   ├── test/                     # Unit & E2E tests
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── web/                          # React Web Frontend
│   ├── src/
│   │   ├── components/ui/        # Reusable UI components
│   │   ├── layouts/              # Auth & Dashboard layouts
│   │   ├── pages/                # Route pages
│   │   ├── stores/               # Zustand state management
│   │   ├── lib/                  # API client & utilities
│   │   └── hooks/                # Custom hooks
│   ├── package.json
│   └── vite.config.ts
│
├── mobile/                       # Flutter Mobile App
│   ├── lib/
│   │   ├── core/
│   │   │   ├── database/         # Drift SQLite for offline
│   │   │   ├── network/          # Dio API client
│   │   │   ├── services/         # Connectivity, sync, storage
│   │   │   ├── models/           # Freezed data classes
│   │   │   ├── repositories/     # Offline-first data access
│   │   │   └── providers/        # Riverpod state management
│   │   └── features/             # Feature modules
│   └── pubspec.yaml
│
└── docs/                         # Architecture documentation
    └── architecture.md
```

## Non-Negotiables

- ✅ Decimal types for all monetary values (no floats)
- ✅ Soft deletes only for financial records
- ✅ Audit logs for all sensitive operations
- ✅ Role-based access control (RBAC)
- ✅ One chairman per group type per member
- ✅ POPIA compliant data handling
- ✅ Offline-first mobile experience

## 🚀 Quick Start

### Prerequisites

- **Docker** & **Docker Compose** (v2.0+)
- **Node.js** 20+ (for local development)
- **Flutter** 3.16+ (for mobile development)
- **pnpm** (recommended) or npm

### 1. Clone and Setup

```bash
cd stockvelOS

# Install backend dependencies
cd backend-nest
pnpm install

# Copy environment file
cp .env.example .env
```

### 2. Start Infrastructure with Docker

```bash
# Start all services (PostgreSQL, Redis, MinIO, MailHog)
docker-compose up -d

# Run database migrations
pnpm prisma migrate dev

# Seed initial data (optional)
pnpm prisma db seed
```

### 3. Start the Backend

```bash
# Development mode with hot reload
pnpm start:dev

# Production build
pnpm build && pnpm start:prod
```

The API will be available at `http://localhost:3000`

### 4. Start the Web Frontend

```bash
cd ../web
pnpm install
pnpm dev
```

The web app will be available at `http://localhost:5173`

### 5. Run the Mobile App

```bash
cd ../mobile
flutter pub get

# Generate code (Drift, Freezed, Riverpod)
dart run build_runner build --delete-conflicting-outputs

# Run on simulator/device
flutter run
```

## 🔑 Environment Variables

Create a `.env` file in `backend-nest/`:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/stockvel?schema=public"

# JWT Secrets
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Redis
REDIS_HOST="localhost"
REDIS_PORT="6379"

# S3 (MinIO for local dev)
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET="stockvel-documents"
S3_REGION="us-east-1"

# Email (MailHog for local dev)
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="noreply@stockvelos.co.za"
```

## 📚 API Documentation

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Register new user |
| `/api/auth/login` | POST | Login, returns JWT tokens |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/logout` | POST | Invalidate tokens |
| `/api/auth/profile` | GET | Get current user profile |

### Groups & Savings

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/groups` | GET | List user's groups |
| `/api/groups` | POST | Create new group |
| `/api/groups/:id` | GET | Get group details |
| `/api/savings/:id` | GET | Get savings group with rules |
| `/api/savings/:id/balance` | GET | Get pool balance |
| `/api/savings/:id/payout-schedule` | GET | Get payout schedule |

### Contributions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/contributions/submit/:groupId` | POST | Submit contribution |
| `/api/contributions/my/:groupId` | GET | My contributions |
| `/api/contributions/group/:groupId` | GET | Group contributions |
| `/api/contributions/:id/approve` | PUT | Approve (Treasurer) |
| `/api/contributions/:id/reject` | PUT | Reject (Treasurer) |

### Payouts

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payouts/group/:groupId` | GET | List group payouts |
| `/api/payouts/:id/approve` | PUT | Approve payout |
| `/api/payouts/:id/complete` | PUT | Mark as paid |

### Ledger

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ledger/group/:groupId` | GET | Transaction history |
| `/api/ledger/member/:membershipId` | GET | Member transactions |

## 🔐 Role-Based Access Control (RBAC)

### Group Roles

| Role | Permissions |
|------|-------------|
| **CHAIRPERSON** | Full access, manage members, approve payouts |
| **TREASURER** | Approve/reject contributions, process payouts |
| **SECRETARY** | View all data, manage documents |
| **MEMBER** | Submit contributions, view own data |

## 📱 Offline Support (Mobile)

The Flutter app implements **offline-first** architecture:

1. **Local Database**: Drift (SQLite) stores all data locally
2. **Offline Queue**: Operations queue when offline
3. **Idempotency Keys**: Prevent duplicate submissions
4. **Background Sync**: Auto-sync when connectivity returns

```dart
// Submit contribution works offline
final contribution = await repository.submitContribution(
  groupId: 'xxx',
  amount: 1000.0,
  contributionPeriod: '2025-01',
  paymentMethod: 'BANK_TRANSFER',
  // idempotencyKey generated automatically
);
```

## 🧪 Testing

### Backend Tests

```bash
cd backend-nest

# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Coverage
pnpm test:cov
```

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop all services
docker-compose down

# Reset database
docker-compose down -v
docker-compose up -d
```

## 📊 Database Schema

Key entities:

- **User**: Authentication & profile
- **Group**: Stokvel organization
- **Membership**: User ↔ Group with role
- **SavingsRule**: Contribution/payout configuration
- **Contribution**: Member payments with status
- **Payout**: Scheduled disbursements
- **LedgerEntry**: Financial audit trail
- **Notification**: Multi-channel alerts
- **AuditLog**: Action history

See [prisma/schema.prisma](backend-nest/prisma/schema.prisma) for full schema.

## 🔄 Contribution Flow

```
Member                    Treasurer                   System
  │                          │                          │
  │──Submit Contribution───▶│                          │
  │   (amount, period,      │                          │
  │    payment method,      │                          │
  │    POP document)        │                          │
  │                         │                          │
  │                         │──Review Contribution────▶│
  │                         │                          │
  │                         │◀─Approve/Reject─────────│
  │                         │                          │
  │◀─Notification───────────│                          │
  │   (status update)       │                          │
  │                         │                          │
  │                         │                          │──Create Ledger Entry
  │                         │                          │──Update Pool Balance
  │                         │                          │──Check Payout Trigger
```

## 🛡️ Security Features

- ✅ JWT with refresh tokens
- ✅ Password hashing with bcrypt
- ✅ Role-based access control
- ✅ Rate limiting per IP/user
- ✅ Audit logging for all actions
- ✅ Input validation with class-validator
- ✅ SQL injection prevention (Prisma)
- ✅ XSS protection headers
- ✅ CORS configuration
- ✅ Secure cookie settings

## License

MIT License - All rights reserved
