# ADR-002: Offline-First Mobile Architecture

**Status:** Accepted  
**Date:** 2024-12-31  
**Author:** System Architect

## Context

Stockvel OS users in South Africa may have:
- Unreliable network connectivity
- Data costs concerns (avoid unnecessary API calls)
- Need to record contributions in areas with no signal
- Expectation that the app "just works"

A traditional online-first approach would result in poor UX.

## Decision

We will implement an **offline-first architecture** with the following components:

### 1. Local Database (Drift/SQLite)
All data is stored locally first. The app can function fully offline.

### 2. Sync Queue
All mutations are queued locally and synced when online.

```dart
class SyncQueueEntry {
  String id;
  String operationType;
  Map<String, dynamic> payload;
  String idempotencyKey;
  DateTime createdAt;
  int retryCount;
  SyncStatus status;
}
```

### 3. Idempotency Keys
Every mutation includes a UUID v7 idempotency key. Server stores processed keys for 7 days.

### 4. Conflict Resolution
- **Server wins** for most conflicts
- User is notified of any merged changes
- Critical conflicts (e.g., double-spend) flag for manual review

### 5. Sync Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   User      │    │   Local     │    │   Server    │
│   Action    │───▶│   DB +      │───▶│   API       │
│             │    │   Queue     │    │             │
└─────────────┘    └──────┬──────┘    └──────┬──────┘
                          │                   │
                          │   On Reconnect    │
                          │◀──────────────────│
                          │   Reconcile       │
                          │                   │
```

## Consequences

### Positive
- App works without network
- Faster perceived performance
- Reduced data usage
- Better UX in low-connectivity areas

### Negative
- More complex state management
- Potential for stale data
- Conflict resolution complexity
- Larger app storage footprint

### Mitigations
- Clear UI indicators for sync status
- Background sync when on WiFi
- Configurable sync frequency
- Storage cleanup for old synced data

## Alternatives Considered

1. **Online-only**: Rejected - poor UX for target market
2. **Cache-first**: Rejected - doesn't allow offline mutations
3. **Full CRDT**: Rejected - complexity not justified for this use case
