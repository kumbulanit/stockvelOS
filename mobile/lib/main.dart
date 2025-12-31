import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize services
  // await Firebase.initializeApp();
  // await initializeLocalDatabase();
  
  runApp(
    const ProviderScope(
      child: StokvelOSApp(),
    ),
  );
}
