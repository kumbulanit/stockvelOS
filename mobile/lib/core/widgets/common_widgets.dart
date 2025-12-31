import 'package:flutter/material.dart';

/// Shows a loading overlay on the screen
class LoadingOverlay extends StatelessWidget {
  final String? message;

  const LoadingOverlay({super.key, this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black54,
      child: Center(
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircularProgressIndicator(),
                if (message != null) ...[
                  const SizedBox(height: 16),
                  Text(message!),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Shows error state with retry option
class ErrorCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  const ErrorCard({
    super.key,
    this.icon = Icons.error_outline,
    required this.title,
    required this.message,
    this.action,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 64,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: 16),
            Text(
              title,
              style: Theme.of(context).textTheme.headlineSmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: Theme.of(context).textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
            if (action != null) ...[
              const SizedBox(height: 24),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

/// Shows offline indicator banner
class OfflineIndicator extends StatelessWidget {
  const OfflineIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: Colors.orange,
      child: Row(
        children: [
          const Icon(Icons.cloud_off, color: Colors.white, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'You\'re offline. Changes will sync when connected.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Currency input field with ZAR prefix
class CurrencyInputField extends StatelessWidget {
  final TextEditingController controller;
  final String? labelText;
  final String? errorText;
  final ValueChanged<String>? onChanged;

  const CurrencyInputField({
    super.key,
    required this.controller,
    this.labelText,
    this.errorText,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      decoration: InputDecoration(
        labelText: labelText ?? 'Amount',
        prefixText: 'R ',
        errorText: errorText,
      ),
      onChanged: onChanged,
    );
  }
}
