import 'package:flutter/material.dart';

class LedgerScreen extends StatelessWidget {
  final String stokvelId;

  const LedgerScreen({super.key, required this.stokvelId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ledger'),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () {
              // TODO: Show filter options
            },
          ),
          IconButton(
            icon: const Icon(Icons.download),
            onPressed: () {
              // TODO: Export ledger
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Summary header
          Container(
            padding: const EdgeInsets.all(16),
            color: Theme.of(context).colorScheme.primaryContainer,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildSummaryItem(context, 'Total In', 'R 15,000.00', Colors.green),
                _buildSummaryItem(context, 'Total Out', 'R 2,500.00', Colors.red),
                _buildSummaryItem(context, 'Balance', 'R 12,500.00', Colors.blue),
              ],
            ),
          ),

          // Ledger entries
          Expanded(
            child: ListView.builder(
              itemCount: 20,
              itemBuilder: (context, index) {
                final isCredit = index % 3 != 2;
                return _buildLedgerEntry(
                  context,
                  date: 'Dec ${28 - index}, 2024',
                  description: isCredit
                      ? 'Contribution - Member ${index + 1}'
                      : 'Admin Fee',
                  amount: isCredit ? 'R 1,000.00' : 'R 50.00',
                  isCredit: isCredit,
                  balance: 'R ${12500 - (index * 50)}.00',
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryItem(
    BuildContext context,
    String label,
    String value,
    Color color,
  ) {
    return Column(
      children: [
        Text(
          value,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }

  Widget _buildLedgerEntry(
    BuildContext context, {
    required String date,
    required String description,
    required String amount,
    required bool isCredit,
    required String balance,
  }) {
    return Container(
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: Colors.grey.shade200,
          ),
        ),
      ),
      child: ListTile(
        title: Text(description),
        subtitle: Text(date),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              '${isCredit ? '+' : '-'} $amount',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: isCredit ? Colors.green : Colors.red,
              ),
            ),
            Text(
              'Bal: $balance',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.grey,
              ),
            ),
          ],
        ),
        onTap: () {
          // TODO: Show entry details
        },
      ),
    );
  }
}
