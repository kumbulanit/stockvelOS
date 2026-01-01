import 'package:freezed_annotation/freezed_annotation.dart';

part 'ledger_model.freezed.dart';
part 'ledger_model.g.dart';

enum LedgerEntryType {
  CONTRIBUTION,
  LATE_FEE,
  PAYOUT,
  ADJUSTMENT,
  INTEREST,
  FEE,
}

@freezed
class LedgerEntryModel with _$LedgerEntryModel {
  const factory LedgerEntryModel({
    required String id,
    required String groupId,
    String? membershipId,
    required LedgerEntryType entryType,
    required double amount,
    required double balanceAfter,
    String? referenceType,
    String? referenceId,
    String? description,
    required DateTime createdAt,
    MemberInfo? member,
  }) = _LedgerEntryModel;

  factory LedgerEntryModel.fromJson(Map<String, dynamic> json) =>
      _$LedgerEntryModelFromJson(json);
}

@freezed
class MemberInfo with _$MemberInfo {
  const factory MemberInfo({
    required String userId,
    required String firstName,
    required String lastName,
  }) = _MemberInfo;

  factory MemberInfo.fromJson(Map<String, dynamic> json) =>
      _$MemberInfoFromJson(json);
}

@freezed
class LedgerResponse with _$LedgerResponse {
  const factory LedgerResponse({
    required List<LedgerEntryModel> entries,
    required int page,
    required int limit,
    required int total,
    required int totalPages,
  }) = _LedgerResponse;

  factory LedgerResponse.fromJson(Map<String, dynamic> json) =>
      _$LedgerResponseFromJson(json);
}
