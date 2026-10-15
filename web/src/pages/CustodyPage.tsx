import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/form-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, ErrorState, PageHeader, Pagination } from '@/components/shared';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/lib/api';
import type { CustodyRecord, Paginated } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

export default function CustodyPage() {
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [q, state]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['custody', { q, state, page }],
    queryFn: () => api.get<Paginated<CustodyRecord>>('/custody', { q, state, page, pageSize: 15 }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Custody ledger" description="Every hand-over and return (zimmet kayıtları), newest first." />
      <Card>
        <div className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search asset tag, model or employee…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={state} onChange={(e) => setState(e.target.value)} aria-label="Filter by state">
            <option value="">All records</option>
            <option value="open">Currently assigned</option>
            <option value="closed">Returned</option>
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
          <EmptyState title="No custody records" />
        ) : (
          <div className={isFetching ? 'opacity-60' : ''}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Returned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link to={`/assets/${c.asset_id}`} className="font-medium hover:underline">
                        {c.brand} {c.model}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">{c.asset_tag}</p>
                    </TableCell>
                    <TableCell>{c.holder_name}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(c.assigned_at)}
                      <span className="block text-xs text-muted-foreground">by {c.assigned_by_name ?? '—'}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {c.returned_at ? (
                        <>
                          {formatDateTime(c.returned_at)}
                          <span className="block text-xs text-muted-foreground">by {c.received_by_name ?? '—'}</span>
                        </>
                      ) : (
                        <Badge variant="success">Currently assigned</Badge>
                      )}
                    </TableCell>
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
