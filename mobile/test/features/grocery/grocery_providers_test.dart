import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:stockvel_os/features/grocery/data/models/grocery_models.dart';
import 'package:stockvel_os/features/grocery/data/repositories/grocery_repository.dart';
import 'package:stockvel_os/features/grocery/providers/grocery_providers.dart';

// Mock Repository
class MockGroceryRepository extends Mock implements GroceryRepository {}

void main() {
  late MockGroceryRepository mockRepository;
  late ProviderContainer container;

  setUp(() {
    mockRepository = MockGroceryRepository();
    container = ProviderContainer(
      overrides: [
        groceryRepositoryProvider.overrideWithValue(mockRepository),
      ],
    );
  });

  tearDown(() {
    container.dispose();
  });

  group('GroceryGroupsNotifier', () {
    test('should load groups on build', () async {
      // Arrange
      final mockGroups = [
        const GroceryGroup(
          groupId: 'group-1',
          groupName: 'Test Group',
          pendingAllocations: 5,
          totalDistributions: 10,
        ),
      ];
      when(() => mockRepository.getMyGroceryGroups())
          .thenAnswer((_) async => mockGroups);

      // Act
      final notifier = container.read(groceryGroupsProvider.notifier);

      // Wait for initial load
      await Future.delayed(Duration.zero);

      // Assert
      final state = container.read(groceryGroupsProvider);
      expect(state.isLoading, isFalse);
      expect(state.groups, equals(mockGroups));
    });

    test('should handle errors gracefully', () async {
      // Arrange
      when(() => mockRepository.getMyGroceryGroups())
          .thenThrow(Exception('Network error'));

      // Act
      final notifier = container.read(groceryGroupsProvider.notifier);

      // Wait for initial load
      await Future.delayed(Duration.zero);

      // Assert
      final state = container.read(groceryGroupsProvider);
      expect(state.isLoading, isFalse);
      expect(state.error, isNotNull);
      expect(state.groups, isEmpty);
    });

    test('should refresh groups', () async {
      // Arrange
      final mockGroups = [
        const GroceryGroup(
          groupId: 'group-1',
          groupName: 'Test Group',
          pendingAllocations: 5,
          totalDistributions: 10,
        ),
      ];
      when(() => mockRepository.getMyGroceryGroups())
          .thenAnswer((_) async => mockGroups);

      // Act
      final notifier = container.read(groceryGroupsProvider.notifier);
      await Future.delayed(Duration.zero);
      await notifier.refresh();

      // Assert
      verify(() => mockRepository.getMyGroceryGroups()).called(2); // Initial + refresh
    });
  });

  group('AllocationsNotifier', () {
    test('should load allocations for a group', () async {
      // Arrange
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
      when(() => mockRepository.getMyAllocations(groupId: 'group-1'))
          .thenAnswer((_) async => mockAllocations);

      // Act
      final notifier = container.read(allocationsProvider('group-1').notifier);

      // Wait for initial load
      await Future.delayed(Duration.zero);

      // Assert
      final state = container.read(allocationsProvider('group-1'));
      expect(state.isLoading, isFalse);
      expect(state.allocations, equals(mockAllocations));
    });

    test('should handle empty allocations', () async {
      // Arrange
      when(() => mockRepository.getMyAllocations(groupId: 'group-1'))
          .thenAnswer((_) async => []);

      // Act
      final notifier = container.read(allocationsProvider('group-1').notifier);

      // Wait for initial load
      await Future.delayed(Duration.zero);

      // Assert
      final state = container.read(allocationsProvider('group-1'));
      expect(state.isLoading, isFalse);
      expect(state.allocations, isEmpty);
    });
  });

  group('ConfirmItemNotifier', () {
    test('should confirm item successfully', () async {
      // Arrange
      final mockResult = ConfirmationResult(
        itemId: 'item-1',
        status: DistributionItemStatus.collected,
        confirmedAt: DateTime.now(),
        fromCache: false,
      );
      when(() => mockRepository.confirmItem('item-1'))
          .thenAnswer((_) async => mockResult);

      // Act
      final notifier = container.read(confirmItemProvider.notifier);
      await notifier.confirm('item-1');

      // Assert
      final state = container.read(confirmItemProvider);
      expect(state.isLoading, isFalse);
      expect(state.lastResult?.itemId, equals('item-1'));
      expect(state.lastResult?.status, equals(DistributionItemStatus.collected));
    });

    test('should handle offline confirmation', () async {
      // Arrange
      final mockResult = ConfirmationResult(
        itemId: 'item-1',
        status: DistributionItemStatus.collected,
        confirmedAt: DateTime.now(),
        fromCache: true, // Indicates queued offline
      );
      when(() => mockRepository.confirmItem('item-1'))
          .thenAnswer((_) async => mockResult);

      // Act
      final notifier = container.read(confirmItemProvider.notifier);
      await notifier.confirm('item-1');

      // Assert
      final state = container.read(confirmItemProvider);
      expect(state.lastResult?.fromCache, isTrue);
    });

    test('should set error on failure', () async {
      // Arrange
      when(() => mockRepository.confirmItem('item-1'))
          .thenThrow(Exception('Failed to confirm'));

      // Act
      final notifier = container.read(confirmItemProvider.notifier);
      await notifier.confirm('item-1');

      // Assert
      final state = container.read(confirmItemProvider);
      expect(state.isLoading, isFalse);
      expect(state.error, isNotNull);
    });
  });

  group('SyncNotifier', () {
    test('should sync pending confirmations', () async {
      // Arrange
      when(() => mockRepository.syncPendingConfirmations())
          .thenAnswer((_) async => 3);

      // Act
      final notifier = container.read(syncProvider.notifier);
      await notifier.syncNow();

      // Assert
      final state = container.read(syncProvider);
      expect(state.isSyncing, isFalse);
      expect(state.lastSyncedCount, equals(3));
    });

    test('should track syncing state', () async {
      // Arrange
      when(() => mockRepository.syncPendingConfirmations())
          .thenAnswer((_) async {
        await Future.delayed(const Duration(milliseconds: 100));
        return 2;
      });

      // Act
      final notifier = container.read(syncProvider.notifier);
      final syncFuture = notifier.syncNow();

      // Check immediate state
      await Future.delayed(const Duration(milliseconds: 10));
      var state = container.read(syncProvider);
      expect(state.isSyncing, isTrue);

      // Wait for completion
      await syncFuture;
      state = container.read(syncProvider);
      expect(state.isSyncing, isFalse);
    });

    test('should handle sync errors', () async {
      // Arrange
      when(() => mockRepository.syncPendingConfirmations())
          .thenThrow(Exception('Sync failed'));

      // Act
      final notifier = container.read(syncProvider.notifier);
      await notifier.syncNow();

      // Assert
      final state = container.read(syncProvider);
      expect(state.isSyncing, isFalse);
      expect(state.error, isNotNull);
    });
  });

  group('State Classes', () {
    test('GroceryGroupsState equality', () {
      const state1 = GroceryGroupsState(
        groups: [GroceryGroup(groupId: '1', groupName: 'Test', pendingAllocations: 0, totalDistributions: 0)],
        isLoading: false,
      );
      const state2 = GroceryGroupsState(
        groups: [GroceryGroup(groupId: '1', groupName: 'Test', pendingAllocations: 0, totalDistributions: 0)],
        isLoading: false,
      );
      expect(state1, equals(state2));
    });

    test('GroceryGroupsState copyWith', () {
      const state = GroceryGroupsState(groups: [], isLoading: false);
      final newState = state.copyWith(isLoading: true);
      expect(newState.isLoading, isTrue);
      expect(newState.groups, isEmpty);
    });

    test('AllocationsState initial values', () {
      const state = AllocationsState();
      expect(state.allocations, isEmpty);
      expect(state.isLoading, isFalse);
      expect(state.error, isNull);
    });

    test('ConfirmItemState with result', () {
      final result = ConfirmationResult(
        itemId: 'item-1',
        status: DistributionItemStatus.collected,
        confirmedAt: DateTime.now(),
        fromCache: false,
      );
      final state = ConfirmItemState(lastResult: result);
      expect(state.lastResult, equals(result));
      expect(state.isLoading, isFalse);
    });

    test('SyncState tracks last sync time', () {
      final now = DateTime.now();
      final state = SyncState(lastSyncTime: now, lastSyncedCount: 5);
      expect(state.lastSyncTime, equals(now));
      expect(state.lastSyncedCount, equals(5));
    });
  });
}
