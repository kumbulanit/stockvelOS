import 'package:freezed_annotation/freezed_annotation.dart';

part 'notification_model.freezed.dart';
part 'notification_model.g.dart';

enum NotificationType {
  CONTRIBUTION_APPROVED,
  CONTRIBUTION_REJECTED,
  CONTRIBUTION_REMINDER,
  PAYOUT_SCHEDULED,
  PAYOUT_COMPLETED,
  GROUP_INVITE,
  SYSTEM,
}

@freezed
class NotificationModel with _$NotificationModel {
  const factory NotificationModel({
    required String id,
    required String userId,
    String? groupId,
    required NotificationType type,
    required String title,
    required String body,
    required String channel,
    DateTime? readAt,
    required DateTime createdAt,
    GroupInfo? group,
  }) = _NotificationModel;

  factory NotificationModel.fromJson(Map<String, dynamic> json) =>
      _$NotificationModelFromJson(json);
}

@freezed
class GroupInfo with _$GroupInfo {
  const factory GroupInfo({
    required String id,
    required String name,
  }) = _GroupInfo;

  factory GroupInfo.fromJson(Map<String, dynamic> json) =>
      _$GroupInfoFromJson(json);
}

@freezed
class NotificationsResponse with _$NotificationsResponse {
  const factory NotificationsResponse({
    required List<NotificationModel> notifications,
    required int unreadCount,
    required int total,
  }) = _NotificationsResponse;

  factory NotificationsResponse.fromJson(Map<String, dynamic> json) =>
      _$NotificationsResponseFromJson(json);
}
