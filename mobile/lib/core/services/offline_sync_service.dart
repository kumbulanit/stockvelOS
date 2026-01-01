import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import 'package:drift/drift.dart';

import '../database/app_database.dart';
import '../network/api_client.dart';
import 'connectivity_service.dart';

class OfflineSyncService {
  final AppDatabase _db;
  final ApiClient _api;
  final ConnectivityService _connectivity;
  final Uuid _uuid = const Uuid();

  bool _isSyncing = false;

  OfflineSyncService(this._db, this._api, this._connectivity) {
    // Listen to connectivity changes and sync when online
    _connectivity.onConnectivityChanged.listen((isConnected) {
      if (isConnected && !_isSyncing) {
        syncPendingOperations();
      }
    });
  }

  /// Generate idempotency key for operations
  String generateIdempotencyKey() {
    return _uuid.v4();
  }

  /// Queue an offline operation
  Future<void> queueOperation({
    required String operationType,
    required String entityType,
    String? entityId,
    required Map<String, dynamic> payload,
    required String idempotencyKey,
  }) async {
    await _db.addToOfflineQueue(
      OfflineQueueCompanion.insert(
        operationType: operationType,
        entityType: entityType,
        entityId: Value(entityId),
        payload: jsonEncode(payload),
        idempotencyKey: idempotencyKey,
        createdAt: DateTime.now(),
      ),
    );
  }

  /// Get pending operations count
  Future<int> getPendingCount() async {
    return _db.getPendingQueueCount();
  }

  /// Sync all pending operations
  Future<SyncResult> syncPendingOperations() async {
    if (_isSyncing) {
      return SyncResult(synced: 0, failed: 0, message: 'Sync already in progress');
    }

    final isOnline = await _connectivity.isConnected();
    if (!isOnline) {
      return SyncResult(synced: 0, failed: 0, message: 'No internet connection');
    }

    _isSyncing = true;
    int synced = 0;
    int failed = 0;

    try {
      final pendingOps = await _db.getPendingOperations();

      for (final op in pendingOps) {
        try {
          await _processOperation(op);
          await _db.removeFromOfflineQueue(op.id);
          synced++;
        } catch (e) {
          failed++;
          final newRetryCount = op.retryCount + 1;
          
          if (newRetryCount >= 5) {
            // Mark as failed after 5 retries
            await _db.updateOfflineQueueItem(
              op.id,
              status: 'FAILED',
              errorMessage: e.toString(),
              retryCount: newRetryCount,
            );
          } else {
            // Update retry count
            await _db.updateOfflineQueueItem(
              op.id,
              errorMessage: e.toString(),
              retryCount: newRetryCount,
            );
          }
        }
      }

      return SyncResult(
        synced: synced,
        failed: failed,
        message: synced > 0 ? 'Synced $synced operations' : 'Nothing to sync',
      );
    } finally {
      _isSyncing = false;
    }
  }

  Future<void> _processOperation(OfflineQueueData op) async {
    final payload = jsonDecode(op.payload) as Map<String, dynamic>;

    switch (op.operationType) {
      case 'CREATE_CONTRIBUTION':
        await _api.submitContribution(
          groupId: payload['groupId'],
          amount: payload['amount'].toDouble(),
          contributionPeriod: payload['contributionPeriod'],
          paymentMethod: payload['paymentMethod'],
          idempotencyKey: op.idempotencyKey,
          externalReference: payload['externalReference'],
          popDocumentId: payload['popDocumentId'],
        );
        break;

      case 'APPROVE_CONTRIBUTION':
        await _api.approveContribution(
          op.entityId!,
          notes: payload['notes'],
        );
        break;

      case 'REJECT_CONTRIBUTION':
        await _api.rejectContribution(
          op.entityId!,
          payload['reason'],
        );
        break;

      case 'APPROVE_PAYOUT':
        await _api.approvePayout(op.entityId!);
        break;

      case 'COMPLETE_PAYOUT':
        await _api.completePayout(
          op.entityId!,
          paymentMethod: payload['paymentMethod'],
          externalReference: payload['externalReference'],
        );
        break;

      case 'MARK_NOTIFICATION_READ':
        await _api.markNotificationRead(op.entityId!);
        break;

      default:
        throw Exception('Unknown operation type: ${op.operationType}');
    }
  }
}

class SyncResult {
  final int synced;
  final int failed;
  final String message;

  SyncResult({
    required this.synced,
    required this.failed,
    required this.message,
  });
}

// Provider
final offlineSyncServiceProvider = Provider<OfflineSyncService>((ref) {
  final db = ref.watch(databaseProvider);
  final api = ref.watch(apiClientProvider);
  final connectivity = ref.watch(connectivityServiceProvider);
  return OfflineSyncService(db, api, connectivity);
});

// Pending sync count provider
final pendingSyncCountProvider = FutureProvider<int>((ref) async {
  final syncService = ref.watch(offlineSyncServiceProvider);
  return syncService.getPendingCount();
});
