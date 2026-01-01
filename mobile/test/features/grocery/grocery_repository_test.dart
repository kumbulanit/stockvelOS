import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

import 'package:stockvel_os/features/grocery/data/models/grocery_models.dart';
import 'package:stockvel_os/features/grocery/data/local/grocery_local_datasource.dart';
import 'package:stockvel_os/features/grocery/data/remote/grocery_remote_datasource.dart';
import 'package:stockvel_os/features/grocery/data/repositories/grocery_repository.dart';

// Mocks
class MockGroceryRemoteDataSource extends Mock
    implements GroceryRemoteDataSource {}

class MockGroceryLocalDataSource extends Mock
    implements GroceryLocalDataSource {}

class MockConnectivity extends Mock implements Connectivity {}

void main() {
  late GroceryRepository repository;
  late MockGroceryRemoteDataSource mockRemote;
  late MockGroceryLocalDataSource mockLocal;
  late MockConnectivity mockConnectivity;

  setUp(() {
    mockRemote = MockGroceryRemoteDataSource();
    mockLocal = MockGroceryLocalDataSource();
    mockConnectivity = MockConnectivity();

    repository = GroceryRepository(
      remoteDataSource: mockRemote,
      localDataSource: mockLocal,
      connectivity: mockConnectivity,
    );
  });

  group('GroceryRepository', () {
    group('getMyGroceryGroups', () {
      final mockGroups = [
        const GroceryGroup(
          groupId: 'group-1',
          groupName: 'Test Group',
          pendingAllocations: 5,
          totalDistributions: 10,
        ),
      ];

      test('should return remote data when online', () async {
        // Arrange
        when(() => mockConnectivity.checkConnectivity())
            .thenAnswer((_) async => ConnectivityResult.wifi);
        when(() => mockRemote.getMyGroceryGroups())
            .thenAnswer((_) async => mockGroups);
        when(() => mockLocal.cacheGroceryGroups(mockGroups))
            .thenAnswer((_) async {});

        // Act
        final result = await repository.getMyGroceryGroups();

        // Assert
        expect(result, equals(mockGroups));
        verify(() => mockRemote.getMyGroceryGroups()).called(1);
        verify(() => mockLocal.cacheGroceryGroups(mockGroups)).called(1);
      });

      test('should return cached data when offline', () async {
        // Arrange
        when(() => mockConnectivity.checkConnectivity())
            .thenAnswer((_) async => ConnectivityResult.none);
        when(() => mockLocal.getCachedGroceryGroups())
            .thenAnswer((_) async => mockGroups);

        // Act
        final result = await repository.getMyGroceryGroups();

        // Assert
        expect(result, equals(mockGroups));
        verify(() => mockLocal.getCachedGroceryGroups()).called(1);
        verifyNever(() => mockRemote.getMyGroceryGroups());
      });

      test('should fallback to cache on remote error', () async {
        // Arrange
        when(() => mockConnectivity.checkConnectivity())
            .thenAnswer((_) async => ConnectivityResult.wifi);
        when(() => mockRemote.getMyGroceryGroups())
            .thenThrow(Exception('Network error'));
        when(() => mockLocal.getCachedGroceryGroups())
            .thenAnswer((_) async => mockGroups);

        // Act
        final result = await repository.getMyGroceryGroups();

        // Assert
        expect(result, equals(mockGroups));
      });
    });

    group('getMyAllocations', () {
      final mockAllocations = [
        MyAllocation(
          distributionId: 'dist-1',
          eventName: 'December Distribution',
          eventDate: DateTime(2024, 12, 15),
          distributionStatus: DistributionStatus.confirmed,
          items: const [],
          pendingCount: 3,
          totalCount: 5,
        ),
      ];

      test('should return remote data when online', () async {
        // Arrange
        when(() => mockConnectivity.checkConnectivity())
            .thenAnswer((_) async => ConnectivityResult.wifi);
        when(() => mockRemote.getMyAllocations(groupId: any(named: 'groupId')))
            .thenAnswer((_) async => mockAllocations);
        when(() => mockLocal.cacheAllocations(mockAllocations))
            .thenAnswer((_) async {});

        // Act
        final result = await repository.getMyAllocations();

        // Assert
        expect(result, equals(mockAllocations));
        verify(() => mockLocal.cacheAllocations(mockAllocations)).called(1);
      });

      test('should return cached data when offline', () async {
        // Arrange
        when(() => mockConnectivity.checkConnectivity())
            .thenAnswer((_) async => ConnectivityResult.none);
        when(() => mockLocal.getCachedAllocations())
            .thenAnswer((_) async => mockAllocations);

        // Act
        final result = await repository.getMyAllocations();

        // Assert
        expect(result, equals(mockAllocations));
        verifyNever(() => mockRemote.getMyAllocations());
      });
    });

    group('confirmItem', () {
      test('should confirm online and return result', () async {
        // Arrange
        final mockResult = ConfirmationResult(
          itemId: 'item-1',
          status: DistributionItemStatus.collected,
          confirmedAt: DateTime.now(),
          fromCache: false,
        );

        when(() => mockConnectivity.checkConnectivity())
            .thenAnswer((_) async => ConnectivityResult.wifi);
        when(() => mockRemote.confirmItem(
              itemId: any(named: 'itemId'),
              idempotencyKey: any(named: 'idempotencyKey'),
            )).thenAnswer((_) async => mockResult);

        // Act
        final result = await repository.confirmItem('item-1');

        // Assert
        expect(result.status, equals(DistributionItemStatus.collected));
        expect(result.fromCache, isFalse);
      });

      test('should queue confirmation when offline', () async {
        // Arrange
        when(() => mockConnectivity.checkConnectivity())
            .thenAnswer((_) async => ConnectivityResult.none);
        when(() => mockLocal.queueConfirmation(
              itemId: any(named: 'itemId'),
              status: any(named: 'status'),
              idempotencyKey: any(named: 'idempotencyKey'),
            )).thenAnswer((_) async => 'queue-id-1');

        // Act
        final result = await repository.confirmItem('item-1');

        // Assert
        expect(result.status, equals(DistributionItemStatus.collected));
        expect(result.fromCache, isTrue);
        verify(() => mockLocal.queueConfirmation(
              itemId: 'item-1',
              status: 'COLLECTED',
              idempotencyKey: any(named: 'idempotencyKey'),
            )).called(1);
      });

      test('should queue confirmation on remote error', () async {
        // Arrange
        when(() => mockConnectivity.checkConnectivity())
            .thenAnswer((_) async => ConnectivityResult.wifi);
        when(() => mockRemote.confirmItem(
              itemId: any(named: 'itemId'),
              idempotencyKey: any(named: 'idempotencyKey'),
            )).thenThrow(Exception('Network error'));
        when(() => mockLocal.queueConfirmation(
              itemId: any(named: 'itemId'),
              status: any(named: 'status'),
              idempotencyKey: any(named: 'idempotencyKey'),
            )).thenAnswer((_) async => 'queue-id-1');

        // Act
        final result = await repository.confirmItem('item-1');

        // Assert
        expect(result.fromCache, isTrue);
      });
    });

    group('syncPendingConfirmations', () {
      test('should sync all pending confirmations', () async {
        // Arrange
        final pendingConfirmations = [
          PendingConfirmationData(
            id: '1',
            itemId: 'item-1',
            idempotencyKey: 'key-1',
            status: 'COLLECTED',
          ),
          PendingConfirmationData(
            id: '2',
            itemId: 'item-2',
            idempotencyKey: 'key-2',
            status: 'COLLECTED',
          ),
        ];

        when(() => mockConnectivity.checkConnectivity())
            .thenAnswer((_) async => ConnectivityResult.wifi);
        when(() => mockLocal.getUnsynced())
            .thenAnswer((_) async => pendingConfirmations);
        when(() => mockRemote.confirmItem(
              itemId: any(named: 'itemId'),
              idempotencyKey: any(named: 'idempotencyKey'),
            )).thenAnswer((_) async => ConfirmationResult(
              itemId: 'item-1',
              status: DistributionItemStatus.collected,
              confirmedAt: DateTime.now(),
              fromCache: false,
            ));
        when(() => mockLocal.markSynced(any())).thenAnswer((_) async {});
        when(() => mockLocal.cleanupSynced()).thenAnswer((_) async {});

        // Act
        final syncedCount = await repository.syncPendingConfirmations();

        // Assert
        expect(syncedCount, equals(2));
        verify(() => mockLocal.markSynced('1')).called(1);
        verify(() => mockLocal.markSynced('2')).called(1);
      });

      test('should return 0 when offline', () async {
        // Arrange
        when(() => mockConnectivity.checkConnectivity())
            .thenAnswer((_) async => ConnectivityResult.none);

        // Act
        final syncedCount = await repository.syncPendingConfirmations();

        // Assert
        expect(syncedCount, equals(0));
        verifyNever(() => mockLocal.getUnsynced());
      });

      test('should continue syncing after individual failures', () async {
        // Arrange
        final pendingConfirmations = [
          PendingConfirmationData(
            id: '1',
            itemId: 'item-1',
            idempotencyKey: 'key-1',
            status: 'COLLECTED',
          ),
          PendingConfirmationData(
            id: '2',
            itemId: 'item-2',
            idempotencyKey: 'key-2',
            status: 'COLLECTED',
          ),
        ];

        when(() => mockConnectivity.checkConnectivity())
            .thenAnswer((_) async => ConnectivityResult.wifi);
        when(() => mockLocal.getUnsynced())
            .thenAnswer((_) async => pendingConfirmations);

        // First call fails, second succeeds
        var callCount = 0;
        when(() => mockRemote.confirmItem(
              itemId: any(named: 'itemId'),
              idempotencyKey: any(named: 'idempotencyKey'),
            )).thenAnswer((_) async {
          callCount++;
          if (callCount == 1) {
            throw Exception('Temporary error');
          }
          return ConfirmationResult(
            itemId: 'item-2',
            status: DistributionItemStatus.collected,
            confirmedAt: DateTime.now(),
            fromCache: false,
          );
        });

        when(() => mockLocal.updateRetryInfo(any(), errorMessage: any(named: 'errorMessage')))
            .thenAnswer((_) async {});
        when(() => mockLocal.markSynced(any())).thenAnswer((_) async {});
        when(() => mockLocal.cleanupSynced()).thenAnswer((_) async {});

        // Act
        final syncedCount = await repository.syncPendingConfirmations();

        // Assert
        expect(syncedCount, equals(1)); // Only one succeeded
        verify(() => mockLocal.updateRetryInfo('1', errorMessage: any(named: 'errorMessage')))
            .called(1);
        verify(() => mockLocal.markSynced('2')).called(1);
      });
    });
  });
}

// Helper class for test data
class PendingConfirmationData {
  final String id;
  final String itemId;
  final String idempotencyKey;
  final String status;

  PendingConfirmationData({
    required this.id,
    required this.itemId,
    required this.idempotencyKey,
    required this.status,
  });
}
