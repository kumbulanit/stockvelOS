import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/app_database.dart';
import '../models/user_model.dart';
import '../network/api_client.dart';
import '../services/secure_storage_service.dart';
import '../services/connectivity_service.dart';

class AuthRepository {
  final AppDatabase _db;
  final ApiClient _api;
  final SecureStorageService _storage;
  final ConnectivityService _connectivity;

  AuthRepository(this._db, this._api, this._storage, this._connectivity);

  /// Login with email and password
  Future<UserModel> login(String email, String password) async {
    final response = await _api.login(email, password);
    final data = response.data;

    // Save tokens
    await _storage.saveAccessToken(data['accessToken']);
    await _storage.saveRefreshToken(data['refreshToken']);

    // Parse and save user
    final user = UserModel.fromJson(data['user']);
    await _storage.saveUserId(user.id);

    // Save to local DB
    await _db.saveUser(User(
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt ?? user.createdAt,
      syncedAt: DateTime.now(),
    ));

    return user;
  }

  /// Register a new user
  Future<UserModel> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    String? phone,
  }) async {
    final response = await _api.register(
      email: email,
      password: password,
      firstName: firstName,
      lastName: lastName,
      phone: phone,
    );
    final data = response.data;

    // Save tokens
    await _storage.saveAccessToken(data['accessToken']);
    await _storage.saveRefreshToken(data['refreshToken']);

    // Parse and save user
    final user = UserModel.fromJson(data['user']);
    await _storage.saveUserId(user.id);

    // Save to local DB
    await _db.saveUser(User(
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt ?? user.createdAt,
      syncedAt: DateTime.now(),
    ));

    return user;
  }

  /// Logout
  Future<void> logout() async {
    try {
      // Try to call server logout (if online)
      final isOnline = await _connectivity.isConnected();
      if (isOnline) {
        await _api.logout();
      }
    } catch (e) {
      // Ignore errors during logout
    } finally {
      // Always clear local data
      await _storage.clearAll();
      await _db.clearAllData();
    }
  }

  /// Get current user from local storage
  Future<UserModel?> getCurrentUser() async {
    final localUser = await _db.getCurrentUser();
    if (localUser == null) return null;

    return UserModel(
      id: localUser.id,
      email: localUser.email,
      firstName: localUser.firstName,
      lastName: localUser.lastName,
      phone: localUser.phone,
      role: localUser.role,
      createdAt: localUser.createdAt,
      updatedAt: localUser.updatedAt,
    );
  }

  /// Refresh user profile from server
  Future<UserModel?> refreshProfile() async {
    final isOnline = await _connectivity.isConnected();
    if (!isOnline) {
      return getCurrentUser();
    }

    try {
      final response = await _api.getProfile();
      final user = UserModel.fromJson(response.data);

      // Update local DB
      await _db.saveUser(User(
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt ?? user.createdAt,
        syncedAt: DateTime.now(),
      ));

      return user;
    } catch (e) {
      // Return cached user on error
      return getCurrentUser();
    }
  }

  /// Check if user is logged in
  Future<bool> isLoggedIn() async {
    return _storage.isLoggedIn();
  }
}

// Provider
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    ref.watch(databaseProvider),
    ref.watch(apiClientProvider),
    ref.watch(secureStorageProvider),
    ref.watch(connectivityServiceProvider),
  );
});
