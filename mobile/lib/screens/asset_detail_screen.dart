import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';
import '../widgets/status_chip.dart';

/// Shows asset details (warranty, purchase date, current holder) and the
/// field operations: Handover to staff, Receive back, Report fault.
class AssetDetailScreen extends StatefulWidget {
  final int? assetId;
  final String? assetTag;

  const AssetDetailScreen({super.key, this.assetId, this.assetTag})
      : assert(assetId != null || assetTag != null);

  @override
  State<AssetDetailScreen> createState() => _AssetDetailScreenState();
}

class _AssetDetailScreenState extends State<AssetDetailScreen> {
  Asset? _asset;
  String? _error;
  bool _loading = true;
  bool _busy = false;

  ApiClient get _api => context.read<ApiClient>();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final path = widget.assetId != null
          ? '/assets/${widget.assetId}'
          : '/assets/tag/${Uri.encodeComponent(widget.assetTag!)}';
      final data = await _api.get(path) as Map<String, dynamic>;
      setState(() => _asset = Asset.fromJson(data));
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Runs a POST action and refreshes the screen with the returned asset.
  Future<void> _run(String path, Map<String, dynamic> body, String success) async {
    setState(() => _busy = true);
    try {
      final data = await _api.post(path, body) as Map<String, dynamic>;
      setState(() => _asset = Asset.fromJson(data));
      _snack(success);
    } catch (e) {
      _snack(e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? Theme.of(context).colorScheme.error : const Color(0xFF047857),
      behavior: SnackBarBehavior.floating,
    ));
  }

  Future<String?> _askText(String title, String label, {bool required = false}) {
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(controller: ctrl, maxLines: 3, decoration: InputDecoration(labelText: label)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              if (required && ctrl.text.trim().length < 3) return;
              Navigator.pop(ctx, ctrl.text.trim());
            },
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }

