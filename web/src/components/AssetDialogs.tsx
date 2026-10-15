import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { useApiMutation } from '@/hooks/useApiMutation';
import { api } from '@/lib/api';
import { CATEGORIES, STATUS_LABELS, type Asset, type AssetDetail, type AssetStatus, type UserOption } from '@/lib/types';

const ASSET_KEYS = [['assets'], ['asset'], ['dashboard'], ['custody'], ['my-assets'], ['audit-logs']];

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ------------------------------------------------------------------ create / edit

const emptyForm = {
  category: 'Laptop',
  brand: '',
  model: '',
  serialNumber: '',
  purchaseDate: '',
  warrantyEndDate: '',
  notes: '',
  status: '' as AssetStatus | '',
};

export function AssetFormDialog({
  open,
  onOpenChange,
  asset,
  onSaved,
}: DialogProps & { asset?: Asset | AssetDetail | null; onSaved?: (asset: AssetDetail) => void }) {
  const [form, setForm] = useState(emptyForm);
  const isEdit = Boolean(asset);

  useEffect(() => {
    if (!open) return;
    setForm(
      asset
        ? {
            category: asset.category,
            brand: asset.brand,
            model: asset.model,
            serialNumber: asset.serial_number,
            purchaseDate: asset.purchase_date,
            warrantyEndDate: asset.warranty_end_date ?? '',
            notes: asset.notes ?? '',
            status: asset.status,
          }
        : emptyForm,
    );
  }, [open, asset]);

  const mutation = useApiMutation(
    (body: typeof form) => {
      const payload = { ...body, status: isEdit ? body.status : undefined };
      return isEdit ? api.put<AssetDetail>(`/assets/${asset!.id}`, payload) : api.post<AssetDetail>('/assets', payload);
    },
    {
      invalidate: ASSET_KEYS,
      onSuccess: (saved) => {
        onOpenChange(false);
        onSaved?.(saved);
      },
    },
  );

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  // Statuses an admin may set directly; ACTIVE/IN_STOCK follow custody operations
  const statusOptions: AssetStatus[] = asset?.current_holder_id ? ['ACTIVE', 'FAULTY'] : ['IN_STOCK', 'FAULTY'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${asset!.asset_tag}` : 'Register new asset'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the hardware details. Custody changes are made with Assign / Return.'
              : 'A unique asset tag and QR code are generated automatically when you save.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="category" required>
              <Select id="category" value={form.category} onChange={set('category')}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            {isEdit && (
              <Field label="Status" htmlFor="status">
                <Select id="status" value={form.status} onChange={set('status')}>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Brand" htmlFor="brand" required>
              <Input id="brand" value={form.brand} onChange={set('brand')} placeholder="e.g. Dell" required />
            </Field>
            <Field label="Model" htmlFor="model" required>
              <Input id="model" value={form.model} onChange={set('model')} placeholder="e.g. Latitude 5440" required />
            </Field>
            <Field label="Serial number" htmlFor="serial" required className="sm:col-span-2">
              <Input id="serial" value={form.serialNumber} onChange={set('serialNumber')} required />
            </Field>
            <Field label="Purchase date" htmlFor="purchaseDate" required>
              <Input id="purchaseDate" type="date" value={form.purchaseDate} onChange={set('purchaseDate')} required />
            </Field>
            <Field label="Warranty end date" htmlFor="warranty">
              <Input
                id="warranty"
                type="date"
                value={form.warrantyEndDate}
                min={form.purchaseDate || undefined}
                onChange={set('warrantyEndDate')}
              />
            </Field>
            <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
              <Textarea id="notes" value={form.notes} onChange={set('notes')} placeholder="Specs, location, accessories…" />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {isEdit ? 'Save changes' : 'Register asset'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ assign

export function AssignDialog({ open, onOpenChange, asset }: DialogProps & { asset: Pick<Asset, 'id' | 'asset_tag'> }) {
  const [userId, setUserId] = useState('');
  const [filter, setFilter] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setUserId('');
      setFilter('');
      setNotes('');
    }
  }, [open]);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['user-options'],
    queryFn: () => api.get<UserOption[]>('/users/options'),
    enabled: open,
  });

  const visible = users.filter((u) =>
    `${u.full_name} ${u.username} ${u.department_name ?? ''}`.toLowerCase().includes(filter.toLowerCase()),
  );

  const mutation = useApiMutation(
    () => api.post<AssetDetail>(`/assets/${asset.id}/assign`, { userId: Number(userId), notes }),
    { invalidate: ASSET_KEYS, onSuccess: () => onOpenChange(false) },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign {asset.asset_tag}</DialogTitle>
          <DialogDescription>Hand this asset over to an employee. The custody record starts now.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field label="Employee" htmlFor="assignee" required>
            <Input placeholder="Filter employees…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <Select id="assignee" value={userId} onChange={(e) => setUserId(e.target.value)} required size={6} className="h-auto py-1">
              {isLoading && <option disabled>Loading…</option>}
              {visible.map((u) => (
                <option key={u.id} value={u.id} className="rounded px-1 py-1">
                  {u.full_name} — {u.department_name ?? 'No department'}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Handover notes" htmlFor="assign-notes">
            <Textarea id="assign-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Accessories, condition…" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!userId} loading={mutation.isPending}>
              Assign asset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ return

export function ReturnDialog({
  open,
  onOpenChange,
  asset,
}: DialogProps & { asset: Pick<Asset, 'id' | 'asset_tag' | 'holder_name'> }) {
  const [condition, setCondition] = useState<'GOOD' | 'FAULTY'>('GOOD');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setCondition('GOOD');
      setNotes('');
    }
  }, [open]);

  const mutation = useApiMutation(() => api.post<AssetDetail>(`/assets/${asset.id}/return`, { condition, notes }), {
    invalidate: ASSET_KEYS,
    onSuccess: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return {asset.asset_tag} to stock</DialogTitle>
          <DialogDescription>Receive the asset back from {asset.holder_name ?? 'its holder'} and close the custody record.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field label="Condition on return" htmlFor="condition">
            <Select id="condition" value={condition} onChange={(e) => setCondition(e.target.value as 'GOOD' | 'FAULTY')}>
              <option value="GOOD">Good — back to stock</option>
              <option value="FAULTY">Faulty — needs repair</option>
            </Select>
          </Field>
          <Field label="Return notes" htmlFor="return-notes">
            <Textarea id="return-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Confirm return
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ faults

export function ReportFaultDialog({ open, onOpenChange, asset }: DialogProps & { asset: Pick<Asset, 'id' | 'asset_tag'> }) {
  const [description, setDescription] = useState('');
  useEffect(() => {
    if (open) setDescription('');
  }, [open]);

  const mutation = useApiMutation(() => api.post<AssetDetail>(`/assets/${asset.id}/report-fault`, { description }), {
    invalidate: ASSET_KEYS,
    onSuccess: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report a fault on {asset.asset_tag}</DialogTitle>
          <DialogDescription>The asset will be flagged as Faulty and the IT team notified via the audit log.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field label="What is wrong?" htmlFor="fault" required>
            <Textarea
              id="fault"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Screen flickers, battery does not charge…"
              required
              minLength={3}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" loading={mutation.isPending}>
              Report fault
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ResolveFaultDialog({ open, onOpenChange, asset }: DialogProps & { asset: Pick<Asset, 'id' | 'asset_tag'> }) {
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (open) setNotes('');
  }, [open]);

  const mutation = useApiMutation(() => api.post<AssetDetail>(`/assets/${asset.id}/resolve-fault`, { notes }), {
    invalidate: ASSET_KEYS,
    onSuccess: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark {asset.asset_tag} as repaired</DialogTitle>
          <DialogDescription>The asset returns to Active (if assigned) or In Stock.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field label="Repair notes" htmlFor="resolve-notes">
            <Textarea id="resolve-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Replaced PSU" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Mark repaired
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
