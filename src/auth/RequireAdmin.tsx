import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '@/auth/AdminAuthContext';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, isAdmin } = useAdminAuth();

  if (loading) {
    return (
      <main className="screen-shell admin-shell">
        <section className="soft-card admin-section-minimal">
          <p className="muted-copy">Checking admin access…</p>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/admin-login" replace />;
  }

  return <>{children}</>;
}
