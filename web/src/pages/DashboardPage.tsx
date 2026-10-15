import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Boxes, CheckCircle2, PackageOpen, ShieldAlert, Users, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, PageHeader } from '@/components/shared';
import { api } from '@/lib/api';
import type { DashboardStats } from '@/lib/types';
import { timeAgo } from '@/lib/utils';

function StatTile({
  label,
  value,
  icon: Icon,
  tone,
  to,
  sub,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
  to: string;
  sub?: string;
}) {
  return (
    <Link to={to} className="group">
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardContent className="flex items-start justify-between p-5">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
            {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`rounded-lg p-2.5 ${tone}`}>
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/** Single-series horizontal bars: one hue, sorted by value, direct labels, hover tooltip */
function BarList({ rows }: { rows: { label: string; count: number; to?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => {
        const bar = (
          <div className="group flex items-center gap-3" title={`${row.label}: ${row.count}`}>
            <span className="w-28 shrink-0 truncate text-sm text-muted-foreground sm:w-36">{row.label}</span>
            <div className="relative h-6 flex-1">
              <div
                className="h-full rounded-r bg-primary/80 transition-colors group-hover:bg-primary"
                style={{ width: `${Math.max(2, (row.count / max) * 100)}%` }}
              />
            </div>
            <span className="w-8 text-right text-sm font-medium tabular-nums">{row.count}</span>
          </div>
        );
        return <li key={row.label}>{row.to ? <Link to={row.to}>{bar}</Link> : bar}</li>;
      })}
    </ul>
  );
}

/** Part-to-whole of the three statuses; status colors always paired with a text label */
function StatusBreakdown({ stats }: { stats: DashboardStats['assets'] }) {
  const parts = [
    { key: 'ACTIVE', label: 'Active (assigned)', value: stats.active, color: 'bg-emerald-500' },
    { key: 'IN_STOCK', label: 'In stock', value: stats.in_stock, color: 'bg-sky-500' },
    { key: 'FAULTY', label: 'Faulty', value: stats.faulty, color: 'bg-red-500' },
  ];
  const total = Math.max(1, stats.total);
  return (
    <div className="space-y-4">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <div
              key={p.key}
              className={p.color}
              style={{ width: `${(p.value / total) * 100}%` }}
              title={`${p.label}: ${p.value}`}
            />
          ))}
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {parts.map((p) => (
          <Link key={p.key} to={`/assets?status=${p.key}`} className="rounded-md p-2 hover:bg-muted">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${p.color}`} /> {p.label}
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {p.value}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {Math.round((p.value / total) * 100)}%
              </span>
            </dd>
          </Link>
        ))}
      </dl>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardStats>('/dashboard/stats'),
  });

  return (
    <>
      <PageHeader title="Dashboard" description="A live overview of your IT inventory and custody." />

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[112px]" />
          ))}
        </div>
      )}
      {error && <ErrorState message={(error as Error).message} onRetry={() => refetch()} />}

      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Total assets" value={data.assets.total} icon={Boxes} tone="bg-primary/10 text-primary" to="/assets" />
            <StatTile
              label="Active / assigned"
              value={data.assets.active}
              icon={CheckCircle2}
              tone="bg-emerald-50 text-emerald-600"
              to="/assets?status=ACTIVE"
            />
            <StatTile
              label="Faulty"
              value={data.assets.faulty}
              icon={AlertTriangle}
              tone="bg-red-50 text-red-600"
              to="/assets?status=FAULTY"
            />
            <StatTile
              label="In stock (idle)"
              value={data.assets.in_stock}
              icon={PackageOpen}
              tone="bg-sky-50 text-sky-600"
              to="/assets?status=IN_STOCK"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Status breakdown</CardTitle>
                <CardDescription>Share of all {data.assets.total} assets by current status</CardDescription>
              </CardHeader>
              <CardContent>
                <StatusBreakdown stats={data.assets} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>People & warranty</CardTitle>
                <CardDescription>Accounts and coverage at a glance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link to="/users" className="flex items-center justify-between rounded-md p-2 hover:bg-muted">
                  <span className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" /> Active users
                  </span>
                  <span className="font-semibold tabular-nums">
                    {data.users.active}
                    <span className="text-xs font-normal text-muted-foreground"> / {data.users.total}</span>
                  </span>
                </Link>
                <div className="flex items-center justify-between rounded-md p-2">
                  <span className="flex items-center gap-2 text-sm">
                    <ShieldAlert className="h-4 w-4 text-amber-600" /> Warranty ending ≤ 60 days
                  </span>
                  <span className="font-semibold tabular-nums">{data.warranty.expiring_soon}</span>
                </div>
                <div className="flex items-center justify-between rounded-md p-2">
                  <span className="flex items-center gap-2 text-sm">
                    <ShieldAlert className="h-4 w-4 text-muted-foreground" /> Warranty expired
                  </span>
                  <span className="font-semibold tabular-nums">{data.warranty.expired}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Assets by category</CardTitle>
              </CardHeader>
              <CardContent>
                {data.byCategory.length ? (
                  <BarList
                    rows={data.byCategory.map((c) => ({ label: c.category, count: c.count, to: `/assets?category=${c.category}` }))}
                  />
                ) : (
                  <EmptyState title="No assets yet" />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Assigned by department</CardTitle>
              </CardHeader>
              <CardContent>
                {data.byDepartment.length ? (
                  <BarList rows={data.byDepartment.map((d) => ({ label: d.department, count: d.count }))} />
                ) : (
                  <EmptyState title="Nothing assigned yet" />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentActivity.length ? (
                  <ol className="space-y-3">
                    {data.recentActivity.map((a) => (
                      <li key={a.id} className="text-sm">
                        {a.asset_id ? (
                          <Link to={`/assets/${a.asset_id}`} className="hover:underline">
                            {a.description}
                          </Link>
                        ) : (
                          a.description
                        )}
                        <p className="text-xs text-muted-foreground">
                          {a.actor_name} · {timeAgo(a.created_at)}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EmptyState title="No activity yet" />
                )}
                <Link to="/audit-logs" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
                  View full audit log →
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
