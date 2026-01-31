'use client';

import { useTenant } from '@/components/providers/TenantProvider';

export default function Footer() {
  const { config } = useTenant();
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="mt-auto py-4 text-white"
      style={{ backgroundColor: config.branding.primaryColor }}
    >
      <div className="container mx-auto px-4 text-center">
        <p>
          &copy; {currentYear} {config.branding.name}. Todos os direitos
          reservados.
        </p>
      </div>
    </footer>
  );
}
