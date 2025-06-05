import { redirect } from 'next/navigation';

import { AdminNav } from '@/components/admin/admin-nav';
import { checkRole } from '@/utils/roles';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if user has admin role
  const isAdmin = await checkRole('admin');
  if (!isAdmin) {
    redirect('/');
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
