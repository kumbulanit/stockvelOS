// GENERATED CODE - Drift Database Schema
// Run: dart run build_runner build

import 'package:drift/drift.dart';

// ===============================
// Tables
// ===============================

class Users extends Table {
  TextColumn get id => text()();
  TextColumn get email => text()();
  TextColumn get firstName => text()();
  TextColumn get lastName => text()();
  TextColumn get phone => text().nullable()();
  TextColumn get role => text()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();
  DateTimeColumn get syncedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class Groups extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get description => text().nullable()();
  TextColumn get type => text()();
  TextColumn get status => text()();
  IntColumn get memberCount => integer().withDefault(const Constant(0))();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();
  DateTimeColumn get syncedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class Memberships extends Table {
  TextColumn get id => text()();
  TextColumn get groupId => text().references(Groups, #id)();
  TextColumn get userId => text().references(Users, #id)();
  TextColumn get role => text()();
  TextColumn get status => text()();
  DateTimeColumn get joinedAt => dateTime()();
  DateTimeColumn get syncedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class SavingsRules extends Table {
  TextColumn get id => text()();
  TextColumn get groupId => text().references(Groups, #id)();
  TextColumn get contributionFrequency => text()();
  RealColumn get contributionAmount => real()();
  IntColumn get contributionDayOfMonth => integer().nullable()();
  TextColumn get payoutOrder => text()();
  IntColumn get gracePeriodDays => integer().withDefault(const Constant(3))();
  RealColumn get lateFeePct => real().withDefault(const Constant(5.0))();
  BoolColumn get autoApproveContributions => boolean().withDefault(const Constant(false))();
  DateTimeColumn get startDate => dateTime()();
  DateTimeColumn get endDate => dateTime().nullable()();
  DateTimeColumn get syncedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class Contributions extends Table {
  TextColumn get id => text()();
  TextColumn get membershipId => text().references(Memberships, #id)();
  TextColumn get groupId => text().references(Groups, #id)();
  RealColumn get amount => real()();
  TextColumn get contributionPeriod => text()();
  TextColumn get status => text()();
  TextColumn get paymentMethod => text().nullable()();
  TextColumn get externalReference => text().nullable()();
  TextColumn get popDocumentId => text().nullable()();
  TextColumn get approverNotes => text().nullable()();
  TextColumn get idempotencyKey => text()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get approvedAt => dateTime().nullable()();
  DateTimeColumn get syncedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class Payouts extends Table {
  TextColumn get id => text()();
  TextColumn get groupId => text().references(Groups, #id)();
  TextColumn get recipientMembershipId => text().references(Memberships, #id)();
  RealColumn get amount => real()();
  DateTimeColumn get scheduledDate => dateTime()();
  TextColumn get status => text()();
  TextColumn get paymentMethod => text().nullable()();
  TextColumn get externalReference => text().nullable()();
  DateTimeColumn get completedAt => dateTime().nullable()();
  DateTimeColumn get syncedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class LedgerEntries extends Table {
  TextColumn get id => text()();
  TextColumn get groupId => text().references(Groups, #id)();
  TextColumn get membershipId => text().references(Memberships, #id).nullable()();
  TextColumn get entryType => text()();
  RealColumn get amount => real()();
  RealColumn get balanceAfter => real()();
  TextColumn get referenceType => text().nullable()();
  TextColumn get referenceId => text().nullable()();
  TextColumn get description => text().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get syncedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class Notifications extends Table {
  TextColumn get id => text()();
  TextColumn get userId => text().references(Users, #id)();
  TextColumn get groupId => text().references(Groups, #id).nullable()();
  TextColumn get type => text()();
  TextColumn get title => text()();
  TextColumn get body => text()();
  TextColumn get channel => text()();
  DateTimeColumn get readAt => dateTime().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get syncedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

// Offline Queue for pending operations
class OfflineQueue extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get operationType => text()(); // CREATE_CONTRIBUTION, APPROVE, REJECT, etc.
  TextColumn get entityType => text()(); // contribution, payout, etc.
  TextColumn get entityId => text().nullable()(); // For existing entities
  TextColumn get payload => text()(); // JSON payload
  TextColumn get idempotencyKey => text()();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  TextColumn get status => text().withDefault(const Constant('PENDING'))();
  TextColumn get errorMessage => text().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get lastAttemptAt => dateTime().nullable()();
}
