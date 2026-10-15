import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight, Laptop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportFaultDialog } from '@/components/AssetDialogs';
import { EmptyState, ErrorState, PageHeader, StatusBadge } from '@/components/shared';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import type { MyAssets } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function MyAssetsPage() {
  const { user } = useAuth();
  const [reporting, setReporting] = useState<{ id: number; asset_tag: string } | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['my-assets'],
    queryFn: () => api.get<MyAssets>('/custody/me'),
  });

  return (
    <>
      <PageHeader
        title="My assets"
        description={`Equipment currently in your custody${user ? `, ${user.full_name.split(' ')[0]}` : ''}.`}
      />

      {error && <ErrorState message={(error as Error).message} onRetry={() => refetch()} />}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}

      {data && (
        <div className="space-y-8">
          {data.assets.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.assets.map((a) => (
                <Card key={a.id} className="flex flex-col">
                  <CardContent className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <Laptop className="h-5 w-5" />
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                    <div>
                      <p className="font-semibold">
                        {a.brand} {a.model}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{a.asset_tag}</span> · {a.category} · S/N {a.serial_number}
                      </p>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Assigned</dt>
                        <dd>{formatDate(a.assigned_at)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Warranty until</dt>
                        <dd>{formatDate(a.warranty_end_date)}</dd>
                      </div>
                    </dl>
                    <div className="mt-auto flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link to={`/assets/${a.id}`}>
                          Details <ChevronRight />
                        </Link>
                      </Button>
                      {a.status !== 'FAULTY' && (
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => setReporting(a)}>
                          <AlertTriangle className="text-destructive" /> Report fault
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState title="No assets assigned to you" description="When IT hands you a device it will appear here." />
            </Card>
          )}

          {data.history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Previously held</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y text-sm">
                  {data.history.map((h) => (
                    <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <span>
                        {h.brand} {h.model} <span className="font-mono text-xs text-muted-foreground">{h.asset_tag}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(h.assigned_at)} → {formatDate(h.returned_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {reporting && <ReportFaultDialog open onOpenChange={(o) => !o && setReporting(null)} asset={reporting} />}
    </>
  );
}
