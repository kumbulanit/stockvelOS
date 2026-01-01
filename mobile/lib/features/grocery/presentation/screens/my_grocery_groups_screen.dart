import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/grocery_providers.dart';
import '../data/models/grocery_models.dart';

/// Screen showing all grocery groups the user belongs to
class MyGroceryGroupsScreen extends ConsumerWidget {
  const MyGroceryGroupsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(groceryGroupsProvider);
    final pendingSync = ref.watch(pendingSyncCountProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Grocery Groups'),
        actions: [
          // Pending sync indicator
          pendingSync.when(
            data: (count) => count > 0
                ? IconButton(
                    onPressed: () => _showSyncDialog(context, ref),
                    icon: Badge(
                      label: Text('$count'),
                      child: const Icon(Icons.sync),
                    ),
                  )
                : const SizedBox.shrink(),
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(groceryGroupsProvider.notifier).refresh(),
        child: state.isLoading
            ? const Center(child: CircularProgressIndicator())
            : state.error != null
                ? _buildError(context, state.error!)
                : state.groups.isEmpty
                    ? _buildEmpty(context)
                    : _buildGroupsList(context, ref, state.groups),
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
          Text(
            'Error loading groups',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              error,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmpty(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.shopping_basket_outlined,
            size: 80,
            color: Colors.grey[400],
          ),
          const SizedBox(height: 16),
          Text(
            'No Grocery Groups',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            'You haven\'t joined any grocery groups yet',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey[600],
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildGroupsList(
    BuildContext context,
    WidgetRef ref,
    List<GroceryGroup> groups,
  ) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: groups.length,
      itemBuilder: (context, index) {
        final group = groups[index];
        return _GroceryGroupCard(group: group);
      },
    );
  }

  void _showSyncDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Pending Confirmations'),
        content: const Text(
          'You have confirmations that haven\'t been synced to the server yet. '
          'Would you like to sync them now?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Later'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(context);
              ref.read(syncProvider.notifier).syncPending();
            },
            child: const Text('Sync Now'),
          ),
        ],
      ),
    );
  }
}

class _GroceryGroupCard extends StatelessWidget {
  final GroceryGroup group;

  const _GroceryGroupCard({required this.group});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasPending = group.pendingAllocations > 0;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => context.push('/grocery/${group.groupId}'),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.primaryContainer,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.shopping_basket,
                      color: theme.colorScheme.onPrimaryContainer,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          group.groupName,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          '${group.totalDistributions} distributions',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (hasPending)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.orange[100],
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '${group.pendingAllocations} pending',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: Colors.orange[900],
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                ],
              ),
              if (group.nextDistributionDate != null) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    Icon(
                      Icons.calendar_today,
                      size: 16,
                      color: Colors.grey[600],
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Next: ${_formatDate(group.nextDistributionDate!)}',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = date.difference(now).inDays;

    if (diff == 0) return 'Today';
    if (diff == 1) return 'Tomorrow';
    if (diff < 7) return 'In $diff days';

    return '${date.day}/${date.month}/${date.year}';
  }
}
