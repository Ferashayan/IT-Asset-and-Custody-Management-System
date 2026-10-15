import 'package:flutter/material.dart';

class StatusChip extends StatelessWidget {
  final String status;
  const StatusChip(this.status, {super.key});

  static const _labels = {'ACTIVE': 'Active', 'FAULTY': 'Faulty', 'IN_STOCK': 'In Stock'};

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg, IconData icon) = switch (status) {
      'ACTIVE' => (const Color(0xFFECFDF5), const Color(0xFF047857), Icons.check_circle),
      'FAULTY' => (const Color(0xFFFEF2F2), const Color(0xFFB91C1C), Icons.error),
      _ => (const Color(0xFFF0F9FF), const Color(0xFF0369A1), Icons.inventory_2),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 13, color: fg),
        const SizedBox(width: 4),
        Text(_labels[status] ?? status, style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w600)),
      ]),
    );
  }
}
