import 'package:flutter/material.dart';

class BiometricScreen extends StatelessWidget {
  const BiometricScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Icon(
                Icons.fingerprint,
                size: 100,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(height: 32),
              Text(
                'Verify Your Identity',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Text(
                'Use your fingerprint or Face ID to securely access your account',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),
              ElevatedButton.icon(
                onPressed: () {
                  // TODO: Trigger biometric auth
                },
                icon: const Icon(Icons.fingerprint),
                label: const Text('Authenticate'),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () {
                  // TODO: Navigate to PIN entry
                },
                child: const Text('Use PIN instead'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
