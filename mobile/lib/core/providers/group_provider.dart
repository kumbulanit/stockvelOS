import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/group_model.dart';
import '../repositories/group_repository.dart';

// Groups list provider
final groupsProvider = FutureProvider.autoDispose<List<GroupModel>>((ref) async {
  final repository = ref.watch(groupRepositoryProvider);
  return repository.getGroups();
});

// Single group provider
final groupProvider = FutureProvider.autoDispose.family<GroupModel?, String>((ref, id) async {
  final repository = ref.watch(groupRepositoryProvider);
  return repository.getGroup(id);
});

// Group members provider
final groupMembersProvider = FutureProvider.autoDispose.family<List<MembershipModel>, String>((ref, groupId) async {
  final repository = ref.watch(groupRepositoryProvider);
  return repository.getMembers(groupId);
});

// Refresh groups
class GroupsNotifier extends StateNotifier<AsyncValue<List<GroupModel>>> {
  final GroupRepository _repository;

  GroupsNotifier(this._repository) : super(const AsyncValue.loading()) {
    loadGroups();
  }

  Future<void> loadGroups() async {
    state = const AsyncValue.loading();
    try {
      final groups = await _repository.getGroups();
      state = AsyncValue.data(groups);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> refreshGroups() async {
    try {
      final groups = await _repository.getGroups(forceRefresh: true);
      state = AsyncValue.data(groups);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<GroupModel> createGroup({
    required String name,
    required GroupType type,
    String? description,
    double? contributionAmount,
    String? contributionFrequency,
    int? contributionDayOfMonth,
    String? payoutOrder,
  }) async {
    final group = await _repository.createGroup(
      name: name,
      type: type,
      description: description,
      contributionAmount: contributionAmount,
      contributionFrequency: contributionFrequency,
      contributionDayOfMonth: contributionDayOfMonth,
      payoutOrder: payoutOrder,
    );

    // Refresh the list
    await refreshGroups();
    return group;
  }
}

final groupsNotifierProvider = StateNotifierProvider<GroupsNotifier, AsyncValue<List<GroupModel>>>((ref) {
  return GroupsNotifier(ref.watch(groupRepositoryProvider));
});
