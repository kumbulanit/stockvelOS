import 'package:freezed_annotation/freezed_annotation.dart';
import 'group_model.dart';

part 'payout_model.freezed.dart';
part 'payout_model.g.dart';

enum PayoutStatus { PENDING, APPROVED, COMPLETED, CANCELLED }

@freezed
class PayoutModel with _$PayoutModel {
  const factory PayoutModel({
    required String id,
    required String groupId,
    required String recipientMembershipId,
    required double amount,
    required DateTime scheduledDate,
    required PayoutStatus status,
    String? paymentMethod,
    String? externalReference,
    DateTime? completedAt,
    MembershipModel? recipient,
  }) = _PayoutModel;

  factory PayoutModel.fromJson(Map<String, dynamic> json) =>
      _$PayoutModelFromJson(json);
}
