import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ConnectivityService {
  final Connectivity _connectivity = Connectivity();
  final _controller = StreamController<bool>.broadcast();

  ConnectivityService() {
    _connectivity.onConnectivityChanged.listen(_updateStatus);
    _checkInitialStatus();
  }

  Stream<bool> get onConnectivityChanged => _controller.stream;

  void _updateStatus(List<ConnectivityResult> results) {
    final isConnected = !results.contains(ConnectivityResult.none);
    _controller.add(isConnected);
  }

  Future<void> _checkInitialStatus() async {
    final results = await _connectivity.checkConnectivity();
    _updateStatus(results);
  }

  Future<bool> isConnected() async {
    final results = await _connectivity.checkConnectivity();
    return !results.contains(ConnectivityResult.none);
  }

  void dispose() {
    _controller.close();
  }
}

// Providers
final connectivityServiceProvider = Provider<ConnectivityService>((ref) {
  final service = ConnectivityService();
  ref.onDispose(() => service.dispose());
  return service;
});

final isConnectedProvider = StreamProvider<bool>((ref) {
  final service = ref.watch(connectivityServiceProvider);
  return service.onConnectivityChanged;
});

final isConnectedStateProvider = FutureProvider<bool>((ref) async {
  final service = ref.watch(connectivityServiceProvider);
  return service.isConnected();
});
