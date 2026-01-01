import 'package:json_annotation/json_annotation.dart';

part 'grocery_models.g.dart';

/// Grocery product model
@JsonSerializable()
class GroceryProduct {
  final String id;
  final String groupId;
  final String name;
  final String unit;
  final GroceryCategory category;
  final double? defaultSize;
  final bool active;
  final DateTime createdAt;
  final DateTime updatedAt;

  const GroceryProduct({
    required this.id,
    required this.groupId,
    required this.name,
    required this.unit,
    required this.category,
    this.defaultSize,
    required this.active,
    required this.createdAt,
    required this.updatedAt,
  });

  factory GroceryProduct.fromJson(Map<String, dynamic> json) =>
      _$GroceryProductFromJson(json);

  Map<String, dynamic> toJson() => _$GroceryProductToJson(this);
}

/// Grocery categories
enum GroceryCategory {
  @JsonValue('STAPLES')
  staples,
  @JsonValue('MEAT')
  meat,
  @JsonValue('DAIRY')
  dairy,
  @JsonValue('VEGETABLES')
  vegetables,
  @JsonValue('FRUITS')
  fruits,
  @JsonValue('BEVERAGES')
  beverages,
  @JsonValue('TOILETRIES')
  toiletries,
  @JsonValue('CLEANING')
  cleaning,
  @JsonValue('VOUCHERS')
  vouchers,
  @JsonValue('OTHER')
  other,
}

/// Stock item with current quantity
@JsonSerializable()
class StockItem {
  final String productId;
  final String productName;
  final String productUnit;
  final String category;
  final double currentQuantity;

  const StockItem({
    required this.productId,
    required this.productName,
    required this.productUnit,
    required this.category,
    required this.currentQuantity,
  });

  factory StockItem.fromJson(Map<String, dynamic> json) =>
      _$StockItemFromJson(json);

  Map<String, dynamic> toJson() => _$StockItemToJson(this);

  bool get isLowStock => currentQuantity <= 5;
}

/// Grocery distribution model
@JsonSerializable()
class GroceryDistribution {
  final String id;
  final String groupId;
  final String eventName;
  final DateTime eventDate;
  final DistributionStatus status;
  final String allocationRule;
  final String? notes;
  final DateTime createdAt;
  final List<DistributionItem>? items;

  const GroceryDistribution({
    required this.id,
    required this.groupId,
    required this.eventName,
    required this.eventDate,
    required this.status,
    required this.allocationRule,
    this.notes,
    required this.createdAt,
    this.items,
  });

  factory GroceryDistribution.fromJson(Map<String, dynamic> json) =>
      _$GroceryDistributionFromJson(json);

  Map<String, dynamic> toJson() => _$GroceryDistributionToJson(this);
}

/// Distribution status
enum DistributionStatus {
  @JsonValue('DRAFT')
  draft,
  @JsonValue('CONFIRMED')
  confirmed,
  @JsonValue('DISTRIBUTED')
  distributed,
  @JsonValue('CANCELLED')
  cancelled,
}

/// Distribution item (member allocation)
@JsonSerializable()
class DistributionItem {
  final String id;
  final String distributionId;
  final String productId;
  final String memberId;
  final double quantity;
  final DistributionItemStatus status;
  final DateTime? confirmedAt;
  final GroceryProduct? product;

  const DistributionItem({
    required this.id,
    required this.distributionId,
    required this.productId,
    required this.memberId,
    required this.quantity,
    required this.status,
    this.confirmedAt,
    this.product,
  });

  factory DistributionItem.fromJson(Map<String, dynamic> json) =>
      _$DistributionItemFromJson(json);

  Map<String, dynamic> toJson() => _$DistributionItemToJson(this);

  bool get isPending => status == DistributionItemStatus.allocated;
  bool get isCollected => status == DistributionItemStatus.collected;
}

/// Distribution item status
enum DistributionItemStatus {
  @JsonValue('ALLOCATED')
  allocated,
  @JsonValue('COLLECTED')
  collected,
  @JsonValue('UNCOLLECTED')
  uncollected,
}

/// Grocery summary
@JsonSerializable()
class GrocerySummary {
  final double potBalance;
  final int productCount;
  final int totalDistributions;
  final int pendingPurchases;
  final int memberCount;

  const GrocerySummary({
    required this.potBalance,
    required this.productCount,
    required this.totalDistributions,
    required this.pendingPurchases,
    required this.memberCount,
  });

  factory GrocerySummary.fromJson(Map<String, dynamic> json) =>
      _$GrocerySummaryFromJson(json);

  Map<String, dynamic> toJson() => _$GrocerySummaryToJson(this);
}

/// My allocation (member view)
@JsonSerializable()
class MyAllocation {
  final String distributionId;
  final String eventName;
  final DateTime eventDate;
  final DistributionStatus distributionStatus;
  final List<AllocationItem> items;
  final int pendingCount;
  final int totalCount;

  const MyAllocation({
    required this.distributionId,
    required this.eventName,
    required this.eventDate,
    required this.distributionStatus,
    required this.items,
    required this.pendingCount,
    required this.totalCount,
  });

  factory MyAllocation.fromJson(Map<String, dynamic> json) =>
      _$MyAllocationFromJson(json);

  Map<String, dynamic> toJson() => _$MyAllocationToJson(this);

  double get collectionProgress =>
      totalCount > 0 ? (totalCount - pendingCount) / totalCount : 0;
}

/// Individual allocation item
@JsonSerializable()
class AllocationItem {
  final String itemId;
  final String productId;
  final String productName;
  final String productUnit;
  final double quantity;
  final DistributionItemStatus status;
  final DateTime? confirmedAt;

  const AllocationItem({
    required this.itemId,
    required this.productId,
    required this.productName,
    required this.productUnit,
    required this.quantity,
    required this.status,
    this.confirmedAt,
  });

  factory AllocationItem.fromJson(Map<String, dynamic> json) =>
      _$AllocationItemFromJson(json);

  Map<String, dynamic> toJson() => _$AllocationItemToJson(this);

  bool get isPending => status == DistributionItemStatus.allocated;
}

/// Grocery group (member view)
@JsonSerializable()
class GroceryGroup {
  final String groupId;
  final String groupName;
  final int pendingAllocations;
  final int totalDistributions;
  final DateTime? nextDistributionDate;

  const GroceryGroup({
    required this.groupId,
    required this.groupName,
    required this.pendingAllocations,
    required this.totalDistributions,
    this.nextDistributionDate,
  });

  factory GroceryGroup.fromJson(Map<String, dynamic> json) =>
      _$GroceryGroupFromJson(json);

  Map<String, dynamic> toJson() => _$GroceryGroupToJson(this);
}

/// Confirmation result
@JsonSerializable()
class ConfirmationResult {
  final String itemId;
  final DistributionItemStatus status;
  final DateTime confirmedAt;
  final bool fromCache;

  const ConfirmationResult({
    required this.itemId,
    required this.status,
    required this.confirmedAt,
    required this.fromCache,
  });

  factory ConfirmationResult.fromJson(Map<String, dynamic> json) =>
      _$ConfirmationResultFromJson(json);

  Map<String, dynamic> toJson() => _$ConfirmationResultToJson(this);
}
