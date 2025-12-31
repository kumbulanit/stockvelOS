import 'package:flutter/material.dart';

class StokvelListScreen extends StatelessWidget {
  const StokvelListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Stokvels'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Placeholder stokvel list items
          _buildStokvelItem(context, 'Family Savings', 'SAVINGS', 12),
          _buildStokvelItem(context, 'Church Burial Society', 'BURIAL', 45),
          _buildStokvelItem(context, 'Street Grocery Club', 'GROCERY', 8),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          // TODO: Create or join stokvel
        },
        icon: const Icon(Icons.add),
        label: const Text('Join Stokvel'),
      ),
    );
  }

  Widget _buildStokvelItem(
    BuildContext context,
    String name,
    String type,
    int memberCount,
  ) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        leading: CircleAvatar(
          backgroundColor: _getTypeColor(type).withOpacity(0.1),
          child: Icon(
            _getTypeIcon(type),
            color: _getTypeColor(type),
          ),
        ),
        title: Text(
          name,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text('$memberCount members • $type'),
        trailing: const Icon(Icons.chevron_right),
        onTap: () {
          // TODO: Navigate to stokvel detail
        },
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

  IconData _getTypeIcon(String type) {
    switch (type) {
      case 'SAVINGS':
        return Icons.savings;
      case 'GROCERY':
        return Icons.shopping_cart;
      case 'BURIAL':
        return Icons.favorite;
      case 'ROSCA':
        return Icons.sync;
      default:
        return Icons.group;
    }
  }
}
