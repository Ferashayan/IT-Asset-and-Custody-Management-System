import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import AssetsPage from '@/pages/AssetsPage';
import AssetDetailPage from '@/pages/AssetDetailPage';
import CustodyPage from '@/pages/CustodyPage';
import UsersPage from '@/pages/UsersPage';
import DepartmentsPage from '@/pages/DepartmentsPage';
import AuditLogsPage from '@/pages/AuditLogsPage';
import MyAssetsPage from '@/pages/MyAssetsPage';
import ProfilePage from '@/pages/ProfilePage';
import NotFoundPage from '@/pages/NotFoundPage';

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function RequireAuth({ adminOnly, children }: { adminOnly?: boolean; children: JSX.Element }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (adminOnly && !isAdmin) return <Navigate to="/my-assets" replace />;
  return children;
}

function HomeRedirect() {
  const { isAdmin } = useAuth();
  return <Navigate to={isAdmin ? '/dashboard' : '/my-assets'} replace />;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? <FullScreenLoader /> : user ? <HomeRedirect /> : <LoginPage />}
      />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<HomeRedirect />} />
        <Route path="dashboard" element={<RequireAuth adminOnly><DashboardPage /></RequireAuth>} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="assets/:id" element={<AssetDetailPage />} />
        <Route path="custody" element={<RequireAuth adminOnly><CustodyPage /></RequireAuth>} />
        <Route path="users" element={<RequireAuth adminOnly><UsersPage /></RequireAuth>} />
        <Route path="departments" element={<RequireAuth adminOnly><DepartmentsPage /></RequireAuth>} />
        <Route path="audit-logs" element={<RequireAuth adminOnly><AuditLogsPage /></RequireAuth>} />
        <Route path="my-assets" element={<MyAssetsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
