import 'package:flutter/material.dart';

class SubmitContributionScreen extends StatefulWidget {
  final String stokvelId;

  const SubmitContributionScreen({super.key, required this.stokvelId});

  @override
  State<SubmitContributionScreen> createState() => _SubmitContributionScreenState();
}

class _SubmitContributionScreenState extends State<SubmitContributionScreen> {
  final _amountController = TextEditingController();
  String? _selectedPeriod;
  bool _isLoading = false;

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Submit Contribution'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Stokvel info card
            Card(
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
                            'Family Savings',
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            'Monthly contribution: R 1,000.00',
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
              items: const [
                DropdownMenuItem(value: '2024-12', child: Text('December 2024')),
                DropdownMenuItem(value: '2025-01', child: Text('January 2025')),
                DropdownMenuItem(value: '2025-02', child: Text('February 2025')),
              ],
              onChanged: (value) {
                setState(() {
                  _selectedPeriod = value;
                });
              },
            ),
            const SizedBox(height: 24),

            // POP upload
            Text(
              'Proof of Payment',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () {
                // TODO: Open file picker
              },
              icon: const Icon(Icons.upload_file),
              label: const Text('Upload POP'),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Upload a screenshot or photo of your payment confirmation',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.grey,
              ),
            ),
            const SizedBox(height: 32),

            // Submit button
            ElevatedButton(
              onPressed: _isLoading ? null : _submitContribution,
              child: _isLoading
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
    );
  }

  void _submitContribution() {
    // TODO: Implement submission
    setState(() {
      _isLoading = true;
    });

    // Simulate API call
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        // Show success and navigate back
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Contribution submitted successfully!'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context);
      }
    });
  }
}
