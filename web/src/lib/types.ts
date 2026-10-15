export type Role = 'Admin' | 'Staff';
export type AssetStatus = 'ACTIVE' | 'FAULTY' | 'IN_STOCK';

export const CATEGORIES = [
  'Laptop',
  'Desktop',
  'Server',
  'Monitor',
  'Printer',
  'Network',
  'Phone',
  'Tablet',
  'Peripheral',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUS_LABELS: Record<AssetStatus, string> = {
  ACTIVE: 'Active',
  FAULTY: 'Faulty',
  IN_STOCK: 'In Stock',
};

export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  role: Role;
  department_id: number | null;
  department_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  asset_count?: number;
}

export interface UserOption {
  id: number;
  username: string;
  full_name: string;
  department_name: string | null;
}

export interface Department {
  id: number;
  name: string;
  created_at: string;
  user_count: number;
  asset_count: number;
}

export interface Asset {
  id: number;
  asset_tag: string;
  category: Category;
  brand: string;
  model: string;
  serial_number: string;
  purchase_date: string;
  warranty_end_date: string | null;
  status: AssetStatus;
  notes: string | null;
  current_holder_id: number | null;
  holder_name: string | null;
  holder_username: string | null;
  holder_email: string | null;
  department_id: number | null;
  department_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustodyRecord {
  id: number;
  asset_id?: number;
  asset_tag?: string;
  category?: Category;
  brand?: string;
  model?: string;
  user_id: number | null;
  holder_name: string;
  assigned_at: string;
  assign_notes: string | null;
  returned_at: string | null;
  return_notes: string | null;
  assigned_by_name: string | null;
  received_by_name: string | null;
}

export interface ActivityEntry {
  id: number;
  action: string;
  actor_name: string | null;
  description: string;
  details?: Record<string, unknown>;
  asset_id?: number | null;
  created_at: string;
}

export interface AssetDetail extends Asset {
  qr_code: string | null;
  under_warranty: boolean;
  custody_history: CustodyRecord[];
  activity: ActivityEntry[];
}

export interface AuditLog extends ActivityEntry {
  entity_type: string;
  entity_id: number | null;
  asset_tag: string | null;
  actor_id: number | null;
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface DashboardStats {
  assets: { total: number; active: number; faulty: number; in_stock: number };
  byCategory: { category: Category; count: number }[];
  byDepartment: { department: string; count: number }[];
  warranty: { expired: number; expiring_soon: number };
  users: { total: number; active: number };
  recentActivity: ActivityEntry[];
}

export interface MyAssets {
  assets: (Pick<
    Asset,
    'id' | 'asset_tag' | 'category' | 'brand' | 'model' | 'serial_number' | 'purchase_date' | 'warranty_end_date' | 'status'
  > & { assigned_at: string | null; assign_notes: string | null })[];
  history: { id: number; asset_id: number; asset_tag: string; brand: string; model: string; assigned_at: string; returned_at: string }[];
}
