# Savings Stokvel Module - Architecture Document

## 1. Overview

The Savings Stokvel module enables members to contribute fixed recurring amounts to a shared pot, with governance controls for approvals, payouts, and audit trails. This document describes the architecture, data flows, and integration points.

## 2. Module Location in System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          STOCKVEL OS PLATFORM                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   SAVINGS   │  │   GROCERY   │  │   BURIAL    │  │    ROSCA    │   │
│  │   MODULE    │  │   MODULE    │  │   MODULE    │  │   MODULE    │   │
│  └──────┬──────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│         │                                                               │
├─────────┼───────────────────────────────────────────────────────────────┤
│         │           SHARED PLATFORM SERVICES                            │
│         │                                                               │
│  ┌──────▼──────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   GROUPS    │  │    AUTH     │  │   LEDGER    │  │    AUDIT    │   │
│  │ MEMBERSHIP  │  │   & RBAC    │  │   SERVICE   │  │   SERVICE   │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  DOCUMENTS  │  │NOTIFICATIONS│  │   STORAGE   │  │  JOBS/QUEUE │   │
│  │   SERVICE   │  │   SERVICE   │  │    (S3)     │  │  (BullMQ)   │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3. System Component View (Savings Flows)

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[React Web Console]
        MOB[Flutter Mobile App]
    end

    subgraph "API Gateway"
        GW[NestJS API Server]
    end

    subgraph "Savings Module"
        SC[Savings Controller]
        SS[Savings Service]
        SR[Savings Rules]
        SP[Savings Payouts]
    end

    subgraph "Shared Services"
        AS[Auth Service]
        CS[Contribution Service]
        LS[Ledger Service]
        DS[Document Service]
        NS[Notification Service]
        AL[Audit Logger]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL)]
        RD[(Redis)]
        S3[(S3/MinIO)]
    end

    subgraph "Background Jobs"
        BQ[BullMQ Worker]
    end

    WEB --> GW
    MOB --> GW
    
    GW --> AS
    GW --> SC
    
    SC --> SS
    SS --> SR
    SS --> SP
    SS --> CS
    SS --> LS
    SS --> DS
    SS --> NS
    SS --> AL
    
    CS --> LS
    CS --> AL
    
    SS --> PG
    LS --> PG
    AL --> PG
    DS --> S3
    DS --> PG
    
    NS --> BQ
    BQ --> RD
```

## 4. Sequence Diagram: Contribution Workflow

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant API as NestJS API
    participant Auth as Auth Guard
    participant CS as ContributionService
    participant DS as DocumentService
    participant LS as LedgerService
    participant NS as NotificationService
    participant AL as AuditLogger
    participant DB as PostgreSQL
    participant S3 as S3 Storage

    rect rgb(200, 220, 240)
        Note over M,S3: Phase 1: Member Submits Contribution
        M->>API: POST /groups/:id/contributions
        API->>Auth: Validate JWT + RBAC
        Auth-->>API: User authenticated
        API->>CS: createContribution(dto)
        CS->>DS: uploadPOP(file)
        DS->>S3: Store file
        S3-->>DS: storage_key
        DS->>DB: Insert document record
        DS-->>CS: documentId
        CS->>DB: Insert contribution (PENDING)
        CS->>AL: log(CONTRIBUTION_CREATED)
        AL->>DB: Insert audit_log
        CS->>NS: notifyTreasurer(groupId)
        CS-->>API: ContributionResponse
        API-->>M: 201 Created
    end

    rect rgb(220, 240, 200)
        Note over M,S3: Phase 2: Treasurer Approves Contribution
        M->>API: POST /contributions/:id/approve
        API->>Auth: Validate JWT + TREASURER role
        Auth-->>API: User authorized
        API->>CS: approveContribution(id, dto)
        CS->>DB: Check contribution exists & PENDING
        CS->>DB: Update contribution → APPROVED
        CS->>LS: creditContribution(amount, ref)
        LS->>DB: BEGIN TRANSACTION
        LS->>DB: Calculate new balance
        LS->>DB: Insert ledger_entry
        LS->>DB: COMMIT TRANSACTION
        LS-->>CS: LedgerEntry
        CS->>AL: log(CONTRIBUTION_APPROVED)
        CS->>NS: notifyMember(contributionApproved)
        CS-->>API: ApprovalResponse
        API-->>M: 200 OK
    end
```

## 5. Sequence Diagram: Payout Workflow

```mermaid
sequenceDiagram
    autonumber
    participant C as Chair/Treasurer
    participant API as NestJS API
    participant PS as PayoutService
    participant LS as LedgerService
    participant AL as AuditLogger
    participant NS as NotificationService
    participant DB as PostgreSQL

    rect rgb(240, 220, 200)
        Note over C,DB: Phase 1: Create Payout Request
        C->>API: POST /groups/:id/savings/payouts
        API->>PS: createPayout(dto)
        PS->>DB: Get current pot balance
        PS->>DB: Validate amount <= balance
        PS->>DB: Insert savings_payout (PENDING)
        PS->>AL: log(PAYOUT_CREATED)
        PS->>NS: notifyApprovers(groupId)
        PS-->>API: PayoutResponse
        API-->>C: 201 Created
    end

    rect rgb(220, 200, 240)
        Note over C,DB: Phase 2: Multi-Signature Approval
        C->>API: POST /savings/payouts/:id/approve
        API->>PS: approvePayout(id, dto)
        PS->>DB: Check payout exists & PENDING
        PS->>DB: Insert payout_approval
        PS->>DB: Count approvals vs required
        alt Enough Approvals
            PS->>DB: Update payout → APPROVED
            PS->>LS: debitPayout(amount, ref)
            LS->>DB: BEGIN TRANSACTION
            LS->>DB: Calculate new balance
            LS->>DB: Insert ledger_entry (DEBIT)
            LS->>DB: COMMIT
            PS->>AL: log(PAYOUT_APPROVED)
            PS->>NS: notifyRecipients(payout)
        else Not Enough Approvals
            PS->>AL: log(PAYOUT_APPROVAL_ADDED)
            PS->>NS: notifyPendingApprovers()
        end
        PS-->>API: ApprovalResponse
        API-->>C: 200 OK
    end
```