  Future<void> _handover() async {
    final List users;
    try {
      users = await _api.get('/users/options') as List;
    } catch (e) {
      _snack(e.toString(), error: true);
      return;
    }
    if (!mounted) return;
    final options = users.map((u) => UserOption.fromJson(u as Map<String, dynamic>)).toList();
    final picked = await showModalBottomSheet<UserOption>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _UserPicker(options: options),
    );
    if (picked == null) return;
    await _run('/assets/${_asset!.id}/assign', {'userId': picked.id, 'notes': 'Handed over via mobile app'},
        'Assigned to ${picked.fullName}');
  }

  Future<void> _receiveBack() async {
    final condition = await showDialog<String>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: Text('Receive ${_asset!.assetTag} back'),
        children: [
          SimpleDialogOption(
            onPressed: () => Navigator.pop(ctx, 'GOOD'),
            child: const ListTile(leading: Icon(Icons.check_circle, color: Colors.green), title: Text('Good condition')),
          ),
          SimpleDialogOption(
            onPressed: () => Navigator.pop(ctx, 'FAULTY'),
            child: const ListTile(leading: Icon(Icons.build, color: Colors.red), title: Text('Faulty — needs repair')),
          ),
        ],
      ),
    );
    if (condition == null) return;
    await _run('/assets/${_asset!.id}/return', {'condition': condition, 'notes': 'Received via mobile app'},
        'Asset returned to stock');
  }

  Future<void> _reportFault() async {
    final description = await _askText('Report a fault', 'What is wrong? (min. 3 characters)', required: true);
    if (description == null || description.isEmpty) return;
    await _run('/assets/${_asset!.id}/report-fault', {'description': description}, 'Fault reported');
  }

  String _date(String? iso) => iso == null ? '—' : DateFormat.yMMMd().format(DateTime.parse(iso));

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().user!;
    final a = _asset;

    return Scaffold(
      appBar: AppBar(title: Text(a?.assetTag ?? widget.assetTag ?? 'Asset')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.search_off, size: 48, color: Colors.black38),
                      const SizedBox(height: 12),
                      Text(_error!, textAlign: TextAlign.center),
                      TextButton(onPressed: _load, child: const Text('Retry')),
                    ]),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              Expanded(
                                child: Text(a!.title,
                                    style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                              ),
                              StatusChip(a.status),
                            ]),
                            const SizedBox(height: 4),
                            Text('${a.category} · ${a.assetTag}', style: const TextStyle(color: Colors.black54)),
                            const Divider(height: 28),
                            _row('Serial number', a.serialNumber),
                            _row('Purchase date', _date(a.purchaseDate)),
                            _row(
                              'Warranty',
                              a.warrantyEndDate == null
                                  ? '—'
                                  : '${a.underWarranty ? 'Valid until' : 'Expired'} ${_date(a.warrantyEndDate)}',
                              color: a.warrantyEndDate == null ? null : (a.underWarranty ? Colors.green[700] : Colors.red[700]),
                            ),
                            _row('Current holder', a.holderName ?? 'In depot (unassigned)'),
                            if (a.departmentName != null) _row('Department', a.departmentName!),
                            if (a.notes != null) _row('Notes', a.notes!),
                          ]),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text('Field operations', style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 8),
                      if (_busy) const LinearProgressIndicator(),
                      if (user.isAdmin && a.currentHolderId == null && a.status != 'FAULTY')
                        _action(Icons.person_add_alt_1, 'Handover to staff', _handover),
                      if (user.isAdmin && a.currentHolderId != null)
                        _action(Icons.assignment_return, 'Receive asset back', _receiveBack),
                      if (a.status != 'FAULTY' && (user.isAdmin || a.currentHolderId == user.id))
                        _action(Icons.report_problem, 'Report fault', _reportFault, danger: true),
                      if (!user.isAdmin && a.currentHolderId != user.id)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 8),
                          child: Text('Only IT admins or the current holder can act on this asset.',
                              style: TextStyle(color: Colors.black54)),
                        ),
                      if (a.custodyHistory.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Text('Custody history', style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 8),
                        Card(
                          child: Column(
                            children: a.custodyHistory
                                .map((c) => ListTile(
                                      dense: true,
                                      leading: Icon(c.returnedAt == null ? Icons.person : Icons.history),
                                      title: Text(c.holderName),
                                      subtitle: Text(
                                        '${DateFormat.yMMMd().format(c.assignedAt)} → '
                                        '${c.returnedAt == null ? 'present' : DateFormat.yMMMd().format(c.returnedAt!)}',
                                      ),
                                    ))
                                .toList(),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
    );
  }

  Widget _row(String label, String value, {Color? color}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 120, child: Text(label, style: const TextStyle(color: Colors.black54))),
          Expanded(child: Text(value, style: TextStyle(fontWeight: FontWeight.w500, color: color))),
        ]),
      );

  Widget _action(IconData icon, String label, VoidCallback onTap, {bool danger = false}) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: danger
            ? OutlinedButton.icon(
                onPressed: _busy ? null : onTap,
                icon: Icon(icon, color: Colors.red[700]),
                label: Text(label, style: TextStyle(color: Colors.red[700])),
                style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              )
            : FilledButton.icon(
                onPressed: _busy ? null : onTap,
                icon: Icon(icon),
                label: Text(label),
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              ),
      );
}

class _UserPicker extends StatefulWidget {
  final List<UserOption> options;
  const _UserPicker({required this.options});

  @override
  State<_UserPicker> createState() => _UserPickerState();
}

class _UserPickerState extends State<_UserPicker> {
  String _filter = '';

  @override
  Widget build(BuildContext context) {
    final visible = widget.options
        .where((u) => '${u.fullName} ${u.departmentName ?? ''}'.toLowerCase().contains(_filter.toLowerCase()))
        .toList();
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      builder: (context, scroll) => Column(children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Find employee'),
            onChanged: (v) => setState(() => _filter = v),
          ),
        ),
        Expanded(
          child: ListView.builder(
            controller: scroll,
            itemCount: visible.length,
            itemBuilder: (context, i) => ListTile(
              leading: const Icon(Icons.person_outline),
              title: Text(visible[i].fullName),
              subtitle: Text(visible[i].departmentName ?? 'No department'),
              onTap: () => Navigator.pop(context, visible[i]),
            ),
          ),
        ),
      ]),
    );
  }
}
