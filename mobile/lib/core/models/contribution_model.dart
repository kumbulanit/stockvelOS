import 'package:freezed_annotation/freezed_annotation.dart';
import 'group_model.dart';

part 'contribution_model.freezed.dart';
part 'contribution_model.g.dart';

enum ContributionStatus { PENDING, APPROVED, REJECTED, CANCELLED }

@freezed
class ContributionModel with _$ContributionModel {
  const factory ContributionModel({
    required String id,
    required String membershipId,
    required String groupId,
    required double amount,
    required String contributionPeriod,
    required ContributionStatus status,
    String? paymentMethod,
    String? externalReference,
    String? popDocumentId,
    String? approverNotes,
    String? rejectReason,
    required String idempotencyKey,
    required DateTime createdAt,
    DateTime? approvedAt,
    MembershipModel? member,
  }) = _ContributionModel;

  factory ContributionModel.fromJson(Map<String, dynamic> json) =>
      _$ContributionModelFromJson(json);
}

@freezed
class ContributionSummary with _$ContributionSummary {
  const factory ContributionSummary({
    required int totalContributions,
    required int approvedCount,
    required int pendingCount,
    required int rejectedCount,
    required double totalAmount,
    required double pendingAmount,
  }) = _ContributionSummary;

  factory ContributionSummary.fromJson(Map<String, dynamic> json) =>
      _$ContributionSummaryFromJson(json);
}

@freezed
class ContributionsResponse with _$ContributionsResponse {
  const factory ContributionsResponse({
    required List<ContributionModel> contributions,
    ContributionSummary? summary,
  }) = _ContributionsResponse;

  factory ContributionsResponse.fromJson(Map<String, dynamic> json) =>
      _$ContributionsResponseFromJson(json);
}
