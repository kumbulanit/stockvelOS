import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/grocery_providers.dart';
import '../data/models/grocery_models.dart';
import 'my_allocations_screen.dart';

/// Main grocery group screen with tabs
class GroceryGroupScreen extends ConsumerStatefulWidget {
  final String groupId;

  const GroceryGroupScreen({super.key, required this.groupId});

  @override
  ConsumerState<GroceryGroupScreen> createState() => _GroceryGroupScreenState();
}

class _GroceryGroupScreenState extends ConsumerState<GroceryGroupScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Grocery Group'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'My Items', icon: Icon(Icons.inventory_2)),
            Tab(text: 'Stock', icon: Icon(Icons.warehouse)),
            Tab(text: 'History', icon: Icon(Icons.history)),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          MyAllocationsScreen(groupId: widget.groupId),
          _StockTab(groupId: widget.groupId),
          _HistoryTab(groupId: widget.groupId),
        ],
      ),
    );
  }
}

/// Stock tab showing current inventory
class _StockTab extends ConsumerWidget {
  final String groupId;

  const _StockTab({required this.groupId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Create a provider for group stock
    final stockFuture = ref.watch(_groupStockProvider(groupId));

    return stockFuture.when(
      data: (stock) => stock.isEmpty
          ? _buildEmpty(context)
          : _buildStockList(context, stock),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _buildError(context, error.toString()),
    );
  }

  Widget _buildEmpty(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.inventory_2_outlined, size: 80, color: Colors.grey[400]),
          const SizedBox(height: 16),
          Text(
            'No Stock Available',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            'The group hasn\'t purchased any groceries yet',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey[600],
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildError(BuildContext context, String error) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 64, color: Colors.red),
          const SizedBox(height: 16),
          Text('Error: $error'),
        ],
      ),
    );
  }

  Widget _buildStockList(BuildContext context, List<StockItem> stock) {
    // Group by category
    final categories = <String, List<StockItem>>{};
    for (final item in stock) {
      categories.putIfAbsent(item.category, () => []).add(item);
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: categories.length,
      itemBuilder: (context, index) {
        final category = categories.keys.elementAt(index);
        final items = categories[category]!;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                _formatCategory(category),
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: Colors.grey[600],
                      fontWeight: FontWeight.bold,
                    ),
              ),
            ),
            ...items.map((item) => _StockItemCard(item: item)),
            const SizedBox(height: 16),
          ],
        );
      },
    );
  }

  String _formatCategory(String category) {
    return category[0] + category.substring(1).toLowerCase();
  }
}

class _StockItemCard extends StatelessWidget {
  final StockItem item;

  const _StockItemCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isLow = item.isLowStock;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      color: isLow ? Colors.orange.withOpacity(0.05) : null,
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: isLow
                ? Colors.orange.withOpacity(0.1)
                : theme.colorScheme.primaryContainer,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            Icons.inventory,
            color: isLow
                ? Colors.orange
                : theme.colorScheme.onPrimaryContainer,
            size: 20,
          ),
        ),
        title: Text(
          item.productName,
          style: theme.textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w500,
          ),
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '${item.currentQuantity.toStringAsFixed(1)} ${item.productUnit}',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: isLow ? Colors.orange : null,
              ),
            ),
            if (isLow) ...[
              const SizedBox(width: 8),
              const Icon(Icons.warning, color: Colors.orange, size: 20),
            ],
          ],
        ),
      ),
    );
  }
}

/// History tab showing past distributions
class _HistoryTab extends ConsumerWidget {
  final String groupId;

  const _HistoryTab({required this.groupId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyFuture = ref.watch(_historyProvider(groupId));

    return historyFuture.when(
      data: (history) => history.isEmpty
          ? _buildEmpty(context)
          : _buildHistoryList(context, history),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(child: Text('Error: $error')),
    );
  }

  Widget _buildEmpty(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.history, size: 80, color: Colors.grey[400]),
          const SizedBox(height: 16),
          Text(
            'No History Yet',
            style: Theme.of(context).textTheme.titleLarge,
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryList(BuildContext context, List<GroceryDistribution> history) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: history.length,
      itemBuilder: (context, index) {
        final distribution = history[index];
        return _HistoryCard(distribution: distribution);
      },
    );
  }
}

class _HistoryCard extends StatelessWidget {
  final GroceryDistribution distribution;

  const _HistoryCard({required this.distribution});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: _getStatusColor(distribution.status).withOpacity(0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            _getStatusIcon(distribution.status),
            color: _getStatusColor(distribution.status),
          ),
        ),
        title: Text(
          distribution.eventName,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        subtitle: Text(
          '${distribution.eventDate.day}/${distribution.eventDate.month}/${distribution.eventDate.year}',
          style: theme.textTheme.bodySmall?.copyWith(
            color: Colors.grey[600],
          ),
        ),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: _getStatusColor(distribution.status).withOpacity(0.1),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            distribution.status.name,
            style: theme.textTheme.labelSmall?.copyWith(
              color: _getStatusColor(distribution.status),
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
    );
  }

  Color _getStatusColor(DistributionStatus status) {
    switch (status) {
      case DistributionStatus.draft:
        return Colors.grey;
      case DistributionStatus.confirmed:
        return Colors.blue;
      case DistributionStatus.distributed:
        return Colors.green;
      case DistributionStatus.cancelled:
        return Colors.red;
    }
  }

  IconData _getStatusIcon(DistributionStatus status) {
    switch (status) {
      case DistributionStatus.draft:
        return Icons.edit;
      case DistributionStatus.confirmed:
        return Icons.pending_actions;
      case DistributionStatus.distributed:
        return Icons.check_circle;
      case DistributionStatus.cancelled:
        return Icons.cancel;
    }
  }
}

// Providers for this screen
final _groupStockProvider =
    FutureProvider.family<List<StockItem>, String>((ref, groupId) async {
  final repository = ref.watch(groceryRepositoryProvider);
  return repository.getGroupStock(groupId);
});

final _historyProvider =
    FutureProvider.family<List<GroceryDistribution>, String>((ref, groupId) async {
  final repository = ref.watch(groceryRepositoryProvider);
  return repository.getDistributions(groupId, status: 'DISTRIBUTED');
});
