import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/repositories/grocery_repository.dart';
import '../providers/grocery_providers.dart';

/// Service that automatically syncs pending confirmations
/// when connectivity is restored
class GrocerySyncService {
  final GroceryRepository _repository;
  final Ref _ref;
  StreamSubscription? _subscription;

  GrocerySyncService(this._repository, this._ref);

  /// Start listening for connectivity changes
  void startListening() {
    _subscription = Connectivity().onConnectivityChanged.listen((result) {
      if (result != ConnectivityResult.none) {
        _syncIfNeeded();
      }
    });
  }

  /// Stop listening for connectivity changes
  void stopListening() {
    _subscription?.cancel();
    _subscription = null;
  }

  /// Check and sync pending confirmations
  Future<void> _syncIfNeeded() async {
    try {
      final pendingCount = await _repository.getPendingConfirmationCount();
      if (pendingCount > 0) {
        final synced = await _repository.syncPendingConfirmations();
        if (synced > 0) {
          // Refresh data after successful sync
          _ref.invalidate(myAllocationsProvider);
          _ref.invalidate(pendingSyncCountProvider);
          _ref.invalidate(groceryGroupsProvider);
        }
      }
    } catch (e) {
      // Silently fail - will retry on next connectivity change
    }
  }

  /// Manual sync trigger
  Future<int> syncNow() async {
    return _repository.syncPendingConfirmations();
  }
}

/// Provider for sync service
final grocerySyncServiceProvider = Provider<GrocerySyncService>((ref) {
  final repository = ref.watch(groceryRepositoryProvider);
  final service = GrocerySyncService(repository, ref);
  
  // Start listening when created
  service.startListening();
  
  // Stop listening when disposed
  ref.onDispose(() {
    service.stopListening();
  });
  
  return service;
});
