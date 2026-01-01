import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../models/grocery_models.dart';

/// Remote API data source for grocery module
class GroceryRemoteDataSource {
  final ApiClient _apiClient;

  GroceryRemoteDataSource(this._apiClient);

  // =====================
  // Member Endpoints
  // =====================

  /// Get my grocery groups
  Future<List<GroceryGroup>> getMyGroceryGroups() async {
    final response = await _apiClient.get('/me/grocery/groups');
    final data = response.data as Map<String, dynamic>;
    final groups = data['groups'] as List;
    return groups
        .map((g) => GroceryGroup.fromJson(g as Map<String, dynamic>))
        .toList();
  }

  /// Get my allocations across all groups or for a specific group
  Future<List<MyAllocation>> getMyAllocations({String? groupId}) async {
    final queryParams = groupId != null ? {'groupId': groupId} : null;
    final response = await _apiClient.get(
      '/me/grocery/allocations',
      queryParameters: queryParams,
    );
    final data = response.data as Map<String, dynamic>;
    final allocations = data['allocations'] as List;
    return allocations
        .map((a) => MyAllocation.fromJson(a as Map<String, dynamic>))
        .toList();
  }

  /// Confirm receipt of a distribution item
  Future<ConfirmationResult> confirmItem({
    required String itemId,
    required String idempotencyKey,
  }) async {
    final response = await _apiClient.post(
      '/grocery/distribution-items/$itemId/confirm',
      data: {'idempotencyKey': idempotencyKey},
    );
    return ConfirmationResult.fromJson(response.data as Map<String, dynamic>);
  }

  /// Get distribution history for a member
  Future<List<MyAllocation>> getMyHistory({
    int page = 1,
    int limit = 20,
  }) async {
    final response = await _apiClient.get(
      '/me/grocery/history',
      queryParameters: {'page': page, 'limit': limit},
    );
    final data = response.data as Map<String, dynamic>;
    final history = data['history'] as List;
    return history
        .map((h) => MyAllocation.fromJson(h as Map<String, dynamic>))
        .toList();
  }

  // =====================
  // Group Endpoints (Read-only for members)
  // =====================

  /// Get group summary
  Future<GrocerySummary> getGroupSummary(String groupId) async {
    final response = await _apiClient.get('/groups/$groupId/grocery/summary');
    return GrocerySummary.fromJson(response.data as Map<String, dynamic>);
  }

  /// Get group products
  Future<List<GroceryProduct>> getGroupProducts(String groupId) async {
    final response = await _apiClient.get('/groups/$groupId/grocery/products');
    final data = response.data as Map<String, dynamic>;
    final products = data['products'] as List;
    return products
        .map((p) => GroceryProduct.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  /// Get current stock
  Future<List<StockItem>> getGroupStock(String groupId) async {
    final response = await _apiClient.get('/groups/$groupId/grocery/stock');
    final data = response.data as Map<String, dynamic>;
    final stock = data['stock'] as List;
    return stock
        .map((s) => StockItem.fromJson(s as Map<String, dynamic>))
        .toList();
  }

  /// Get distribution details
  Future<GroceryDistribution> getDistribution(
    String groupId,
    String distributionId,
  ) async {
    final response = await _apiClient.get(
      '/groups/$groupId/grocery/distributions/$distributionId',
    );
    return GroceryDistribution.fromJson(response.data as Map<String, dynamic>);
  }

  /// Get list of distributions
  Future<List<GroceryDistribution>> getDistributions(
    String groupId, {
    String? status,
    int page = 1,
    int limit = 20,
  }) async {
    final response = await _apiClient.get(
      '/groups/$groupId/grocery/distributions',
      queryParameters: {
        if (status != null) 'status': status,
        'page': page,
        'limit': limit,
      },
    );
    final data = response.data as Map<String, dynamic>;
    final distributions = data['distributions'] as List;
    return distributions
        .map((d) => GroceryDistribution.fromJson(d as Map<String, dynamic>))
        .toList();
  }
}

/// Extension to add grocery endpoints to ApiClient
extension GroceryApiExtension on ApiClient {
  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) {
    // This would delegate to the internal Dio instance
    // For now, we expose it as a separate method
    throw UnimplementedError('Use GroceryRemoteDataSource instead');
  }

  Future<Response> post(String path, {Map<String, dynamic>? data}) {
    throw UnimplementedError('Use GroceryRemoteDataSource instead');
  }
}
