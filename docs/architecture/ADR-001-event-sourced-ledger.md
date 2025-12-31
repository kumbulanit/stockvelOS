# ADR-001: Event-Sourced Ledger

**Status:** Accepted  
**Date:** 2024-12-31  
**Author:** System Architect

## Context

Stockvel OS handles financial transactions for multiple stokvel types. Financial records must be:
- Immutable (no deletions or modifications)
- Auditable (complete history)
- Consistent (balances always match transactions)
- Correctable (ability to fix errors without losing history)

Traditional CRUD approaches risk data loss and make auditing difficult.

## Decision

We will implement an **event-sourced ledger** where:

1. All financial changes are recorded as immutable events
2. Current balances are derived from replaying events
3. Corrections are made via compensating events, not updates
4. A materialized view maintains current balances for fast reads

### Event Store Schema

```sql
CREATE TABLE ledger_events (
  event_id UUID PRIMARY KEY,
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  metadata JSONB NOT NULL,
  version INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Example Events

```json
// Contribution received
{
  "event_type": "contribution_received",
  "payload": {
    "member_id": "uuid",
    "amount": "1000.0000",
    "currency": "ZAR",
    "period": "2024-12"
  }
}

// Correction (adding money back)
{
  "event_type": "correction_credit",
  "payload": {
    "reason": "Duplicate fee reversal",
    "original_event_id": "uuid",
    "amount": "50.0000"
  }
}
```

## Consequences

### Positive
- Complete audit trail without extra effort
- Cannot accidentally lose financial history
- Easy to implement point-in-time queries
- Supports regulatory compliance

### Negative
- More complex queries (must aggregate events)
- Storage grows faster (events never deleted)
- Need materialized views for performance
- Learning curve for developers

### Mitigations
- Implement snapshotting for frequently queried aggregates
- Use background jobs to update materialized views
- Document event patterns clearly

## Alternatives Considered

1. **Traditional CRUD with audit table**: Rejected - audit table can drift, harder to guarantee consistency
2. **Soft deletes only**: Rejected - doesn't capture the "why" of changes
3. **Blockchain**: Rejected - overkill, performance concerns, complexity
