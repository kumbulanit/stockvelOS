import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/grocery_providers.dart';
import '../data/models/grocery_models.dart';

/// Screen showing member's allocations with confirm receipt functionality
class MyAllocationsScreen extends ConsumerStatefulWidget {
  final String? groupId;

  const MyAllocationsScreen({super.key, this.groupId});

  @override
  ConsumerState<MyAllocationsScreen> createState() =>
      _MyAllocationsScreenState();
}

class _MyAllocationsScreenState extends ConsumerState<MyAllocationsScreen> {
  @override
  Widget build(BuildContext context) {
    final state = widget.groupId != null
        ? ref.watch(allocationsProvider(widget.groupId))
        : ref.watch(myAllocationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Allocations'),
        actions: [
          IconButton(
            onPressed: () => widget.groupId != null
                ? ref.read(allocationsProvider(widget.groupId).notifier).refresh()
                : ref.read(myAllocationsProvider.notifier).refresh(),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => widget.groupId != null
            ? ref.read(allocationsProvider(widget.groupId).notifier).refresh()
            : ref.read(myAllocationsProvider.notifier).refresh(),
        child: state.isLoading
            ? const Center(child: CircularProgressIndicator())
            : state.error != null
                ? _buildError(state.error!)
                : state.allocations.isEmpty
                    ? _buildEmpty()
                    : _buildAllocationsList(state.allocations),
      ),
    );
  }

  Widget _buildError(String error) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 64, color: Colors.red),
          const SizedBox(height: 16),
          Text(
            'Error loading allocations',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(error, textAlign: TextAlign.center),
          ),
        ],
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.inventory_2_outlined, size: 80, color: Colors.grey[400]),
          const SizedBox(height: 16),
          Text(
            'No Allocations',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            'You don\'t have any grocery allocations yet',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey[600],
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildAllocationsList(List<MyAllocation> allocations) {
    // Separate pending and completed
    final pending = allocations.where((a) => a.pendingCount > 0).toList();
    final completed = allocations.where((a) => a.pendingCount == 0).toList();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (pending.isNotEmpty) ...[
          _buildSectionHeader('Pending Collection', pending.length),
          const SizedBox(height: 8),
          ...pending.map((a) => _AllocationCard(
                allocation: a,
                onItemConfirmed: () => _handleItemConfirmed(),
              )),
          const SizedBox(height: 24),
        ],
        if (completed.isNotEmpty) ...[
          _buildSectionHeader('Completed', completed.length),
          const SizedBox(height: 8),
          ...completed.map((a) => _AllocationCard(
                allocation: a,
                onItemConfirmed: () => _handleItemConfirmed(),
              )),
        ],
      ],
    );
  }

  Widget _buildSectionHeader(String title, int count) {
    return Row(
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primaryContainer,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            '$count',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Theme.of(context).colorScheme.onPrimaryContainer,
                  fontWeight: FontWeight.bold,
                ),
          ),
        ),
      ],
    );
  }

  void _handleItemConfirmed() {
    // Refresh allocations after confirmation
    if (widget.groupId != null) {
      ref.read(allocationsProvider(widget.groupId).notifier).refresh();
    } else {
      ref.read(myAllocationsProvider.notifier).refresh();
    }
  }
}

class _AllocationCard extends ConsumerWidget {
  final MyAllocation allocation;
  final VoidCallback onItemConfirmed;

  const _AllocationCard({
    required this.allocation,
    required this.onItemConfirmed,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final progress = allocation.collectionProgress;
    final isPending = allocation.pendingCount > 0;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ExpansionTile(
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: isPending
                ? Colors.orange.withOpacity(0.1)
                : Colors.green.withOpacity(0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            isPending ? Icons.pending_actions : Icons.check_circle,
            color: isPending ? Colors.orange : Colors.green,
          ),
        ),
        title: Text(
          allocation.eventName,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(
              _formatDate(allocation.eventDate),
              style: theme.textTheme.bodySmall?.copyWith(
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 6),
            // Progress bar
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: Colors.grey[200],
                color: isPending ? Colors.orange : Colors.green,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '${allocation.totalCount - allocation.pendingCount} of ${allocation.totalCount} collected',
              style: theme.textTheme.labelSmall?.copyWith(
                color: Colors.grey[600],
              ),
            ),
          ],
        ),
        children: allocation.items
            .map((item) => _AllocationItemTile(
                  item: item,
                  onConfirmed: onItemConfirmed,
                ))
            .toList(),
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }
}

class _AllocationItemTile extends ConsumerWidget {
  final AllocationItem item;
  final VoidCallback onConfirmed;

  const _AllocationItemTile({
    required this.item,
    required this.onConfirmed,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final confirmState = ref.watch(confirmItemProvider);
    final isConfirming = confirmState.isLoading;

    return ListTile(
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: _getStatusColor(item.status).withOpacity(0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          _getStatusIcon(item.status),
          color: _getStatusColor(item.status),
          size: 20,
        ),
      ),
      title: Text(
        item.productName,
        style: theme.textTheme.bodyMedium?.copyWith(
          fontWeight: FontWeight.w500,
        ),
      ),
      subtitle: Text(
        '${item.quantity} ${item.productUnit}',
        style: theme.textTheme.bodySmall?.copyWith(
          color: Colors.grey[600],
        ),
      ),
      trailing: item.isPending
          ? FilledButton.icon(
              onPressed: isConfirming
                  ? null
                  : () => _confirmItem(context, ref),
              icon: isConfirming
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.check, size: 18),
              label: Text(isConfirming ? 'Confirming...' : 'Confirm'),
            )
          : Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: _getStatusColor(item.status).withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                _getStatusText(item.status),
                style: theme.textTheme.labelSmall?.copyWith(
                  color: _getStatusColor(item.status),
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
    );
  }

  Future<void> _confirmItem(BuildContext context, WidgetRef ref) async {
    final success = await ref.read(confirmItemProvider.notifier).confirm(item.itemId);

    if (context.mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${item.productName} confirmed!'),
            backgroundColor: Colors.green,
          ),
        );
        onConfirmed();
      } else {
        final error = ref.read(confirmItemProvider).error;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${error ?? "Failed to confirm"}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Color _getStatusColor(DistributionItemStatus status) {
    switch (status) {
      case DistributionItemStatus.allocated:
        return Colors.orange;
      case DistributionItemStatus.collected:
        return Colors.green;
      case DistributionItemStatus.uncollected:
        return Colors.red;
    }
  }

  IconData _getStatusIcon(DistributionItemStatus status) {
    switch (status) {
      case DistributionItemStatus.allocated:
        return Icons.pending;
      case DistributionItemStatus.collected:
        return Icons.check_circle;
      case DistributionItemStatus.uncollected:
        return Icons.cancel;
    }
  }

  String _getStatusText(DistributionItemStatus status) {
    switch (status) {
      case DistributionItemStatus.allocated:
        return 'Pending';
      case DistributionItemStatus.collected:
        return 'Collected';
      case DistributionItemStatus.uncollected:
        return 'Uncollected';
    }
  }
}
