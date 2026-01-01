import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/contribution_model.dart';
import '../repositories/contribution_repository.dart';

// My contributions for a group
final myContributionsProvider = FutureProvider.autoDispose.family<ContributionsResponse, String>((ref, groupId) async {
  final repository = ref.watch(contributionRepositoryProvider);
  return repository.getMyContributions(groupId);
});

// Pending contributions for treasurer review
final pendingContributionsProvider = FutureProvider.autoDispose.family<List<ContributionModel>, String>((ref, groupId) async {
  final repository = ref.watch(contributionRepositoryProvider);
  return repository.getPendingContributions(groupId);
});

// Contribution submission state
class ContributionSubmissionState {
  final bool isSubmitting;
  final ContributionModel? contribution;
  final String? error;

  const ContributionSubmissionState({
    this.isSubmitting = false,
    this.contribution,
    this.error,
  });

  ContributionSubmissionState copyWith({
    bool? isSubmitting,
    ContributionModel? contribution,
    String? error,
  }) {
    return ContributionSubmissionState(
      isSubmitting: isSubmitting ?? this.isSubmitting,
      contribution: contribution ?? this.contribution,
      error: error,
    );
  }
}

class ContributionSubmissionNotifier extends StateNotifier<ContributionSubmissionState> {
  final ContributionRepository _repository;

  ContributionSubmissionNotifier(this._repository) 
      : super(const ContributionSubmissionState());

  Future<bool> submit({
    required String groupId,
    required String membershipId,
    required double amount,
    required String contributionPeriod,
    required String paymentMethod,
    String? externalReference,
    String? popDocumentId,
  }) async {
    state = state.copyWith(isSubmitting: true, error: null);

    try {
      final contribution = await _repository.submitContribution(
        groupId: groupId,
        membershipId: membershipId,
        amount: amount,
        contributionPeriod: contributionPeriod,
        paymentMethod: paymentMethod,
        externalReference: externalReference,
        popDocumentId: popDocumentId,
      );

      state = state.copyWith(
        isSubmitting: false,
        contribution: contribution,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isSubmitting: false,
        error: e.toString(),
      );
      return false;
    }
  }

  Future<bool> approve(String id, {String? notes}) async {
    state = state.copyWith(isSubmitting: true, error: null);

    try {
      await _repository.approveContribution(id, notes: notes);
      state = state.copyWith(isSubmitting: false);
      return true;
    } catch (e) {
      state = state.copyWith(
        isSubmitting: false,
        error: e.toString(),
      );
      return false;
    }
  }

  Future<bool> reject(String id, String reason) async {
    state = state.copyWith(isSubmitting: true, error: null);

    try {
      await _repository.rejectContribution(id, reason);
      state = state.copyWith(isSubmitting: false);
      return true;
    } catch (e) {
      state = state.copyWith(
        isSubmitting: false,
        error: e.toString(),
      );
      return false;
    }
  }

  void reset() {
    state = const ContributionSubmissionState();
  }
}

final contributionSubmissionProvider = StateNotifierProvider<ContributionSubmissionNotifier, ContributionSubmissionState>((ref) {
  return ContributionSubmissionNotifier(ref.watch(contributionRepositoryProvider));
});
