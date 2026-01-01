import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:uuid/uuid.dart';

import '../models/grocery_models.dart';
import '../local/grocery_local_datasource.dart';
import '../remote/grocery_remote_datasource.dart';

/// Repository for grocery data with offline-first support
class GroceryRepository {
  final GroceryRemoteDataSource _remoteDataSource;
  final GroceryLocalDataSource _localDataSource;
  final Connectivity _connectivity;
  final _uuid = const Uuid();

  GroceryRepository({
    required GroceryRemoteDataSource remoteDataSource,
    required GroceryLocalDataSource localDataSource,
    Connectivity? connectivity,
  })  : _remoteDataSource = remoteDataSource,
        _localDataSource = localDataSource,
        _connectivity = connectivity ?? Connectivity();

  // =====================
  // Connectivity Check
  // =====================

  Future<bool> get isOnline async {
    final result = await _connectivity.checkConnectivity();
    return result != ConnectivityResult.none;
  }

  // =====================
  // My Grocery Groups
  // =====================

  /// Get my grocery groups with offline fallback
  Future<List<GroceryGroup>> getMyGroceryGroups() async {
    try {
      if (await isOnline) {
        final groups = await _remoteDataSource.getMyGroceryGroups();
        // Cache for offline
        await _localDataSource.cacheGroceryGroups(groups);
        return groups;
      }
    } catch (e) {
      // Fall through to cached data
    }

    // Return cached data
    return _localDataSource.getCachedGroceryGroups();
  }

  // =====================
  // My Allocations
  // =====================

  /// Get my allocations with offline fallback
  Future<List<MyAllocation>> getMyAllocations({String? groupId}) async {
    try {
      if (await isOnline) {
        final allocations = await _remoteDataSource.getMyAllocations(
          groupId: groupId,
        );
        // Cache for offline
        await _localDataSource.cacheAllocations(allocations);
        return allocations;
      }
    } catch (e) {
      // Fall through to cached data
    }

    // Return cached data
    return _localDataSource.getCachedAllocations();
  }

  /// Get allocation history
  Future<List<MyAllocation>> getMyHistory({
    int page = 1,
    int limit = 20,
  }) async {
    // History is online-only (not critical for offline)
    return _remoteDataSource.getMyHistory(page: page, limit: limit);
  }

  // =====================
  // Confirm Item Receipt
  // =====================

  /// Confirm item receipt with offline support
  /// Returns the result if online, or queues for later sync if offline
  Future<ConfirmationResult> confirmItem(String itemId) async {
    // Generate idempotency key
    final idempotencyKey = _uuid.v4();

    try {
      if (await isOnline) {
        // Try to confirm online
        final result = await _remoteDataSource.confirmItem(
          itemId: itemId,
          idempotencyKey: idempotencyKey,
        );
        return result;
      }
    } catch (e) {
      // If online but failed, queue for retry
      if (await isOnline) {
        await _localDataSource.queueConfirmation(
          itemId: itemId,
          status: 'COLLECTED',
          idempotencyKey: idempotencyKey,
        );
        
        // Return optimistic result
        return ConfirmationResult(
          itemId: itemId,
          status: DistributionItemStatus.collected,
          confirmedAt: DateTime.now(),
          fromCache: true,
        );
      }
    }

    // Offline: queue confirmation
    await _localDataSource.queueConfirmation(
      itemId: itemId,
      status: 'COLLECTED',
      idempotencyKey: idempotencyKey,
    );

    // Update local cache optimistically
    // Note: We'd need the distributionId here for full implementation
    
    // Return optimistic result
    return ConfirmationResult(
      itemId: itemId,
      status: DistributionItemStatus.collected,
      confirmedAt: DateTime.now(),
      fromCache: true,
    );
  }

  // =====================
  // Sync Pending Confirmations
  // =====================

  /// Sync all pending confirmations
  /// Returns number of successfully synced items
  Future<int> syncPendingConfirmations() async {
    if (!await isOnline) return 0;

    final pending = await _localDataSource.getUnsynced();
    int synced = 0;

    for (final confirmation in pending) {
      try {
        await _remoteDataSource.confirmItem(
          itemId: confirmation.itemId,
          idempotencyKey: confirmation.idempotencyKey,
        );
        await _localDataSource.markSynced(confirmation.id);
        synced++;
      } catch (e) {
        await _localDataSource.updateRetryInfo(
          confirmation.id,
          errorMessage: e.toString(),
        );
      }
    }

    // Cleanup old synced confirmations
    await _localDataSource.cleanupSynced();

    return synced;
  }

  /// Get count of pending confirmations
  Future<int> getPendingConfirmationCount() async {
    return _localDataSource.getPendingCount();
  }

  // =====================
  // Group Data (Read-only)
  // =====================

  /// Get group summary
  Future<GrocerySummary> getGroupSummary(String groupId) async {
    return _remoteDataSource.getGroupSummary(groupId);
  }

  /// Get group products
  Future<List<GroceryProduct>> getGroupProducts(String groupId) async {
    return _remoteDataSource.getGroupProducts(groupId);
  }

  /// Get group stock
  Future<List<StockItem>> getGroupStock(String groupId) async {
    return _remoteDataSource.getGroupStock(groupId);
  }

  /// Get distribution details
  Future<GroceryDistribution> getDistribution(
    String groupId,
    String distributionId,
  ) async {
    return _remoteDataSource.getDistribution(groupId, distributionId);
  }

  /// Get distributions list
  Future<List<GroceryDistribution>> getDistributions(
    String groupId, {
    String? status,
    int page = 1,
    int limit = 20,
  }) async {
    return _remoteDataSource.getDistributions(
      groupId,
      status: status,
      page: page,
      limit: limit,
    );
  }

  /// Clear local cache (e.g., on logout)
  Future<void> clearCache() async {
    await _localDataSource.clearCache();
  }
}
