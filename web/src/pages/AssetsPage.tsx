import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/form-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AssetFormDialog } from '@/components/AssetDialogs';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, ErrorState, PageHeader, Pagination, StatusBadge } from '@/components/shared';
import { useAuth } from '@/context/AuthContext';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/lib/api';
import { CATEGORIES, STATUS_LABELS, type Asset, type AssetStatus, type Department, type Paginated } from '@/lib/types';
import { formatDate } from '@/lib/utils';

const PAGE_SIZE = 10;

export default function AssetsPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebounce(search);

  const status = params.get('status') ?? '';
  const category = params.get('category') ?? '';
  const departmentId = params.get('departmentId') ?? '';
  const page = Number(params.get('page') ?? 1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState<Asset | null>(null);

  const updateParam = (key: string, value: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== 'page') next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  // Debounced search -> URL
  useEffect(() => {
    if ((params.get('q') ?? '') !== debouncedSearch) updateParam('q', debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['assets', { q: debouncedSearch, status, category, departmentId, page }],
    queryFn: () =>
      api.get<Paginated<Asset>>('/assets', { q: debouncedSearch, status, category, departmentId, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<Department[]>('/departments'),
  });

  const deleteMutation = useApiMutation((asset: Asset) => api.delete(`/assets/${asset.id}`), {
    invalidate: [['assets'], ['dashboard'], ['audit-logs']],
    onSuccess: () => setDeleting(null),
  });

  const hasFilters = Boolean(status || category || departmentId || search);

  return (
    <>
      <PageHeader
        title="Assets"
        description="Hardware inventory with real-time search and filtering."
        actions={
          isAdmin && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus /> New asset
            </Button>
          )
        }
      />

      <Card>
        <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-[1fr_160px_160px_200px_auto]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search tag, brand, model, serial or holder…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search assets"
            />
          </div>
          <Select value={status} onChange={(e) => updateParam('status', e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABELS) as AssetStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Select value={category} onChange={(e) => updateParam('category', e.target.value)} aria-label="Filter by category">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select value={departmentId} onChange={(e) => updateParam('departmentId', e.target.value)} aria-label="Filter by department">
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setParams({}, { replace: true });
              }}
            >
              <X /> Clear
            </Button>
          )}
        </div>

        {error ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <EmptyState
            title={hasFilters ? 'No assets match your filters' : 'No assets registered yet'}
            description={hasFilters ? 'Try a different search term or clear the filters.' : undefined}
          />
        ) : (
          <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Serial no.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Holder</TableHead>
                    <TableHead>Purchased</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((a) => (
                    <TableRow key={a.id} className="cursor-pointer" onClick={() => navigate(`/assets/${a.id}`)}>
                      <TableCell>
                        <p className="font-medium">
                          {a.brand} {a.model}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-mono">{a.asset_tag}</span> · {a.category}
                        </p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{a.serial_number}</TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                      <TableCell>
                        {a.holder_name ? (
                          <>
                            <p>{a.holder_name}</p>
                            <p className="text-xs text-muted-foreground">{a.department_name ?? '—'}</p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(a.purchase_date)}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${a.asset_tag}`}
                            onClick={() => {
                              setEditing(a);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label={`Delete ${a.asset_tag}`} onClick={() => setDeleting(a)}>
                            <Trash2 className="text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y md:hidden">
              {data.items.map((a) => (
                <li key={a.id}>
                  <Link to={`/assets/${a.id}`} className="flex items-start justify-between gap-3 p-4 hover:bg-muted/40">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {a.brand} {a.model}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{a.asset_tag}</span> · {a.category}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{a.holder_name ?? 'Unassigned'}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </Link>
                </li>
              ))}
            </ul>

            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              total={data.pagination.total}
              pageSize={data.pagination.pageSize}
              onPageChange={(p) => updateParam('page', String(p))}
            />
          </div>
        )}
      </Card>

      <AssetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        asset={editing}
        onSaved={(saved) => {
          if (!editing) navigate(`/assets/${saved.id}`);
        }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.asset_tag}?`}
        description="This permanently removes the asset and its custody history. Audit log entries are kept."
        confirmLabel="Delete asset"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </>
  );
}
