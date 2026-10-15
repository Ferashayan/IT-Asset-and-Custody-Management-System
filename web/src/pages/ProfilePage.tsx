import { useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/form-controls';
import { DetailItem, PageHeader } from '@/components/shared';
import { useAuth } from '@/context/AuthContext';
import { useApiMutation } from '@/hooks/useApiMutation';
import { api, tokenStore } from '@/lib/api';
import { formatDate, initials } from '@/lib/utils';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const mutation = useApiMutation(
    () => api.put<{ token: string }>('/auth/password', { currentPassword: current, newPassword: next }),
    {
      onSuccess: (data) => {
        tokenStore.set(data.token);
        setCurrent('');
        setNext('');
        setConfirm('');
      },
    },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      toast.error('New passwords do not match');
      return;
    }
    mutation.mutate(undefined);
  };

  if (!user) return null;

  return (
    <>
      <PageHeader title="Profile" description="Your account details and security settings." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-white">
              {initials(user.full_name)}
            </div>
            <div>
              <p className="text-lg font-semibold">{user.full_name}</p>
              <p className="text-sm text-muted-foreground">@{user.username}</p>
            </div>
            <Badge className="ml-auto" variant={user.role === 'Admin' ? 'default' : 'secondary'}>
              {user.role}
            </Badge>
          </CardContent>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailItem label="Email">{user.email ?? '—'}</DetailItem>
              <DetailItem label="Department">{user.department_name ?? '—'}</DetailItem>
              <DetailItem label="Assets in custody">{user.asset_count ?? 0}</DetailItem>
              <DetailItem label="Member since">{formatDate(user.created_at)}</DetailItem>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>Other signed-in devices will be signed out.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <Field label="Current password" htmlFor="current" required>
                <Input id="current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
              </Field>
              <Field label="New password" htmlFor="next" hint="At least 8 characters" required>
                <Input id="next" type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password" />
              </Field>
              <Field label="Confirm new password" htmlFor="confirm" required>
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
              </Field>
              <Button type="submit" loading={mutation.isPending}>
                Update password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
