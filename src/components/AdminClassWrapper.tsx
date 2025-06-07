'use client';

import { ReactNode } from 'react';

import { useSession } from './providers/SessionProvider';

interface AdminClassWrapperProps {
  children: ReactNode;
}

export function AdminClassWrapper({ children }: AdminClassWrapperProps) {
  const { isAdmin } = useSession();

  const mainClassName = `w-full bg-gradient-to-b from-slate-50 via-blue-50 to-indigo-100 min-h-screen ${isAdmin ? '' : 'select-none'}`;

  return <main className={mainClassName.trim()}>{children}</main>;
}
