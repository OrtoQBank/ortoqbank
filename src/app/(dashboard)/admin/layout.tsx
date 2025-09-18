'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { AdminNav } from '@/components/admin/admin-nav';
import { useSession } from '@/components/providers/SessionProvider';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin, isLoading } = useSession();
  const router = useRouter();

  // Redirect non-admins immediately when data is loaded
  if (!isLoading && !isAdmin) {
    router.push('/');
    return null; // Don't render anything while redirecting
  }

  // Show loading while checking admin status
  if (isLoading) {
    return (
      <div className="space-y-6 p-2 md:p-6">
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Verificando permissões...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 md:p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Área do Admin</h1>
      </div>

      {/* Admin Navigation */}
      <AdminNav />

      {/* Page content */}
      {children}
    </div>
  );
}
