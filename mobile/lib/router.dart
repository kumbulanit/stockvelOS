import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

// Screens
import 'features/auth/presentation/screens/login_screen.dart';
import 'features/auth/presentation/screens/register_screen.dart';
import 'features/auth/presentation/screens/biometric_screen.dart';
import 'features/home/presentation/screens/home_screen.dart';
import 'features/stokvels/presentation/screens/stokvel_list_screen.dart';
import 'features/stokvels/presentation/screens/stokvel_detail_screen.dart';
import 'features/contributions/presentation/screens/submit_contribution_screen.dart';
import 'features/ledger/presentation/screens/ledger_screen.dart';

import 'core/providers/auth_provider.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authNotifierProvider);

  return GoRouter(
    initialLocation: '/login',
    debugLogDiagnostics: true,
    redirect: (context, state) {
      final isAuth = authState.status == AuthStatus.authenticated;
      final isAuthRoute = state.matchedLocation == '/login' || 
                          state.matchedLocation == '/register';

      if (!isAuth && !isAuthRoute) {
        return '/login';
      }

      if (isAuth && isAuthRoute) {
        return '/';
      }

      return null;
    },
    routes: [
      // Auth routes
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        name: 'register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/biometric',
        name: 'biometric',
        builder: (context, state) => const BiometricScreen(),
      ),

      // Main app routes (with shell for bottom nav)
      ShellRoute(
        builder: (context, state, child) {
          return MainShell(child: child);
        },
        routes: [
          GoRoute(
            path: '/',
            name: 'home',
            builder: (context, state) => const HomeScreen(),
          ),
          GoRoute(
            path: '/stokvels',
            name: 'stokvels',
            builder: (context, state) => const StokvelListScreen(),
            routes: [
              GoRoute(
                path: ':id',
                name: 'stokvel-detail',
                builder: (context, state) {
                  final id = state.pathParameters['id']!;
                  return StokvelDetailScreen(stokvelId: id);
                },
                routes: [
                  GoRoute(
                    path: 'contribute',
                    name: 'contribute',
                    builder: (context, state) {
                      final id = state.pathParameters['id']!;
                      return SubmitContributionScreen(stokvelId: id);
                    },
                  ),
                  GoRoute(
                    path: 'ledger',
                    name: 'ledger',
                    builder: (context, state) {
                      final id = state.pathParameters['id']!;
                      return LedgerScreen(stokvelId: id);
                    },
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
});

class MainShell extends StatelessWidget {
  final Widget child;

  const MainShell({super.key, required this.child});

  int _calculateSelectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/stokvels')) return 1;
    if (location == '/notifications') return 2;
    if (location == '/profile') return 3;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final selectedIndex = _calculateSelectedIndex(context);

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.groups_outlined),
            selectedIcon: Icon(Icons.groups),
            label: 'Stokvels',
          ),
          NavigationDestination(
            icon: Icon(Icons.notifications_outlined),
            selectedIcon: Icon(Icons.notifications),
            label: 'Alerts',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
        onDestinationSelected: (index) {
          switch (index) {
            case 0:
              context.go('/');
              break;
            case 1:
              context.go('/stokvels');
              break;
            case 2:
              context.go('/notifications');
              break;
            case 3:
              context.go('/profile');
              break;
          }
        },
      ),
    );
  }
}
