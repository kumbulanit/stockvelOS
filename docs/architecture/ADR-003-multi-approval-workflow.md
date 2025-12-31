# ADR-003: Multi-Approval Workflow

**Status:** Accepted  
**Date:** 2024-12-31  
**Author:** System Architect

## Context

Burial society payouts can be significant amounts (R50,000+). To prevent fraud and ensure governance:
- Multiple officers must approve payouts
- No single person can authorize large transactions
- Approval process must be auditable
- Time limits prevent stale approvals

## Decision

We will implement a **configurable multi-approval workflow** system.

### Approval Configuration

```typescript
interface ApprovalConfig {
  resourceType: 'burial_claim' | 'large_payout' | 'member_removal';
  requiredApprovals: number;
  requiredRoles: Role[];
  expiryHours: number;
  allowSelfApproval: boolean;
}

const BURIAL_CLAIM_APPROVAL: ApprovalConfig = {
  resourceType: 'burial_claim',
  requiredApprovals: 3,
  requiredRoles: ['chairman', 'treasurer', 'secretary'],
  expiryHours: 72,
  allowSelfApproval: false,
};
```

### Approval State Machine

```
┌─────────────┐
│   PENDING   │
└──────┬──────┘
       │ Approval received
       ▼
┌─────────────┐     threshold met     ┌─────────────┐
│  REVIEWING  │─────────────────────▶│  APPROVED   │
└──────┬──────┘                       └─────────────┘
       │ 
       │ expiry reached OR rejection
       ▼
┌─────────────┐
│  REJECTED/  │
│  EXPIRED    │
└─────────────┘
```

### Database Schema

```sql
CREATE TABLE approvals (
  id UUID PRIMARY KEY,
  approvable_type VARCHAR(50) NOT NULL,
  approvable_id UUID NOT NULL,
  approver_id UUID NOT NULL,
  decision VARCHAR(20) NOT NULL, -- 'approved' | 'rejected'
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  
  UNIQUE(approvable_type, approvable_id, approver_id)
);
```

### Business Rules

1. Each officer can only approve once per request
2. Requestor cannot approve their own request
3. Approvals expire after configured hours
4. Rejection by any required officer rejects the request
5. All approvals are audit logged

## Consequences

### Positive
- Prevents single-point-of-failure fraud
- Transparent governance
- Configurable per stokvel/type
- Full audit trail

### Negative
- Slower payout process
- Requires coordination between officers
- Can block legitimate urgent payouts
- More complex UI for approvers

### Mitigations
- Push notifications for pending approvals
- Dashboard showing approval status
- Emergency override with super-majority (future)
- Clear expiry warnings

## Alternatives Considered

1. **Single approver**: Rejected - fraud risk too high
2. **Unanimous approval**: Rejected - one absent officer blocks all
3. **External signing service**: Rejected - complexity, cost, availability
