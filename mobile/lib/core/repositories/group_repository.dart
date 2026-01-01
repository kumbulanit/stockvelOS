import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/app_database.dart';
import '../models/group_model.dart';
import '../network/api_client.dart';
import '../services/connectivity_service.dart';

class GroupRepository {
  final AppDatabase _db;
  final ApiClient _api;
  final ConnectivityService _connectivity;

  GroupRepository(this._db, this._api, this._connectivity);

  /// Get all groups (offline-first)
  Future<List<GroupModel>> getGroups({bool forceRefresh = false}) async {
    final isOnline = await _connectivity.isConnected();

    if (isOnline && forceRefresh) {
      return _fetchAndCacheGroups();
    }

    // Try to get from local first
    final localGroups = await _db.getGroups();
    if (localGroups.isNotEmpty && !forceRefresh) {
      return localGroups.map(_mapGroupToModel).toList();
    }

    // If no local data and online, fetch
    if (isOnline) {
      return _fetchAndCacheGroups();
    }

    // Return cached data (may be empty)
    return localGroups.map(_mapGroupToModel).toList();
  }

  Future<List<GroupModel>> _fetchAndCacheGroups() async {
    final response = await _api.getGroups();
    final groups = (response.data as List)
        .map((json) => GroupModel.fromJson(json))
        .toList();

    // Cache to local DB
    await _db.saveGroups(groups.map((g) => Group(
      id: g.id,
      name: g.name,
      description: g.description,
      type: g.type.name,
      status: g.status.name,
      memberCount: g.memberCount,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt ?? g.createdAt,
      syncedAt: DateTime.now(),
    )).toList());

    // Also cache savings rules if present
    for (final group in groups) {
      if (group.savingsRule != null) {
        await _db.saveSavingsRule(SavingsRule(
          id: group.savingsRule!.id,
          groupId: group.id,
          contributionFrequency: group.savingsRule!.contributionFrequency,
          contributionAmount: group.savingsRule!.contributionAmount,
          contributionDayOfMonth: group.savingsRule!.contributionDayOfMonth,
          payoutOrder: group.savingsRule!.payoutOrder,
          gracePeriodDays: group.savingsRule!.gracePeriodDays,
          lateFeePct: group.savingsRule!.lateFeePct,
          autoApproveContributions: group.savingsRule!.autoApproveContributions,
          startDate: group.savingsRule!.startDate,
          endDate: group.savingsRule!.endDate,
          syncedAt: DateTime.now(),
        ));
      }
    }

    return groups;
  }

  /// Get single group by ID (offline-first)
  Future<GroupModel?> getGroup(String id, {bool forceRefresh = false}) async {
    final isOnline = await _connectivity.isConnected();

    if (isOnline && forceRefresh) {
      return _fetchAndCacheGroup(id);
    }

    // Try local first
    final localGroup = await _db.getGroup(id);
    if (localGroup != null && !forceRefresh) {
      final savingsRule = await _db.getSavingsRule(id);
      return _mapGroupToModel(localGroup, savingsRule: savingsRule);
    }

    // If online, fetch from server
    if (isOnline) {
      return _fetchAndCacheGroup(id);
    }

    // Return cached data
    if (localGroup != null) {
      final savingsRule = await _db.getSavingsRule(id);
      return _mapGroupToModel(localGroup, savingsRule: savingsRule);
    }

    return null;
  }

  Future<GroupModel?> _fetchAndCacheGroup(String id) async {
    try {
      final response = await _api.getSavingsGroup(id);
      final group = GroupModel.fromJson(response.data);

      // Cache to local DB
      await _db.saveGroup(Group(
        id: group.id,
        name: group.name,
        description: group.description,
        type: group.type.name,
        status: group.status.name,
        memberCount: group.memberCount,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt ?? group.createdAt,
        syncedAt: DateTime.now(),
      ));

      // Cache savings rule
      if (group.savingsRule != null) {
        await _db.saveSavingsRule(SavingsRule(
          id: group.savingsRule!.id,
          groupId: group.id,
          contributionFrequency: group.savingsRule!.contributionFrequency,
          contributionAmount: group.savingsRule!.contributionAmount,
          contributionDayOfMonth: group.savingsRule!.contributionDayOfMonth,
          payoutOrder: group.savingsRule!.payoutOrder,
          gracePeriodDays: group.savingsRule!.gracePeriodDays,
          lateFeePct: group.savingsRule!.lateFeePct,
          autoApproveContributions: group.savingsRule!.autoApproveContributions,
          startDate: group.savingsRule!.startDate,
          endDate: group.savingsRule!.endDate,
          syncedAt: DateTime.now(),
        ));
      }

      return group;
    } catch (e) {
      // Return cached on error
      final localGroup = await _db.getGroup(id);
      if (localGroup != null) {
        final savingsRule = await _db.getSavingsRule(id);
        return _mapGroupToModel(localGroup, savingsRule: savingsRule);
      }
      return null;
    }
  }

