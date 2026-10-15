import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Pencil,
  Printer,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Undo2,
  UserPlus,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AssetFormDialog, AssignDialog, ReportFaultDialog, ResolveFaultDialog, ReturnDialog } from '@/components/AssetDialogs';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DetailItem, EmptyState, ErrorState, StatusBadge } from '@/components/shared';
import { useAuth } from '@/context/AuthContext';
import { useApiMutation } from '@/hooks/useApiMutation';
import { api } from '@/lib/api';
import type { AssetDetail } from '@/lib/types';
import { formatDate, formatDateTime, timeAgo } from '@/lib/utils';

type DialogName = 'edit' | 'assign' | 'return' | 'fault' | 'resolve' | 'delete' | null;

function printLabel(asset: AssetDetail) {
  const w = window.open('', '_blank', 'width=420,height=520');
  if (!w || !asset.qr_code) return;
  w.document.write(`<!doctype html><html><head><title>${asset.asset_tag}</title>
    <style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;padding:24px}
    .label{border:1px dashed #999;padding:16px;text-align:center;width:260px}
    img{width:200px;height:200px}h2{margin:4px 0;font-family:monospace}p{margin:2px 0;font-size:12px;color:#444}</style>
    </head><body><div class="label"><img src="${asset.qr_code}" alt="QR"/><h2>${asset.asset_tag}</h2>
    <p>${asset.brand} ${asset.model}</p><p>S/N ${asset.serial_number}</p></div>
    <script>window.onload=()=>{window.print();}</script></body></html>`);
  w.document.close();
}

export default function AssetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [dialog, setDialog] = useState<DialogName>(null);

  const { data: asset, isLoading, error, refetch } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => api.get<AssetDetail>(`/assets/${id}`),
  });

  const deleteMutation = useApiMutation(() => api.delete(`/assets/${id}`), {
    invalidate: [['assets'], ['dashboard']],
    onSuccess: () => navigate('/assets', { replace: true }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }
  if (error || !asset) return <ErrorState message={(error as Error)?.message ?? 'Asset not found'} onRetry={() => refetch()} />;

  const isHolder = asset.current_holder_id === user?.id;
  const canReportFault = asset.status !== 'FAULTY' && (isAdmin || isHolder);
  const close = (open: boolean) => !open && setDialog(null);

  return (
    <>
      <Link to="/assets" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to assets
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {asset.brand} {asset.model}
            </h1>
            <StatusBadge status={asset.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{asset.asset_tag}</span> · {asset.category} · updated {timeAgo(asset.updated_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && !asset.current_holder_id && asset.status !== 'FAULTY' && (
            <Button onClick={() => setDialog('assign')}>
              <UserPlus /> Assign
            </Button>
          )}
          {isAdmin && asset.current_holder_id && (
            <Button onClick={() => setDialog('return')}>
              <Undo2 /> Return to stock
            </Button>
          )}
          {isAdmin && asset.status === 'FAULTY' && (
            <Button variant="outline" onClick={() => setDialog('resolve')}>
              <Wrench /> Mark repaired
            </Button>
          )}
          {canReportFault && (
            <Button variant="outline" onClick={() => setDialog('fault')}>
              <AlertTriangle className="text-destructive" /> Report fault
            </Button>
          )}
          {isAdmin && (
            <>
              <Button variant="outline" onClick={() => setDialog('edit')}>
                <Pencil /> Edit
              </Button>
              <Button
                variant="outline"
                onClick={() => setDialog('delete')}
                disabled={Boolean(asset.current_holder_id)}
                title={asset.current_holder_id ? 'Return the asset before deleting it' : undefined}
              >
                <Trash2 className="text-destructive" /> Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <DetailItem label="Asset tag">
                  <span className="font-mono">{asset.asset_tag}</span>
                </DetailItem>
                <DetailItem label="Category">{asset.category}</DetailItem>
                <DetailItem label="Serial number">
                  <span className="font-mono">{asset.serial_number}</span>
                </DetailItem>
                <DetailItem label="Brand">{asset.brand}</DetailItem>
                <DetailItem label="Model">{asset.model}</DetailItem>
                <DetailItem label="Purchase date">{formatDate(asset.purchase_date)}</DetailItem>
                <DetailItem label="Warranty">
                  {asset.warranty_end_date ? (
                    <span className="inline-flex items-center gap-1.5">
                      {asset.under_warranty ? (
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <ShieldOff className="h-4 w-4 text-muted-foreground" />
                      )}
                      {asset.under_warranty ? 'Until' : 'Expired'} {formatDate(asset.warranty_end_date)}
                    </span>
                  ) : (
                    '—'
                  )}
                </DetailItem>
                <DetailItem label="Current holder">
                  {asset.holder_name ? (
                    <>
                      {asset.holder_name}
                      <span className="block text-xs text-muted-foreground">{asset.department_name ?? 'No department'}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">In depot</span>
                  )}
                </DetailItem>
                <DetailItem label="Registered">{formatDateTime(asset.created_at)}</DetailItem>
                {asset.notes && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <DetailItem label="Notes">
                      <span className="whitespace-pre-wrap">{asset.notes}</span>
                    </DetailItem>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custody history</CardTitle>
            </CardHeader>
            {asset.custody_history.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Returned</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {asset.custody_history.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.holder_name}</TableCell>
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
                          <Badge variant="success">Current</Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[220px] text-xs text-muted-foreground">
                        {[c.assign_notes, c.return_notes].filter(Boolean).join(' / ') || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="Never assigned" description="This asset has not been handed over to anyone yet." />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>QR code</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {asset.qr_code ? (
                <img src={asset.qr_code} alt={`QR code for ${asset.asset_tag}`} className="h-48 w-48 rounded-md border" />
              ) : (
                <p className="text-sm text-muted-foreground">No QR code</p>
              )}
              <p className="font-mono text-sm">{asset.asset_tag}</p>
              {asset.qr_code && (
                <div className="flex w-full gap-2">
                  <Button variant="outline" className="flex-1" asChild>
                    <a href={asset.qr_code} download={`${asset.asset_tag}.png`}>
                      <Download /> Download
                    </a>
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => printLabel(asset)}>
                    <Printer /> Print label
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {asset.activity.length ? (
                <ol className="relative space-y-4 border-l pl-4">
                  {asset.activity.map((a) => (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
                      <p className="text-sm">{a.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.actor_name} · {formatDateTime(a.created_at)}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No activity recorded.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AssetFormDialog open={dialog === 'edit'} onOpenChange={close} asset={asset} />
      <AssignDialog open={dialog === 'assign'} onOpenChange={close} asset={asset} />
      <ReturnDialog open={dialog === 'return'} onOpenChange={close} asset={asset} />
      <ReportFaultDialog open={dialog === 'fault'} onOpenChange={close} asset={asset} />
      <ResolveFaultDialog open={dialog === 'resolve'} onOpenChange={close} asset={asset} />
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={close}
        title={`Delete ${asset.asset_tag}?`}
        description="This permanently removes the asset and its custody history. Audit log entries are kept."
        confirmLabel="Delete asset"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(undefined)}
      />
    </>
  );
}
