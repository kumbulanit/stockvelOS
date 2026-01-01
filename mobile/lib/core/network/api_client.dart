import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../services/secure_storage_service.dart';

const String _baseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:3000/api',
);

class ApiClient {
  final Dio _dio;
  final SecureStorageService _storage;

  ApiClient(this._dio, this._storage) {
    _dio.options.baseUrl = _baseUrl;
    _dio.options.connectTimeout = const Duration(seconds: 30);
    _dio.options.receiveTimeout = const Duration(seconds: 30);
    _dio.options.headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Request interceptor for auth token
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.getAccessToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode == 401) {
            // Try to refresh token
            final refreshed = await _refreshToken();
            if (refreshed) {
              // Retry the request
              final retryOptions = error.requestOptions;
              final token = await _storage.getAccessToken();
              retryOptions.headers['Authorization'] = 'Bearer $token';
              
              try {
                final response = await _dio.fetch(retryOptions);
                return handler.resolve(response);
              } catch (e) {
                return handler.next(error);
              }
            }
          }
          return handler.next(error);
        },
      ),
    );
  }

  Future<bool> _refreshToken() async {
    try {
      final refreshToken = await _storage.getRefreshToken();
      if (refreshToken == null) return false;

      final response = await Dio().post(
        '$_baseUrl/auth/refresh',
        data: {'refreshToken': refreshToken},
      );

      if (response.statusCode == 200) {
        await _storage.saveAccessToken(response.data['accessToken']);
        await _storage.saveRefreshToken(response.data['refreshToken']);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // =====================
  // Auth Endpoints
  // =====================

  Future<Response> login(String email, String password) async {
    return _dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
  }

  Future<Response> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    String? phone,
  }) async {
    return _dio.post('/auth/register', data: {
      'email': email,
      'password': password,
      'firstName': firstName,
      'lastName': lastName,
      if (phone != null) 'phone': phone,
    });
  }

  Future<Response> logout() async {
    return _dio.post('/auth/logout');
  }

  Future<Response> getProfile() async {
    return _dio.get('/auth/profile');
  }

  // =====================
  // Groups Endpoints
  // =====================

  Future<Response> getGroups() async {
    return _dio.get('/groups');
  }

  Future<Response> getGroup(String id) async {
    return _dio.get('/groups/$id');
  }

  Future<Response> createGroup(Map<String, dynamic> data) async {
    return _dio.post('/groups', data: data);
  }

  Future<Response> joinGroup(String groupId) async {
    return _dio.post('/groups/$groupId/join');
  }

  // =====================
  // Savings Endpoints
  // =====================

  Future<Response> getSavingsGroup(String id) async {
    return _dio.get('/savings/$id');
  }

  Future<Response> getSavingsBalance(String id) async {
    return _dio.get('/savings/$id/balance');
  }

  Future<Response> getPayoutSchedule(String id) async {
    return _dio.get('/savings/$id/payout-schedule');
  }

  // =====================
  // Contributions Endpoints
  // =====================

  Future<Response> submitContribution({
    required String groupId,
    required double amount,
    required String contributionPeriod,
    required String paymentMethod,
    required String idempotencyKey,
    String? externalReference,
    String? popDocumentId,
  }) async {
    return _dio.post(
      '/contributions/submit/$groupId',
      data: {
        'amount': amount,
        'contributionPeriod': contributionPeriod,
        'paymentMethod': paymentMethod,
        'idempotencyKey': idempotencyKey,
        if (externalReference != null) 'externalReference': externalReference,
        if (popDocumentId != null) 'popDocumentId': popDocumentId,
      },
    );
  }

  Future<Response> getMyContributions(String groupId) async {
    return _dio.get('/contributions/my/$groupId');
  }

  Future<Response> getGroupContributions(String groupId, {String? status}) async {
    return _dio.get('/contributions/group/$groupId', queryParameters: {
      if (status != null) 'status': status,
    });
  }

  Future<Response> approveContribution(String id, {String? notes}) async {
    return _dio.put('/contributions/$id/approve', data: {
      if (notes != null) 'notes': notes,
    });
  }

  Future<Response> rejectContribution(String id, String reason) async {
    return _dio.put('/contributions/$id/reject', data: {
      'reason': reason,
    });
  }

  // =====================
  // Payouts Endpoints
  // =====================

  Future<Response> getPayoutsForGroup(String groupId) async {
    return _dio.get('/payouts/group/$groupId');
  }

  Future<Response> approvePayout(String id) async {
    return _dio.put('/payouts/$id/approve');
  }

  Future<Response> completePayout(String id, {
    required String paymentMethod,
    String? externalReference,
  }) async {
    return _dio.put('/payouts/$id/complete', data: {
      'paymentMethod': paymentMethod,
      if (externalReference != null) 'externalReference': externalReference,
    });
  }

  // =====================
  // Ledger Endpoints
  // =====================

  Future<Response> getLedger(String groupId, {int page = 1, int limit = 50}) async {
    return _dio.get('/ledger/group/$groupId', queryParameters: {
      'page': page,
      'limit': limit,
    });
  }

  // =====================
  // Notifications Endpoints
  // =====================

  Future<Response> getNotifications({int page = 1, int limit = 50}) async {
    return _dio.get('/notifications', queryParameters: {
      'page': page,
      'limit': limit,
    });
  }

  Future<Response> markNotificationRead(String id) async {
    return _dio.put('/notifications/$id/read');
  }

  Future<Response> markAllNotificationsRead() async {
    return _dio.put('/notifications/read-all');
  }

  // =====================
  // Documents Endpoints
  // =====================

  Future<Response> getUploadUrl(String filename, String contentType) async {
    return _dio.post('/documents/upload-url', data: {
      'filename': filename,
      'contentType': contentType,
    });
  }

  Future<Response> getDocumentDownloadUrl(String id) async {
    return _dio.get('/documents/$id/download-url');
  }
}

// Providers
final dioProvider = Provider<Dio>((ref) => Dio());

final apiClientProvider = Provider<ApiClient>((ref) {
  final dio = ref.watch(dioProvider);
  final storage = ref.watch(secureStorageProvider);
  return ApiClient(dio, storage);
});
