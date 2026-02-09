import { useSession } from '@/components/providers/SessionProvider';

import { useAppRole } from './useAppRole';

// Re-export for discoverability
export { useSession } from '@/components/providers/SessionProvider';
export { useAppRole } from './useAppRole';

// Convenience hooks
export const useIsAdmin = () => {
  const { isAdmin } = useAppRole();
  return isAdmin;
};

export const useTermsAccepted = () => {
  const { termsAccepted } = useSession();
  return termsAccepted;
};
