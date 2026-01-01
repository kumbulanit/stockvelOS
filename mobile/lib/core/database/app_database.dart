import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'tables.dart';

part 'app_database.g.dart';

@DriftDatabase(
  tables: [
    Users,
    Groups,
    Memberships,
    SavingsRules,
    Contributions,
    Payouts,
    LedgerEntries,
    Notifications,
    OfflineQueue,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration {
    return MigrationStrategy(
      onCreate: (Migrator m) async {
        await m.createAll();
      },
      onUpgrade: (Migrator m, int from, int to) async {
        // Handle migrations
      },
    );
  }

  // =====================
  // User Operations
  // =====================

  Future<User?> getCurrentUser() async {
    return (select(users)..limit(1)).getSingleOrNull();
  }

  Future<void> saveUser(User user) async {
    await into(users).insertOnConflictUpdate(user);
  }

  Future<void> clearUser() async {
    await delete(users).go();
  }

  // =====================
  // Groups Operations
  // =====================

  Future<List<Group>> getGroups() async {
    return select(groups).get();
  }

  Future<Group?> getGroup(String id) async {
    return (select(groups)..where((g) => g.id.equals(id))).getSingleOrNull();
  }

  Future<void> saveGroups(List<Group> groupList) async {
    await batch((b) {
      b.insertAllOnConflictUpdate(groups, groupList);
    });
  }

  Future<void> saveGroup(Group group) async {
    await into(groups).insertOnConflictUpdate(group);
  }

  // =====================
  // Memberships Operations
  // =====================

  Future<List<Membership>> getMembershipsForGroup(String groupId) async {
    return (select(memberships)..where((m) => m.groupId.equals(groupId))).get();
  }

  Future<Membership?> getUserMembership(String groupId, String userId) async {
    return (select(memberships)
      ..where((m) => m.groupId.equals(groupId) & m.userId.equals(userId)))
        .getSingleOrNull();
  }

  Future<void> saveMemberships(List<Membership> membershipList) async {
    await batch((b) {
      b.insertAllOnConflictUpdate(memberships, membershipList);
    });
  }

  // =====================
  // Savings Rules Operations
  // =====================

  Future<SavingsRule?> getSavingsRule(String groupId) async {
    return (select(savingsRules)..where((s) => s.groupId.equals(groupId)))
        .getSingleOrNull();
  }

  Future<void> saveSavingsRule(SavingsRule rule) async {
    await into(savingsRules).insertOnConflictUpdate(rule);
  }

  // =====================
  // Contributions Operations
  // =====================

  Future<List<Contribution>> getContributionsForGroup(String groupId) async {
    return (select(contributions)
      ..where((c) => c.groupId.equals(groupId))
      ..orderBy([(c) => OrderingTerm.desc(c.createdAt)]))
        .get();
  }

  Future<List<Contribution>> getMyContributions(String membershipId) async {
    return (select(contributions)
      ..where((c) => c.membershipId.equals(membershipId))
      ..orderBy([(c) => OrderingTerm.desc(c.createdAt)]))
        .get();
  }

  Future<List<Contribution>> getPendingContributions(String groupId) async {
    return (select(contributions)
      ..where((c) => c.groupId.equals(groupId) & c.status.equals('PENDING'))
      ..orderBy([(c) => OrderingTerm.asc(c.createdAt)]))
        .get();
  }

  Future<void> saveContributions(List<Contribution> contributionList) async {
    await batch((b) {
      b.insertAllOnConflictUpdate(contributions, contributionList);
    });
  }

  Future<void> saveContribution(Contribution contribution) async {
    await into(contributions).insertOnConflictUpdate(contribution);
  }

  // =====================
  // Payouts Operations
  // =====================

  Future<List<Payout>> getPayoutsForGroup(String groupId) async {
    return (select(payouts)
      ..where((p) => p.groupId.equals(groupId))
      ..orderBy([(p) => OrderingTerm.asc(p.scheduledDate)]))
        .get();
  }

  Future<void> savePayouts(List<Payout> payoutList) async {
    await batch((b) {
      b.insertAllOnConflictUpdate(payouts, payoutList);
    });
  }

  // =====================
  // Ledger Operations
  // =====================

  Future<List<LedgerEntry>> getLedgerForGroup(String groupId) async {
    return (select(ledgerEntries)
      ..where((l) => l.groupId.equals(groupId))
      ..orderBy([(l) => OrderingTerm.desc(l.createdAt)]))
        .get();
  }

  Future<void> saveLedgerEntries(List<LedgerEntry> entries) async {
    await batch((b) {
      b.insertAllOnConflictUpdate(ledgerEntries, entries);
    });
  }

  // =====================
  // Notifications Operations
  // =====================

  Future<List<Notification>> getNotifications(String userId) async {
    return (select(notifications)
      ..where((n) => n.userId.equals(userId))
      ..orderBy([(n) => OrderingTerm.desc(n.createdAt)]))
        .get();
  }

  Future<int> getUnreadNotificationCount(String userId) async {
    final query = selectOnly(notifications)
      ..addColumns([notifications.id.count()])
      ..where(notifications.userId.equals(userId) & notifications.readAt.isNull());
    final result = await query.getSingle();
    return result.read(notifications.id.count()) ?? 0;
  }

  Future<void> saveNotifications(List<Notification> notificationList) async {
    await batch((b) {
      b.insertAllOnConflictUpdate(notifications, notificationList);
    });
  }

  Future<void> markNotificationRead(String id) async {
    await (update(notifications)..where((n) => n.id.equals(id)))
        .write(NotificationsCompanion(readAt: Value(DateTime.now())));
  }

  // =====================
  // Offline Queue Operations
  // =====================

  Future<List<OfflineQueueData>> getPendingOperations() async {
    return (select(offlineQueue)
      ..where((o) => o.status.equals('PENDING'))
      ..orderBy([(o) => OrderingTerm.asc(o.createdAt)]))
        .get();
  }

  Future<int> addToOfflineQueue(OfflineQueueCompanion entry) async {
    return into(offlineQueue).insert(entry);
  }

  Future<void> updateOfflineQueueItem(int id, {
    String? status,
    String? errorMessage,
    int? retryCount,
  }) async {
    await (update(offlineQueue)..where((o) => o.id.equals(id))).write(
      OfflineQueueCompanion(
        status: status != null ? Value(status) : const Value.absent(),
        errorMessage: errorMessage != null ? Value(errorMessage) : const Value.absent(),
        retryCount: retryCount != null ? Value(retryCount) : const Value.absent(),
        lastAttemptAt: Value(DateTime.now()),
      ),
    );
  }

  Future<void> removeFromOfflineQueue(int id) async {
    await (delete(offlineQueue)..where((o) => o.id.equals(id))).go();
  }

  Future<int> getPendingQueueCount() async {
    final query = selectOnly(offlineQueue)
      ..addColumns([offlineQueue.id.count()])
      ..where(offlineQueue.status.equals('PENDING'));
    final result = await query.getSingle();
    return result.read(offlineQueue.id.count()) ?? 0;
  }

  // =====================
  // Clear all data
  // =====================

  Future<void> clearAllData() async {
    await transaction(() async {
      await delete(offlineQueue).go();
      await delete(notifications).go();
      await delete(ledgerEntries).go();
      await delete(payouts).go();
      await delete(contributions).go();
      await delete(savingsRules).go();
      await delete(memberships).go();
      await delete(groups).go();
      await delete(users).go();
    });
  }
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'stockvel.sqlite'));
    return NativeDatabase.createInBackground(file);
  });
}

// Provider
final databaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase();
  ref.onDispose(() => db.close());
  return db;
});
