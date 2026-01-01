import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/app_database.dart';
import '../models/contribution_model.dart';
import '../network/api_client.dart';
import '../services/connectivity_service.dart';
import '../services/offline_sync_service.dart';

class ContributionRepository {
  final AppDatabase _db;
  final ApiClient _api;
  final ConnectivityService _connectivity;
  final OfflineSyncService _syncService;

  ContributionRepository(
    this._db,
    this._api,
    this._connectivity,
    this._syncService,
  );

  /// Get my contributions for a group (offline-first)
  Future<ContributionsResponse> getMyContributions(
    String groupId, {
    bool forceRefresh = false,
  }) async {
    final isOnline = await _connectivity.isConnected();

    if (isOnline && forceRefresh) {
      return _fetchAndCacheMyContributions(groupId);
    }

    // Get membership ID first (simplified - in real app, get from user context)
    final localContributions = await _db.getContributionsForGroup(groupId);
    
    if (localContributions.isNotEmpty && !forceRefresh) {
      return _mapContributionsResponse(localContributions);
    }

    if (isOnline) {
      return _fetchAndCacheMyContributions(groupId);
    }

    return _mapContributionsResponse(localContributions);
  }

  Future<ContributionsResponse> _fetchAndCacheMyContributions(String groupId) async {
    try {
      final response = await _api.getMyContributions(groupId);
      final contributions = ContributionsResponse.fromJson(response.data);

      // Cache to local DB
      await _db.saveContributions(contributions.contributions.map((c) => Contribution(
        id: c.id,
        membershipId: c.membershipId,
        groupId: c.groupId,
        amount: c.amount,
        contributionPeriod: c.contributionPeriod,
        status: c.status.name,
        paymentMethod: c.paymentMethod,
        externalReference: c.externalReference,
        popDocumentId: c.popDocumentId,
        approverNotes: c.approverNotes,
        idempotencyKey: c.idempotencyKey,
        createdAt: c.createdAt,
        approvedAt: c.approvedAt,
        syncedAt: DateTime.now(),
      )).toList());

      return contributions;
    } catch (e) {
      // Return cached on error
      final local = await _db.getContributionsForGroup(groupId);
      return _mapContributionsResponse(local);
    }
  }

  /// Get pending contributions for treasurer review
  Future<List<ContributionModel>> getPendingContributions(
    String groupId, {
    bool forceRefresh = false,
  }) async {
    final isOnline = await _connectivity.isConnected();

    if (isOnline && forceRefresh) {
      try {
        final response = await _api.getGroupContributions(groupId, status: 'PENDING');
        final contributions = (response.data['contributions'] as List)
            .map((json) => ContributionModel.fromJson(json))
            .toList();

        // Cache
        await _db.saveContributions(contributions.map((c) => Contribution(
          id: c.id,
          membershipId: c.membershipId,
          groupId: c.groupId,
          amount: c.amount,
          contributionPeriod: c.contributionPeriod,
          status: c.status.name,
          paymentMethod: c.paymentMethod,
          externalReference: c.externalReference,
          popDocumentId: c.popDocumentId,
          approverNotes: c.approverNotes,
          idempotencyKey: c.idempotencyKey,
          createdAt: c.createdAt,
          approvedAt: c.approvedAt,
          syncedAt: DateTime.now(),
        )).toList());

        return contributions;
      } catch (e) {
        // Fall through to local
      }
    }

    final local = await _db.getPendingContributions(groupId);
    return local.map(_mapContributionToModel).toList();
  }