## 6. Integration Points

### 6.1 Auth Service
- Validates JWT tokens
- Provides user context
- Manages sessions
- RBAC guard decorators

### 6.2 Groups & Membership Service
- Creates savings groups (type = 'SAVINGS')
- Manages member roles (MEMBER, TREASURER, CHAIRPERSON)
- Enforces one-chair-per-savings-group rule

### 6.3 Ledger Service
- Append-only financial record
- Transactional balance updates
- Supports CREDIT/DEBIT entry types
- Never deletes, only adjustments

### 6.4 Document Service
- S3-compatible file storage
- Signed URL generation
- Metadata tracking
- Access control per group

### 6.5 Notification Service
- Email/SMS/Push notifications
- Queued via BullMQ
- Templates for:
  - Contribution reminders
  - Approval requests
  - Payout notifications
  - Late payment alerts

### 6.6 Audit Service
- Structured logging for all mutations
- Before/after state snapshots
- Actor tracking
- Compliance reporting

## 7. Data Flow Summary

| Flow | Trigger | Services Involved | Audit Event |
|------|---------|-------------------|-------------|
| Submit Contribution | Member | Contribution, Document, Notification | CONTRIBUTION_CREATED |
| Approve Contribution | Treasurer | Contribution, Ledger, Notification | CONTRIBUTION_APPROVED |
| Reject Contribution | Treasurer | Contribution, Notification | CONTRIBUTION_REJECTED |
| Create Payout | Chair/Treasurer | Payout, Notification | PAYOUT_CREATED |
| Approve Payout | Chair + Treasurer | Payout, Ledger, Notification | PAYOUT_APPROVED |
| Update Rules | Chairperson | Savings Rules, Notification | RULES_UPDATED |
| Generate Statement | Member/System | Ledger, Document | STATEMENT_GENERATED |

## 8. Security Considerations

### 8.1 Role-Based Access Control (RBAC)

| Action | MEMBER | TREASURER | CHAIRPERSON | PLATFORM_ADMIN |
|--------|--------|-----------|-------------|----------------|
| View own contributions | ✅ | ✅ | ✅ | ❌ |
| Submit contribution | ✅ | ✅ | ✅ | ❌ |
| Approve contribution | ❌ | ✅ | ✅ | ❌ |
| Create payout | ❌ | ✅ | ✅ | ❌ |
| Approve payout | ❌ | ✅ | ✅ | ❌ |
| Modify rules | ❌ | ❌ | ✅ | ❌ |
| View group ledger | ✅ | ✅ | ✅ | ❌ |
| View all group data | ❌ | ✅ | ✅ | ❌ |

### 8.2 Data Protection
- PII encrypted at rest
- Bank details encrypted with separate key
- Signed URLs expire after 15 minutes
- Rate limiting on all endpoints
- POPIA compliance for SA data

## 9. Offline Support Strategy

### 9.1 Mobile Offline Queue
```
┌────────────────────────────────────────────────────────┐
│                    MOBILE APP                          │
├────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐                 │
│  │  UI Layer    │───▶│ State Mgmt   │                 │
│  └──────────────┘    │  (Riverpod)  │                 │
│                      └──────┬───────┘                 │
│                             │                          │
│  ┌──────────────────────────▼─────────────────────┐   │
│  │              SYNC SERVICE                       │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │   │
│  │  │ Online  │  │ Offline │  │ Conflict        │ │   │
│  │  │ Handler │  │ Queue   │  │ Resolution      │ │   │
│  │  └────┬────┘  └────┬────┘  └─────────────────┘ │   │
│  └───────┼────────────┼──────────────────────────────┘│
│          │            │                               │
│  ┌───────▼────────────▼───────────────────────────┐   │
│  │           LOCAL DATABASE (Drift)                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │   │
│  │  │ Pending  │  │ Cached   │  │ Sync         │ │   │
│  │  │ Actions  │  │ Data     │  │ Metadata     │ │   │
│  │  └──────────┘  └──────────┘  └──────────────┘ │   │
│  └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

### 9.2 Idempotency Keys
- Client generates UUID for each action
- Server stores in `idempotency_keys` table
- Duplicate requests return cached response
- Keys expire after 24 hours

## 10. Performance Considerations

- Ledger queries indexed by `stokvel_id` + `created_at`
- Contribution lookups indexed by `stokvel_id` + `period_start` + `member_id`
- Redis caching for pot balance (invalidated on ledger update)
- Pagination on all list endpoints
- Background job processing for notifications
