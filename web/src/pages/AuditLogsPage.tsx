import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/form-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, ErrorState, PageHeader, Pagination } from '@/components/shared';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/lib/api';
import type { AuditLog, Paginated } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

function actionVariant(action: string): BadgeProps['variant'] {
  if (action.includes('DELETED') || action === 'FAULT_REPORTED') return 'danger';
  if (action.includes('CREATED') || action === 'FAULT_RESOLVED') return 'success';
  if (action === 'ASSET_ASSIGNED' || action === 'ASSET_RETURNED') return 'info';
  if (action.startsWith('PASSWORD')) return 'warning';
  return 'secondary';
}

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [q, action, from, to]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['audit-logs', { q, action, from, to, page }],
    queryFn: () => api.get<Paginated<AuditLog>>('/audit-logs', { q, action, from, to, page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });
  const { data: actions = [] } = useQuery({
    queryKey: ['audit-logs', 'actions'],
    queryFn: () => api.get<string[]>('/audit-logs/actions'),
  });

  return (
    <>
      <PageHeader title="Audit logs" description="Immutable record of every change made in the system." />
      <Card>
        <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-[1fr_200px_150px_150px]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search description or user…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action">
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, ' ').toLowerCase()}
              </option>
            ))}
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
        </div>
        {error ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <EmptyState title="No log entries match" />
        ) : (
          <div className={isFetching ? 'opacity-60' : ''}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(l.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={actionVariant(l.action)}>{l.action.replace(/_/g, ' ').toLowerCase()}</Badge>
                    </TableCell>
                    <TableCell className="min-w-[260px]">
                      {l.asset_id ? (
                        <Link to={`/assets/${l.asset_id}`} className="hover:underline">
                          {l.description}
                        </Link>
                      ) : (
                        l.description
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{l.actor_name ?? 'System'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination {...data.pagination} onPageChange={setPage} />
          </div>
        )}
      </Card>
    </>
  );
}
