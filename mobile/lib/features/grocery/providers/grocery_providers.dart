import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/database/app_database.dart';
import '../data/models/grocery_models.dart';
import '../data/local/grocery_local_datasource.dart';
import '../data/remote/grocery_remote_datasource.dart';
import '../data/repositories/grocery_repository.dart';

// =====================
// Data Source Providers
// =====================

final groceryRemoteDataSourceProvider = Provider<GroceryRemoteDataSource>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return GroceryRemoteDataSource(apiClient);
});

final groceryLocalDataSourceProvider = Provider<GroceryLocalDataSource>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return GroceryLocalDataSource(db);
});

// =====================
// Repository Provider
// =====================

final groceryRepositoryProvider = Provider<GroceryRepository>((ref) {
  return GroceryRepository(
    remoteDataSource: ref.watch(groceryRemoteDataSourceProvider),
    localDataSource: ref.watch(groceryLocalDataSourceProvider),
  );
});

// =====================
// State Notifiers
// =====================

/// My Grocery Groups state
class GroceryGroupsState {
  final List<GroceryGroup> groups;
  final bool isLoading;
  final String? error;

  const GroceryGroupsState({
    this.groups = const [],
    this.isLoading = false,
    this.error,
  });

  GroceryGroupsState copyWith({
    List<GroceryGroup>? groups,
    bool? isLoading,
    String? error,
  }) {
    return GroceryGroupsState(
      groups: groups ?? this.groups,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }

  int get totalPending =>
      groups.fold(0, (sum, g) => sum + g.pendingAllocations);
}

class GroceryGroupsNotifier extends StateNotifier<GroceryGroupsState> {
  final GroceryRepository _repository;

  GroceryGroupsNotifier(this._repository) : super(const GroceryGroupsState()) {
    load();
  }

  Future<void> load() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final groups = await _repository.getMyGroceryGroups();
      state = state.copyWith(groups: groups, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> refresh() => load();
}

final groceryGroupsProvider =
    StateNotifierProvider<GroceryGroupsNotifier, GroceryGroupsState>((ref) {
  return GroceryGroupsNotifier(ref.watch(groceryRepositoryProvider));
});

// =====================
// My Allocations State
// =====================

class AllocationsState {
  final List<MyAllocation> allocations;
  final bool isLoading;
  final String? error;

  const AllocationsState({
    this.allocations = const [],
    this.isLoading = false,
    this.error,
  });

  AllocationsState copyWith({
    List<MyAllocation>? allocations,
    bool? isLoading,
    String? error,
  }) {
    return AllocationsState(
      allocations: allocations ?? this.allocations,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }

  List<MyAllocation> get pending =>
      allocations.where((a) => a.pendingCount > 0).toList();
}

class AllocationsNotifier extends StateNotifier<AllocationsState> {
  final GroceryRepository _repository;
  final String? groupId;

  AllocationsNotifier(this._repository, {this.groupId})
      : super(const AllocationsState()) {
    load();
  }

  Future<void> load() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final allocations = await _repository.getMyAllocations(groupId: groupId);
      state = state.copyWith(allocations: allocations, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> refresh() => load();
}

final allocationsProvider =
    StateNotifierProvider.family<AllocationsNotifier, AllocationsState, String?>(
  (ref, groupId) {
    return AllocationsNotifier(
      ref.watch(groceryRepositoryProvider),
      groupId: groupId,
    );
  },
);

// Convenience provider for all allocations
final myAllocationsProvider =
    StateNotifierProvider<AllocationsNotifier, AllocationsState>((ref) {
  return AllocationsNotifier(ref.watch(groceryRepositoryProvider));
});

// =====================
// Confirm Item
// =====================

class ConfirmItemState {
  final bool isLoading;
  final ConfirmationResult? result;
  final String? error;

  const ConfirmItemState({
    this.isLoading = false,
    this.result,
    this.error,
  });
}

class ConfirmItemNotifier extends StateNotifier<ConfirmItemState> {
  final GroceryRepository _repository;
  final Ref _ref;

  ConfirmItemNotifier(this._repository, this._ref)
      : super(const ConfirmItemState());

  Future<bool> confirm(String itemId) async {
    state = const ConfirmItemState(isLoading: true);
    try {
      final result = await _repository.confirmItem(itemId);
      state = ConfirmItemState(result: result);

      // Refresh allocations
      _ref.invalidate(myAllocationsProvider);

      return true;
    } catch (e) {
      state = ConfirmItemState(error: e.toString());
      return false;
    }
  }

  void reset() {
    state = const ConfirmItemState();
  }
}

final confirmItemProvider =
    StateNotifierProvider<ConfirmItemNotifier, ConfirmItemState>((ref) {
  return ConfirmItemNotifier(
    ref.watch(groceryRepositoryProvider),
    ref,
  );
});

// =====================
// Pending Sync Count
// =====================

final pendingSyncCountProvider = FutureProvider<int>((ref) async {
  final repository = ref.watch(groceryRepositoryProvider);
  return repository.getPendingConfirmationCount();
});

// =====================
// Sync Service
// =====================

class SyncState {
  final bool isSyncing;
  final int? syncedCount;
  final String? error;

  const SyncState({
    this.isSyncing = false,
    this.syncedCount,
    this.error,
  });
}

class SyncNotifier extends StateNotifier<SyncState> {
  final GroceryRepository _repository;
  final Ref _ref;

  SyncNotifier(this._repository, this._ref) : super(const SyncState());

  Future<void> syncPending() async {
    if (state.isSyncing) return;

    state = const SyncState(isSyncing: true);
    try {
      final count = await _repository.syncPendingConfirmations();
      state = SyncState(syncedCount: count);

      if (count > 0) {
        // Refresh data
        _ref.invalidate(myAllocationsProvider);
        _ref.invalidate(pendingSyncCountProvider);
      }
    } catch (e) {
      state = SyncState(error: e.toString());
    }
  }
}

final syncProvider = StateNotifierProvider<SyncNotifier, SyncState>((ref) {
  return SyncNotifier(ref.watch(groceryRepositoryProvider), ref);
});
