import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Home'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {
              // TODO: Navigate to notifications
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          // TODO: Refresh data
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Welcome message
              Text(
                'Welcome back!',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 24),

              // Summary cards
              Text(
                'Your Stokvels',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 12),

              // Placeholder cards for each stokvel type
              _buildStokvelSummaryCard(
                context,
                title: 'Family Savings',
                type: 'SAVINGS',
                balance: 'R 12,500.00',
                nextAction: 'Contribution due in 5 days',
              ),
              const SizedBox(height: 12),
              _buildStokvelSummaryCard(
                context,
                title: 'Church Burial Society',
                type: 'BURIAL',
                balance: 'R 8,200.00',
                nextAction: 'No pending claims',
              ),
              const SizedBox(height: 24),

              // Recent activity
              Text(
                'Recent Activity',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 12),

              // Placeholder activity items
              _buildActivityItem(
                context,
                icon: Icons.arrow_upward,
                iconColor: Colors.green,
                title: 'Contribution submitted',
                subtitle: 'Family Savings • R 1,000.00',
                time: '2 hours ago',
              ),
              _buildActivityItem(
                context,
                icon: Icons.check_circle,
                iconColor: Colors.blue,
                title: 'POP approved',
                subtitle: 'Family Savings • December 2024',
                time: 'Yesterday',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStokvelSummaryCard(
    BuildContext context, {
    required String title,
    required String type,
    required String balance,
    required String nextAction,
  }) {
    return Card(
      child: InkWell(
        onTap: () {
          // TODO: Navigate to stokvel detail
        },
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: _getTypeColor(type).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      type,
                      style: TextStyle(
                        color: _getTypeColor(type),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const Spacer(),
                  const Icon(Icons.chevron_right),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                title,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                balance,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                nextAction,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.grey,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActivityItem(
    BuildContext context, {
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required String time,
  }) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        backgroundColor: iconColor.withOpacity(0.1),
        child: Icon(icon, color: iconColor, size: 20),
      ),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: Text(
        time,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: Colors.grey,
        ),
      ),
    );
  }

  Color _getTypeColor(String type) {
    switch (type) {
      case 'SAVINGS':
        return Colors.green;
      case 'GROCERY':
        return Colors.orange;
      case 'BURIAL':
        return Colors.purple;
      case 'ROSCA':
        return Colors.cyan;
      default:
        return Colors.blue;
    }
  }
}