  /// Get members for a group
  Future<List<MembershipModel>> getMembers(String groupId, {bool forceRefresh = false}) async {
    final isOnline = await _connectivity.isConnected();

    if (!isOnline || !forceRefresh) {
      // Return cached memberships
      final local = await _db.getMembershipsForGroup(groupId);
      return local.map(_mapMembershipToModel).toList();
    }

    // Fetch from API (group detail includes members)
    final group = await getGroup(groupId, forceRefresh: true);
    if (group == null) {
      return [];
    }

    // Members would be cached during getGroup call
    final local = await _db.getMembershipsForGroup(groupId);
    return local.map(_mapMembershipToModel).toList();
  }

  /// Create a new group
  Future<GroupModel> createGroup({
    required String name,
    required GroupType type,
    String? description,
    double? contributionAmount,
    String? contributionFrequency,
    int? contributionDayOfMonth,
    String? payoutOrder,
  }) async {
    final response = await _api.createGroup({
      'name': name,
      'type': type.name,
      if (description != null) 'description': description,
      if (type == GroupType.SAVINGS) 'savingsRule': {
        'contributionAmount': contributionAmount,
        'contributionFrequency': contributionFrequency,
        if (contributionDayOfMonth != null) 'contributionDayOfMonth': contributionDayOfMonth,
        if (payoutOrder != null) 'payoutOrder': payoutOrder,
        'startDate': DateTime.now().toIso8601String(),
      },
    });

    final group = GroupModel.fromJson(response.data);

    // Cache to local DB
    await _db.saveGroup(Group(
      id: group.id,
      name: group.name,
      description: group.description,
      type: group.type.name,
      status: group.status.name,
      memberCount: group.memberCount,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt ?? group.createdAt,
      syncedAt: DateTime.now(),
    ));

    return group;
  }

  // Helpers
  GroupModel _mapGroupToModel(Group g, {SavingsRule? savingsRule}) {
    return GroupModel(
      id: g.id,
      name: g.name,
      description: g.description,
      type: GroupType.values.firstWhere(
        (e) => e.name == g.type,
        orElse: () => GroupType.SAVINGS,
      ),
      status: GroupStatus.values.firstWhere(
        (e) => e.name == g.status,
        orElse: () => GroupStatus.ACTIVE,
      ),
      memberCount: g.memberCount,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      savingsRule: savingsRule != null ? SavingsRuleModel(
        id: savingsRule.id,
        groupId: savingsRule.groupId,
        contributionFrequency: savingsRule.contributionFrequency,
        contributionAmount: savingsRule.contributionAmount,
        contributionDayOfMonth: savingsRule.contributionDayOfMonth,
        payoutOrder: savingsRule.payoutOrder,
        gracePeriodDays: savingsRule.gracePeriodDays,
        lateFeePct: savingsRule.lateFeePct,
        autoApproveContributions: savingsRule.autoApproveContributions,
        startDate: savingsRule.startDate,
        endDate: savingsRule.endDate,
      ) : null,
    );
  }

  MembershipModel _mapMembershipToModel(Membership m) {
    return MembershipModel(
      id: m.id,
      groupId: m.groupId,
      userId: m.userId,
      role: MemberRole.values.firstWhere(
        (e) => e.name == m.role,
        orElse: () => MemberRole.MEMBER,
      ),
      status: MemberStatus.values.firstWhere(
        (e) => e.name == m.status,
        orElse: () => MemberStatus.ACTIVE,
      ),
      joinedAt: m.joinedAt,
    );
  }
}

// Provider
final groupRepositoryProvider = Provider<GroupRepository>((ref) {
  return GroupRepository(
    ref.watch(databaseProvider),
    ref.watch(apiClientProvider),
    ref.watch(connectivityServiceProvider),
  );
});
