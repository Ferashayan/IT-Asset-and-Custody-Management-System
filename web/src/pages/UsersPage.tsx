import { useEffect, useState, type FormEvent } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, ErrorState, PageHeader, Pagination } from '@/components/shared';
import { useAuth } from '@/context/AuthContext';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/lib/api';
import type { Department, Paginated, Role, User } from '@/lib/types';
import { initials } from '@/lib/utils';

const PAGE_SIZE = 10;
const USER_KEYS = [['users'], ['user-options'], ['departments'], ['audit-logs'], ['dashboard']];

function UserFormDialog({
  open,
  onOpenChange,
  user,
  departments,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: User | null;
  departments: Department[];
}) {
  const empty = { username: '', fullName: '', email: '', role: 'Staff' as Role, departmentId: '', isActive: true, password: '' };
  const [form, setForm] = useState(empty);
  const isEdit = Boolean(user);

  useEffect(() => {
    if (!open) return;
    setForm(
      user
        ? {
            username: user.username,
            fullName: user.full_name,
            email: user.email ?? '',
            role: user.role,
            departmentId: user.department_id ? String(user.department_id) : '',
            isActive: user.is_active,
            password: '',
          }
        : empty,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  const mutation = useApiMutation(
    () => {
      const body = { ...form, departmentId: form.departmentId ? Number(form.departmentId) : null };
      if (isEdit) {
        const { password: _omit, ...rest } = body;
        void _omit;
        return api.put<User>(`/users/${user!.id}`, rest);
      }
      return api.post<User>('/users', body);
    },
    { invalidate: USER_KEYS, onSuccess: () => onOpenChange(false) },
  );

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${user!.full_name}` : 'Create user'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update account details and role.' : 'Add a new employee account.'}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="fullName" required>
              <Input id="fullName" value={form.fullName} onChange={set('fullName')} required />
            </Field>
            <Field label="Username" htmlFor="username" required>
              <Input id="username" value={form.username} onChange={set('username')} required autoComplete="off" />
            </Field>
            <Field label="Email" htmlFor="email" className="sm:col-span-2">
              <Input id="email" type="email" value={form.email} onChange={set('email')} />
            </Field>
            <Field label="Role" htmlFor="role" required>
              <Select id="role" value={form.role} onChange={set('role')}>
                <option value="Staff">Staff</option>
                <option value="Admin">Admin</option>
              </Select>
            </Field>
            <Field label="Department" htmlFor="department">
              <Select id="department" value={form.departmentId} onChange={set('departmentId')}>
                <option value="">No department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            {!isEdit && (
              <Field label="Initial password" htmlFor="password" required hint="At least 8 characters" className="sm:col-span-2">
                <Input id="password" type="password" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" />
              </Field>
            )}
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Account is active (can sign in)
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {isEdit ? 'Save changes' : 'Create user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onOpenChange }: { user: User | null; onOpenChange: (o: boolean) => void }) {
  const [password, setPassword] = useState('');
  useEffect(() => setPassword(''), [user]);
  const mutation = useApiMutation(() => api.put(`/users/${user!.id}/password`, { password }), {
    invalidate: [['audit-logs']],
    onSuccess: () => onOpenChange(false),
  });
  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for {user?.full_name}. All of their active sessions will be signed out.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field label="New password" htmlFor="new-password" hint="At least 8 characters" required>
            <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [role, setRole] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);

  useEffect(() => setPage(1), [q, role, departmentId]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['users', { q, role, departmentId, page }],
    queryFn: () => api.get<Paginated<User>>('/users', { q, role, departmentId, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => api.get<Department[]>('/departments') });

  const deleteMutation = useApiMutation((u: User) => api.delete(`/users/${u.id}`), {
    invalidate: USER_KEYS,
    onSuccess: () => setDeleting(null),
  });

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage employee accounts, roles and passwords."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus /> New user
          </Button>
        }
      />
      <Card>
        <div className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_160px_200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search name, username or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role">
            <option value="">All roles</option>
            <option value="Admin">Admin</option>
            <option value="Staff">Staff</option>
          </Select>
          <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} aria-label="Filter by department">
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>

        {error ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <EmptyState title="No users found" />
        ) : (
          <div className={isFetching ? 'opacity-60' : ''}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="hidden md:table-cell">Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden sm:table-cell">Assets</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary sm:flex">
                          {initials(u.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{u.full_name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            @{u.username}
                            {u.email ? ` · ${u.email}` : ''}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{u.department_name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'Admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                    </TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">{u.asset_count ?? 0}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={u.is_active ? 'success' : 'outline'}>{u.is_active ? 'Active' : 'Disabled'}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${u.username}`}
                        onClick={() => {
                          setEditing(u);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Reset password for ${u.username}`} onClick={() => setResetting(u)}>
                        <KeyRound />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${u.username}`}
                        disabled={u.id === me?.id}
                        onClick={() => setDeleting(u)}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination {...data.pagination} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} departments={departments} />
      <ResetPasswordDialog user={resetting} onOpenChange={(o) => !o && setResetting(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.full_name}?`}
        description="The account is removed permanently. Their past custody records are preserved by name."
        confirmLabel="Delete user"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </>
  );
}
