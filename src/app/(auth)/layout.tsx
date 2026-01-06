import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="from-brand-blue/10 min-h-screen bg-gradient-to-br to-indigo-100">
      {children}
    </div>
  );
}
