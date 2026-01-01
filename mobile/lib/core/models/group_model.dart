import 'package:freezed_annotation/freezed_annotation.dart';

part 'group_model.freezed.dart';
part 'group_model.g.dart';

enum GroupType { SAVINGS, LENDING, INVESTMENT }

enum GroupStatus { ACTIVE, SUSPENDED, CLOSED }

enum MemberRole { CHAIRPERSON, TREASURER, SECRETARY, MEMBER }

enum MemberStatus { ACTIVE, SUSPENDED, LEFT }

@freezed
class GroupModel with _$GroupModel {
  const factory GroupModel({
    required String id,
    required String name,
    String? description,
    required GroupType type,
    required GroupStatus status,
    required int memberCount,
    MemberRole? myRole,
    SavingsRuleModel? savingsRule,
    required DateTime createdAt,
    DateTime? updatedAt,
  }) = _GroupModel;

  factory GroupModel.fromJson(Map<String, dynamic> json) =>
      _$GroupModelFromJson(json);
}

@freezed
class MembershipModel with _$MembershipModel {
  const factory MembershipModel({
    required String id,
    required String groupId,
    required String userId,
    required MemberRole role,
    required MemberStatus status,
    required DateTime joinedAt,
    UserSummary? user,
  }) = _MembershipModel;

  factory MembershipModel.fromJson(Map<String, dynamic> json) =>
      _$MembershipModelFromJson(json);
}

@freezed
class UserSummary with _$UserSummary {
  const factory UserSummary({
    required String id,
    required String firstName,
    required String lastName,
    String? email,
  }) = _UserSummary;

  factory UserSummary.fromJson(Map<String, dynamic> json) =>
      _$UserSummaryFromJson(json);
}

@freezed
class SavingsRuleModel with _$SavingsRuleModel {
  const factory SavingsRuleModel({
    required String id,
    required String groupId,
    required String contributionFrequency,
    required double contributionAmount,
    int? contributionDayOfMonth,
    required String payoutOrder,
    @Default(3) int gracePeriodDays,
    @Default(5.0) double lateFeePct,
    @Default(false) bool autoApproveContributions,
    required DateTime startDate,
    DateTime? endDate,
  }) = _SavingsRuleModel;

  factory SavingsRuleModel.fromJson(Map<String, dynamic> json) =>
      _$SavingsRuleModelFromJson(json);
}
