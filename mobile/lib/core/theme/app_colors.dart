import 'package:flutter/material.dart';

class AppColors {
  // Primary brand colors
  static const Color primary = Color(0xFF1E88E5);
  static const Color primaryLight = Color(0xFF6AB7FF);
  static const Color primaryDark = Color(0xFF005CB2);

  // Stokvel type colors
  static const Color savings = Color(0xFF4CAF50);     // Green
  static const Color grocery = Color(0xFFFF9800);      // Orange
  static const Color burial = Color(0xFF9C27B0);       // Purple
  static const Color rosca = Color(0xFF00BCD4);        // Cyan

  // Status colors
  static const Color success = Color(0xFF4CAF50);
  static const Color warning = Color(0xFFFFC107);
  static const Color error = Color(0xFFF44336);
  static const Color info = Color(0xFF2196F3);

  // Neutral colors
  static const Color textPrimary = Color(0xFF212121);
  static const Color textSecondary = Color(0xFF757575);
  static const Color divider = Color(0xFFBDBDBD);
  static const Color background = Color(0xFFF5F5F5);
  static const Color surface = Color(0xFFFFFFFF);

  // Get color for stokvel type
  static Color forStokvelType(String type) {
    switch (type.toUpperCase()) {
      case 'SAVINGS':
        return savings;
      case 'GROCERY':
        return grocery;
      case 'BURIAL':
        return burial;
      case 'ROSCA':
        return rosca;
      default:
        return primary;
    }
  }
}
