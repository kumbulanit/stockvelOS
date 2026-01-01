import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../../../../core/database/app_database.dart';
import '../models/grocery_models.dart';
import 'grocery_tables.dart';

part 'grocery_local_datasource.g.dart';

/// Local database access for grocery offline support
@DriftAccessor(tables: [PendingConfirmations, CachedAllocations, CachedGroceryGroups])
class GroceryLocalDataSource extends DatabaseAccessor<AppDatabase>
    with _$GroceryLocalDataSourceMixin {
  GroceryLocalDataSource(AppDatabase db) : super(db);

  final _uuid = const Uuid();

  // =====================
  // Pending Confirmations
  // =====================

  /// Queue a confirmation for later sync
  Future<String> queueConfirmation({
    required String itemId,
    required String status,
    required String idempotencyKey,
  }) async {
    final id = _uuid.v4();
    await into(pendingConfirmations).insert(
      PendingConfirmationsCompanion.insert(
        id: id,
        itemId: itemId,
        idempotencyKey: idempotencyKey,
        status: status,
      ),
    );
    return id;
  }

  /// Get all unsynced confirmations
  Future<List<PendingConfirmation>> getUnsynced() async {
    return (select(pendingConfirmations)
          ..where((t) => t.synced.equals(false))
          ..orderBy([(t) => OrderingTerm.asc(t.createdAt)]))
        .get();
  }

  /// Mark a confirmation as synced
  Future<void> markSynced(String id) async {
    await (update(pendingConfirmations)..where((t) => t.id.equals(id)))
        .write(const PendingConfirmationsCompanion(synced: Value(true)));
  }

  /// Update retry info for a confirmation
  Future<void> updateRetryInfo(String id, {String? errorMessage}) async {
    final existing = await (select(pendingConfirmations)
          ..where((t) => t.id.equals(id)))
        .getSingleOrNull();

    if (existing != null) {
      await (update(pendingConfirmations)..where((t) => t.id.equals(id))).write(
        PendingConfirmationsCompanion(
          retryCount: Value(existing.retryCount + 1),
          lastRetryAt: Value(DateTime.now()),
          errorMessage: Value(errorMessage),
        ),
      );
    }
  }

  /// Delete synced confirmations older than 24 hours
  Future<void> cleanupSynced() async {
    final cutoff = DateTime.now().subtract(const Duration(hours: 24));
    await (delete(pendingConfirmations)
          ..where((t) => t.synced.equals(true) & t.createdAt.isSmallerThan(Variable(cutoff))))
        .go();
  }

  /// Get pending confirmation count
  Future<int> getPendingCount() async {
    final count = await (selectOnly(pendingConfirmations)
          ..where(pendingConfirmations.synced.equals(false))
          ..addColumns([pendingConfirmations.id.count()]))
        .getSingle();
    return count.read(pendingConfirmations.id.count()) ?? 0;
  }

  // =====================
  // Cached Allocations
  // =====================

  /// Cache allocations for offline viewing
  Future<void> cacheAllocations(List<MyAllocation> allocations) async {
    await batch((batch) {
      batch.insertAll(
        cachedAllocations,
        allocations
            .map(
              (a) => CachedAllocationsCompanion.insert(
                id: a.distributionId,
                distributionId: a.distributionId,
                eventName: a.eventName,
                eventDate: a.eventDate,
                distributionStatus: a.distributionStatus.name.toUpperCase(),
                itemsJson: jsonEncode(a.items.map((i) => i.toJson()).toList()),
                pendingCount: a.pendingCount,
                totalCount: a.totalCount,
              ),
            )
            .toList(),
        mode: InsertMode.insertOrReplace,
      );
    });
  }

  /// Get cached allocations
  Future<List<MyAllocation>> getCachedAllocations() async {
    final rows = await select(cachedAllocations).get();
    return rows.map((row) {
      final itemsList = jsonDecode(row.itemsJson) as List;
      return MyAllocation(
        distributionId: row.distributionId,
        eventName: row.eventName,
        eventDate: row.eventDate,
        distributionStatus: DistributionStatus.values.firstWhere(
          (s) => s.name.toUpperCase() == row.distributionStatus,
          orElse: () => DistributionStatus.confirmed,
        ),
        items: itemsList
            .map((i) => AllocationItem.fromJson(i as Map<String, dynamic>))
            .toList(),
        pendingCount: row.pendingCount,
        totalCount: row.totalCount,
      );
    }).toList();
  }

  /// Update cached allocation item status (after local confirmation)
  Future<void> updateCachedItemStatus(
    String distributionId,
    String itemId,
    String status,
  ) async {
    final row = await (select(cachedAllocations)
          ..where((t) => t.distributionId.equals(distributionId)))
        .getSingleOrNull();

    if (row != null) {
      final itemsList = jsonDecode(row.itemsJson) as List;
      final updatedItems = itemsList.map((i) {
        if (i['itemId'] == itemId) {
          return {
            ...i,
            'status': status,
            'confirmedAt': DateTime.now().toIso8601String(),
          };
        }
        return i;
      }).toList();

      final newPendingCount = updatedItems
          .where((i) => i['status'] == 'ALLOCATED')
          .length;

      await (update(cachedAllocations)
            ..where((t) => t.distributionId.equals(distributionId)))
          .write(CachedAllocationsCompanion(
            itemsJson: Value(jsonEncode(updatedItems)),
            pendingCount: Value(newPendingCount),
          ));
    }
  }

  // =====================
  // Cached Groups
  // =====================

  /// Cache grocery groups
  Future<void> cacheGroceryGroups(List<GroceryGroup> groups) async {
    await batch((batch) {
      batch.insertAll(
        cachedGroceryGroups,
        groups
            .map(
              (g) => CachedGroceryGroupsCompanion.insert(
                groupId: g.groupId,
                groupName: g.groupName,
                pendingAllocations: g.pendingAllocations,
                totalDistributions: g.totalDistributions,
                nextDistributionDate: Value(g.nextDistributionDate),
              ),
            )
            .toList(),
        mode: InsertMode.insertOrReplace,
      );
    });
  }

  /// Get cached grocery groups
  Future<List<GroceryGroup>> getCachedGroceryGroups() async {
    final rows = await select(cachedGroceryGroups).get();
    return rows.map((row) {
      return GroceryGroup(
        groupId: row.groupId,
        groupName: row.groupName,
        pendingAllocations: row.pendingAllocations,
        totalDistributions: row.totalDistributions,
        nextDistributionDate: row.nextDistributionDate,
      );
    }).toList();
  }

  /// Clear all cached data (e.g., on logout)
  Future<void> clearCache() async {
    await delete(cachedAllocations).go();
    await delete(cachedGroceryGroups).go();
    // Keep pending confirmations for later sync
  }
}