  /// Submit a contribution (with offline support)
  Future<ContributionModel> submitContribution({
    required String groupId,
    required String membershipId,
    required double amount,
    required String contributionPeriod,
    required String paymentMethod,
    String? externalReference,
    String? popDocumentId,
  }) async {
    final idempotencyKey = _syncService.generateIdempotencyKey();
    final isOnline = await _connectivity.isConnected();

    if (isOnline) {
      // Submit directly to server
      final response = await _api.submitContribution(
        groupId: groupId,
        amount: amount,
        contributionPeriod: contributionPeriod,
        paymentMethod: paymentMethod,
        idempotencyKey: idempotencyKey,
        externalReference: externalReference,
        popDocumentId: popDocumentId,
      );

      final contribution = ContributionModel.fromJson(response.data);

      // Cache locally
      await _db.saveContribution(Contribution(
        id: contribution.id,
        membershipId: contribution.membershipId,
        groupId: contribution.groupId,
        amount: contribution.amount,
        contributionPeriod: contribution.contributionPeriod,
        status: contribution.status.name,
        paymentMethod: contribution.paymentMethod,
        externalReference: contribution.externalReference,
        popDocumentId: contribution.popDocumentId,
        approverNotes: contribution.approverNotes,
        idempotencyKey: contribution.idempotencyKey,
        createdAt: contribution.createdAt,
        approvedAt: contribution.approvedAt,
        syncedAt: DateTime.now(),
      ));

      return contribution;
    }

    // Offline: Queue for later sync
    final tempId = 'temp_$idempotencyKey';
    final now = DateTime.now();

    // Create local contribution
    final localContribution = Contribution(
      id: tempId,
      membershipId: membershipId,
      groupId: groupId,
      amount: amount,
      contributionPeriod: contributionPeriod,
      status: 'PENDING',
      paymentMethod: paymentMethod,
      externalReference: externalReference,
      popDocumentId: popDocumentId,
      approverNotes: null,
      idempotencyKey: idempotencyKey,
      createdAt: now,
      approvedAt: null,
      syncedAt: null, // Not synced yet
    );

    await _db.saveContribution(localContribution);

    // Queue for sync
    await _syncService.queueOperation(
      operationType: 'CREATE_CONTRIBUTION',
      entityType: 'contribution',
      payload: {
        'groupId': groupId,
        'membershipId': membershipId,
        'amount': amount,
        'contributionPeriod': contributionPeriod,
        'paymentMethod': paymentMethod,
        'externalReference': externalReference,
        'popDocumentId': popDocumentId,
      },
      idempotencyKey: idempotencyKey,
    );

    return ContributionModel(
      id: tempId,
      membershipId: membershipId,
      groupId: groupId,
      amount: amount,
      contributionPeriod: contributionPeriod,
      status: ContributionStatus.PENDING,
      paymentMethod: paymentMethod,
      externalReference: externalReference,
      popDocumentId: popDocumentId,
      idempotencyKey: idempotencyKey,
      createdAt: now,
    );
  }

  /// Approve a contribution (with offline support)
  Future<void> approveContribution(String id, {String? notes}) async {
    final isOnline = await _connectivity.isConnected();

    if (isOnline) {
      await _api.approveContribution(id, notes: notes);
      // Update local
      // In a real app, fetch the updated contribution
    } else {
      // Queue for sync
      await _syncService.queueOperation(
        operationType: 'APPROVE_CONTRIBUTION',
        entityType: 'contribution',
        entityId: id,
        payload: {'notes': notes},
        idempotencyKey: _syncService.generateIdempotencyKey(),
      );
    }
  }

  /// Reject a contribution (with offline support)
  Future<void> rejectContribution(String id, String reason) async {
    final isOnline = await _connectivity.isConnected();

    if (isOnline) {
      await _api.rejectContribution(id, reason);
    } else {
      // Queue for sync
      await _syncService.queueOperation(
        operationType: 'REJECT_CONTRIBUTION',
        entityType: 'contribution',
        entityId: id,
        payload: {'reason': reason},
        idempotencyKey: _syncService.generateIdempotencyKey(),
      );
    }
  }

  // Helpers
  ContributionsResponse _mapContributionsResponse(List<Contribution> contributions) {
    final list = contributions.map(_mapContributionToModel).toList();
    
    final approved = list.where((c) => c.status == ContributionStatus.APPROVED).toList();
    final pending = list.where((c) => c.status == ContributionStatus.PENDING).toList();
    final rejected = list.where((c) => c.status == ContributionStatus.REJECTED).toList();

    return ContributionsResponse(
      contributions: list,
      summary: ContributionSummary(
        totalContributions: list.length,
        approvedCount: approved.length,
        pendingCount: pending.length,
        rejectedCount: rejected.length,
        totalAmount: approved.fold(0.0, (sum, c) => sum + c.amount),
        pendingAmount: pending.fold(0.0, (sum, c) => sum + c.amount),
      ),
    );
  }

  ContributionModel _mapContributionToModel(Contribution c) {
    return ContributionModel(
      id: c.id,
      membershipId: c.membershipId,
      groupId: c.groupId,
      amount: c.amount,
      contributionPeriod: c.contributionPeriod,
      status: ContributionStatus.values.firstWhere(
        (e) => e.name == c.status,
        orElse: () => ContributionStatus.PENDING,
      ),
      paymentMethod: c.paymentMethod,
      externalReference: c.externalReference,
      popDocumentId: c.popDocumentId,
      approverNotes: c.approverNotes,
      idempotencyKey: c.idempotencyKey,
      createdAt: c.createdAt,
      approvedAt: c.approvedAt,
    );
  }
}

// Provider
final contributionRepositoryProvider = Provider<ContributionRepository>((ref) {
  return ContributionRepository(
    ref.watch(databaseProvider),
    ref.watch(apiClientProvider),
    ref.watch(connectivityServiceProvider),
    ref.watch(offlineSyncServiceProvider),
  );
});
