import 'package:drift/drift.dart';

/// Pending confirmations table for offline support
class PendingConfirmations extends Table {
  TextColumn get id => text()();
  TextColumn get itemId => text()();
  TextColumn get idempotencyKey => text()();
  TextColumn get status => text()(); // 'COLLECTED' or 'UNCOLLECTED'
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  DateTimeColumn get lastRetryAt => dateTime().nullable()();
  BoolColumn get synced => boolean().withDefault(const Constant(false))();
  TextColumn get errorMessage => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached allocations for offline viewing
class CachedAllocations extends Table {
  TextColumn get id => text()();
  TextColumn get distributionId => text()();
  TextColumn get eventName => text()();
  DateTimeColumn get eventDate => dateTime()();
  TextColumn get distributionStatus => text()();
  TextColumn get itemsJson => text()(); // JSON array of items
  IntColumn get pendingCount => integer()();
  IntColumn get totalCount => integer()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cached grocery groups for offline viewing
class CachedGroceryGroups extends Table {
  TextColumn get groupId => text()();
  TextColumn get groupName => text()();
  IntColumn get pendingAllocations => integer()();
  IntColumn get totalDistributions => integer()();
  DateTimeColumn get nextDistributionDate => dateTime().nullable()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {groupId};
}
