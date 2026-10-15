import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Boxes, QrCode, ShieldCheck, History } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(username, password);
      toast.success(`Welcome back, ${user.full_name}`);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? (user.role === 'Admin' ? '/dashboard' : '/my-assets'), { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-900 p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Boxes className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">IT Asset Manager</span>
        </div>
        <div className="relative space-y-8">
          <h2 className="max-w-md text-3xl font-semibold leading-tight">
            Every device, every holder, every change — in one place.
          </h2>
          <ul className="space-y-4 text-slate-300">
            <li className="flex items-center gap-3">
              <QrCode className="h-5 w-5 text-sky-400" /> Automatic QR codes for every registered asset
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-400" /> Role-based access for admins and staff
            </li>
            <li className="flex items-center gap-3">
              <History className="h-5 w-5 text-amber-400" /> Complete custody history and audit trail
            </li>
          </ul>
        </div>
        <p className="relative text-sm text-slate-500">IT Demirbaş ve Zimmet Yönetim Sistemi</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
              <Boxes className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">IT Asset Manager</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use your corporate account to continue.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <Field label="Username" htmlFor="username">
              <Input
                id="username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            {error && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" loading={submitting}>
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
