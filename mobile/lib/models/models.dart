class AppUser {
  final int id;
  final String username;
  final String fullName;
  final String? email;
  final String role;
  final String? departmentName;

  AppUser({
    required this.id,
    required this.username,
    required this.fullName,
    required this.role,
    this.email,
    this.departmentName,
  });

  bool get isAdmin => role == 'Admin';

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        id: j['id'] as int,
        username: j['username'] as String,
        fullName: j['full_name'] as String,
        email: j['email'] as String?,
        role: j['role'] as String,
        departmentName: j['department_name'] as String?,
      );
}

class UserOption {
  final int id;
  final String fullName;
  final String? departmentName;

  UserOption({required this.id, required this.fullName, this.departmentName});

  factory UserOption.fromJson(Map<String, dynamic> j) => UserOption(
        id: j['id'] as int,
        fullName: j['full_name'] as String,
        departmentName: j['department_name'] as String?,
      );
}

class CustodyEntry {
  final String holderName;
  final DateTime assignedAt;
  final DateTime? returnedAt;

  CustodyEntry({required this.holderName, required this.assignedAt, this.returnedAt});

  factory CustodyEntry.fromJson(Map<String, dynamic> j) => CustodyEntry(
        holderName: j['holder_name'] as String,
        assignedAt: DateTime.parse(j['assigned_at'] as String).toLocal(),
        returnedAt: j['returned_at'] == null ? null : DateTime.parse(j['returned_at'] as String).toLocal(),
      );
}

/// Asset as returned by the list, "my assets" and detail endpoints.
class Asset {
  final int id;
  final String assetTag;
  final String category;
  final String brand;
  final String model;
  final String serialNumber;
  final String purchaseDate;
  final String? warrantyEndDate;
  final String status;
  final String? notes;
  final int? currentHolderId;
  final String? holderName;
  final String? departmentName;
  final bool underWarranty;
  final List<CustodyEntry> custodyHistory;

  Asset({
    required this.id,
    required this.assetTag,
    required this.category,
    required this.brand,
    required this.model,
    required this.serialNumber,
    required this.purchaseDate,
    required this.status,
    this.warrantyEndDate,
    this.notes,
    this.currentHolderId,
    this.holderName,
    this.departmentName,
    this.underWarranty = false,
    this.custodyHistory = const [],
  });

  String get title => '$brand $model';

  factory Asset.fromJson(Map<String, dynamic> j) => Asset(
        id: j['id'] as int,
        assetTag: j['asset_tag'] as String,
        category: j['category'] as String,
        brand: j['brand'] as String,
        model: j['model'] as String,
        serialNumber: j['serial_number'] as String,
        purchaseDate: j['purchase_date'] as String,
        warrantyEndDate: j['warranty_end_date'] as String?,
        status: j['status'] as String,
        notes: j['notes'] as String?,
        currentHolderId: j['current_holder_id'] as int?,
        holderName: j['holder_name'] as String?,
        departmentName: j['department_name'] as String?,
        underWarranty: (j['under_warranty'] as bool?) ?? false,
        custodyHistory: ((j['custody_history'] as List?) ?? [])
            .map((e) => CustodyEntry.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
