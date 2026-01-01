import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/providers/auth_provider.dart';
import '../../../../core/providers/group_provider.dart';
import '../../../../core/providers/contribution_provider.dart';
import '../../../../core/services/connectivity_service.dart';
import '../../../../core/services/offline_sync_service.dart';

class SubmitContributionScreen extends ConsumerStatefulWidget {
  final String stokvelId;

  const SubmitContributionScreen({super.key, required this.stokvelId});

  @override
  ConsumerState<SubmitContributionScreen> createState() => _SubmitContributionScreenState();
}

class _SubmitContributionScreenState extends ConsumerState<SubmitContributionScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _referenceController = TextEditingController();
  String? _selectedPeriod;
  String _selectedPaymentMethod = 'BANK_TRANSFER';

  @override
  void dispose() {
    _amountController.dispose();
    _referenceController.dispose();
    super.dispose();
  }

  List<String> _generatePeriodOptions() {
    final now = DateTime.now();
    final options = <String>[];
    for (int i = 0; i < 3; i++) {
      final date = DateTime(now.year, now.month + i, 1);
      options.add('${date.year}-${date.month.toString().padLeft(2, '0')}');
    }
    return options;
  }

  String _formatPeriod(String period) {
    final parts = period.split('-');
    final months = [
      '', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return '${months[int.parse(parts[1])]} ${parts[0]}';
  }

  Future<void> _submitContribution() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedPeriod == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a contribution period')),
      );
      return;
    }

    // For now, use a placeholder membership ID
    // In a real app, this would come from the group membership
    final membershipId = 'placeholder';

    final success = await ref.read(contributionSubmissionProvider.notifier).submit(
      groupId: widget.stokvelId,
      membershipId: membershipId,
      amount: double.parse(_amountController.text),
      contributionPeriod: _selectedPeriod!,
      paymentMethod: _selectedPaymentMethod,
      externalReference: _referenceController.text.isNotEmpty 
          ? _referenceController.text 
          : null,
    );

    if (success && mounted) {
      // Check if we're offline
      final isOnline = await ref.read(connectivityServiceProvider).isConnected();
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            isOnline 
                ? 'Contribution submitted successfully!' 
                : 'Contribution saved offline. Will sync when online.',
          ),
          backgroundColor: Colors.green,
        ),
      );
      context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final groupAsync = ref.watch(groupProvider(widget.stokvelId));
    final submissionState = ref.watch(contributionSubmissionProvider);
    final connectivityAsync = ref.watch(isConnectedProvider);

    // Show error if any
    ref.listen(contributionSubmissionProvider, (previous, next) {
      if (next.error != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next.error!),
            backgroundColor: Colors.red,
          ),
        );
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Submit Contribution'),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Offline indicator
              connectivityAsync.when(
                data: (isOnline) {
                  if (!isOnline) {
                    return Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.orange.shade100,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.cloud_off, color: Colors.orange.shade700),
                          const SizedBox(width: 8),
                          const Expanded(
                            child: Text(
                              'You\'re offline. Contribution will be queued.',
                              style: TextStyle(fontWeight: FontWeight.w500),
                            ),
                          ),
                        ],
                      ),
                    );
                  }
                  return const SizedBox.shrink();
                },
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
              ),

              // Group info card
              groupAsync.when(
                data: (group) {
                  if (group == null) {
                    return const Card(
                      child: Padding(
                        padding: EdgeInsets.all(16),
                        child: Text('Group not found'),
                      ),
                    );
                  }

                  final contributionAmount = group.savingsRule?.contributionAmount ?? 0;
                  _amountController.text = contributionAmount.toStringAsFixed(2);

                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          CircleAvatar(
                            backgroundColor: Colors.green.withOpacity(0.1),
                            child: const Icon(Icons.savings, color: Colors.green),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  group.name,
                                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                Text(
                                  'Monthly contribution: R ${contributionAmount.toStringAsFixed(2)}',
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: Colors.grey,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
                loading: () => const Card(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                ),
                error: (e, _) => Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text('Error: $e'),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Amount input
              Text(
                'Amount',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _amountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  prefixText: 'R ',
                  hintText: '0.00',
                ),
                style: Theme.of(context).textTheme.headlineSmall,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter an amount';
                  }
                  final amount = double.tryParse(value);
                  if (amount == null || amount <= 0) {
                    return 'Please enter a valid amount';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),

              // Period selection
              Text(
                'Contribution Period',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: _selectedPeriod,
                hint: const Text('Select period'),
                items: _generatePeriodOptions()
                    .map((period) => DropdownMenuItem(
                          value: period,
                          child: Text(_formatPeriod(period)),
                        ))
                    .toList(),
                onChanged: (value) {
                  setState(() {
                    _selectedPeriod = value;
                  });
                },
              ),
              const SizedBox(height: 24),

              // Payment method
              Text(
                'Payment Method',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: _selectedPaymentMethod,
                items: const [
                  DropdownMenuItem(value: 'BANK_TRANSFER', child: Text('Bank Transfer (EFT)')),
                  DropdownMenuItem(value: 'CASH', child: Text('Cash')),
                  DropdownMenuItem(value: 'MOBILE_WALLET', child: Text('Mobile Wallet')),
                ],
                onChanged: (value) {
                  setState(() {
                    _selectedPaymentMethod = value!;
                  });
                },
              ),
              const SizedBox(height: 24),

              // Reference (optional)
              Text(
                'Payment Reference (optional)',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _referenceController,
                decoration: const InputDecoration(
                  hintText: 'Bank reference or transaction ID',
                ),
              ),
              const SizedBox(height: 32),

              // Submit button
              ElevatedButton(
                onPressed: submissionState.isSubmitting ? null : _submitContribution,
                child: submissionState.isSubmitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Submit Contribution'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
