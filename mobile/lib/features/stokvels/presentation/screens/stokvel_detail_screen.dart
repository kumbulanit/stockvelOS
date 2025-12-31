import 'package:flutter/material.dart';

class StokvelDetailScreen extends StatelessWidget {
  final String stokvelId;

  const StokvelDetailScreen({super.key, required this.stokvelId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Family Savings'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () {
              // TODO: Stokvel settings
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Balance card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    Text(
                      'Total Balance',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.grey,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'R 12,500.00',
                      style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        _buildStatItem(context, 'Members', '12'),
                        _buildStatItem(context, 'This Month', 'R 3,000'),
                        _buildStatItem(context, 'My Share', 'R 1,041'),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Quick actions
            Text(
              'Quick Actions',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildActionButton(
                    context,
                    icon: Icons.add_circle,
                    label: 'Contribute',
                    onTap: () {
                      // TODO: Navigate to contribute
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildActionButton(
                    context,
                    icon: Icons.receipt_long,
                    label: 'Ledger',
                    onTap: () {
                      // TODO: Navigate to ledger
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildActionButton(
                    context,
                    icon: Icons.people,
                    label: 'Members',
                    onTap: () {
                      // TODO: Navigate to members
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Recent transactions
            Text(
              'Recent Transactions',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            _buildTransactionItem(
              context,
              name: 'John Doe',
              type: 'Contribution',
              amount: '+ R 1,000.00',
              isCredit: true,
              date: 'Dec 28, 2024',
            ),
            _buildTransactionItem(
              context,
              name: 'Jane Smith',
              type: 'Contribution',
              amount: '+ R 1,000.00',
              isCredit: true,
              date: 'Dec 27, 2024',
            ),
            _buildTransactionItem(
              context,
              name: 'Admin Fee',
              type: 'Fee',
              amount: '- R 50.00',
              isCredit: false,
              date: 'Dec 1, 2024',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem(BuildContext context, String label, String value) {
    return Column(
      children: [
        Text(
          value,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Colors.grey,
          ),
        ),
      ],
    );
  }

  Widget _buildActionButton(
    BuildContext context, {
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20),
          child: Column(
            children: [
              Icon(icon, size: 28, color: Theme.of(context).colorScheme.primary),
              const SizedBox(height: 8),
              Text(label, style: const TextStyle(fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTransactionItem(
    BuildContext context, {
    required String name,
    required String type,
    required String amount,
    required bool isCredit,
    required String date,
  }) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        backgroundColor: (isCredit ? Colors.green : Colors.red).withOpacity(0.1),
        child: Icon(
          isCredit ? Icons.arrow_downward : Icons.arrow_upward,
          color: isCredit ? Colors.green : Colors.red,
          size: 20,
        ),
      ),
      title: Text(name),
      subtitle: Text('$type • $date'),
      trailing: Text(
        amount,
        style: TextStyle(
          fontWeight: FontWeight.w600,
          color: isCredit ? Colors.green : Colors.red,
        ),
      ),
    );
  }
}
