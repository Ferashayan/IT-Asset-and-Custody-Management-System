import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../services/auth_service.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final user = auth.user!;
    final initials = user.fullName.split(' ').where((p) => p.isNotEmpty).take(2).map((p) => p[0]).join();

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(children: [
                CircleAvatar(radius: 36, child: Text(initials, style: const TextStyle(fontSize: 24))),
                const SizedBox(height: 12),
                Text(user.fullName, style: Theme.of(context).textTheme.titleLarge),
                Text('@${user.username}', style: const TextStyle(color: Colors.black54)),
                const SizedBox(height: 8),
                Chip(label: Text(user.role)),
              ]),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Column(children: [
              ListTile(leading: const Icon(Icons.email_outlined), title: Text(user.email ?? '—'), subtitle: const Text('Email')),
              ListTile(
                leading: const Icon(Icons.apartment),
                title: Text(user.departmentName ?? '—'),
                subtitle: const Text('Department'),
              ),
              const ListTile(leading: Icon(Icons.cloud_outlined), title: Text(apiBaseUrl), subtitle: Text('Server')),
            ]),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () => auth.logout(),
            icon: const Icon(Icons.logout),
            label: const Text('Sign out'),
            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          ),
        ],
      ),
    );
  }
}
