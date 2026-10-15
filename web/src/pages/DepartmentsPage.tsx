import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/form-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, ErrorState, PageHeader } from '@/components/shared';
import { useApiMutation } from '@/hooks/useApiMutation';
import { api } from '@/lib/api';
import type { Department } from '@/lib/types';

const KEYS = [['departments'], ['users'], ['audit-logs']];

export default function DepartmentsPage() {
  const [editing, setEditing] = useState<Department | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<Department | null>(null);

  useEffect(() => {
    if (formOpen) setName(editing?.name ?? '');
  }, [formOpen, editing]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<Department[]>('/departments'),
  });

  const save = useApiMutation(
    () => (editing ? api.put(`/departments/${editing.id}`, { name }) : api.post('/departments', { name })),
    { invalidate: KEYS, onSuccess: () => setFormOpen(false) },
  );
  const remove = useApiMutation((d: Department) => api.delete(`/departments/${d.id}`), {
    invalidate: KEYS,
    onSuccess: () => setDeleting(null),
  });

  return (
    <>
      <PageHeader
        title="Departments"
        description="Organisational units used to group employees and their assets."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus /> New department
          </Button>
        }
      />
      <Card>
        {error ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : !data?.length ? (
          <EmptyState title="No departments yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Assigned assets</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="tabular-nums">{d.user_count}</TableCell>
                  <TableCell className="tabular-nums">{d.asset_count}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Rename ${d.name}`}
                      onClick={() => {
                        setEditing(d);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${d.name}`} onClick={() => setDeleting(d)}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Rename department' : 'New department'}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(undefined);
            }}
          >
            <Field label="Name" htmlFor="dept-name" required>
              <Input id="dept-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={save.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description="Departments that still have employees cannot be deleted."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  );
}
