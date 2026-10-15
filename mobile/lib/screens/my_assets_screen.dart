import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../widgets/status_chip.dart';
import 'asset_detail_screen.dart';

/// Personal custody screen: assets currently assigned to the signed-in employee.
class MyAssetsScreen extends StatefulWidget {
  const MyAssetsScreen({super.key});

  @override
  State<MyAssetsScreen> createState() => MyAssetsScreenState();
}

class MyAssetsScreenState extends State<MyAssetsScreen> {
  late Future<List<Asset>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Asset>> _load() async {
    final data = await context.read<ApiClient>().get('/custody/me') as Map<String, dynamic>;
    return (data['assets'] as List).map((e) => Asset.fromJson(e as Map<String, dynamic>)).toList();
  }

  void reload() => setState(() => _future = _load());

  IconData _iconFor(String category) => switch (category) {
        'Laptop' => Icons.laptop_mac,
        'Desktop' => Icons.desktop_windows,
        'Monitor' => Icons.monitor,
        'Phone' => Icons.smartphone,
        'Tablet' => Icons.tablet_mac,
        'Printer' => Icons.print,
        'Server' => Icons.dns,
        'Network' => Icons.router,
        _ => Icons.devices_other,
      };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Assets')),
      body: RefreshIndicator(
        onRefresh: () async {
          reload();
          await _future;
        },
        child: FutureBuilder<List<Asset>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ListView(children: [
                const SizedBox(height: 120),
                Center(child: Text(snap.error.toString(), textAlign: TextAlign.center)),
                TextButton(onPressed: reload, child: const Text('Retry')),
              ]);
            }
            final assets = snap.data!;
            if (assets.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 120),
                Icon(Icons.inventory_2_outlined, size: 48, color: Colors.black38),
                SizedBox(height: 12),
                Center(child: Text('No assets are assigned to you.')),
              ]);
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: assets.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, i) {
                final a = assets[i];
                return Card(
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    leading: CircleAvatar(child: Icon(_iconFor(a.category))),
                    title: Text(a.title, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text('${a.assetTag} · S/N ${a.serialNumber}'),
                    trailing: StatusChip(a.status),
                    onTap: () async {
                      await Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => AssetDetailScreen(assetId: a.id)),
                      );
                      reload();
                    },
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
