import 'package:flutter/material.dart';

import 'my_assets_screen.dart';
import 'profile_screen.dart';
import 'scanner_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _index = 0;
  final _myAssetsKey = GlobalKey<MyAssetsScreenState>();

  @override
  Widget build(BuildContext context) {
    final pages = [
      MyAssetsScreen(key: _myAssetsKey),
      // Only build the camera view while its tab is visible
      _index == 1 ? const ScannerScreen() : const SizedBox.shrink(),
      const ProfileScreen(),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) {
          setState(() => _index = i);
          if (i == 0) _myAssetsKey.currentState?.reload();
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.devices_outlined), selectedIcon: Icon(Icons.devices), label: 'My Assets'),
          NavigationDestination(icon: Icon(Icons.qr_code_scanner), label: 'Scan'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}
