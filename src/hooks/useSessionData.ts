import { useSession } from '@/components/providers/SessionProvider';

// Re-export the useSession hook for better discoverability
export { useSession } from '@/components/providers/SessionProvider';

// You can also create specific hooks if needed
export const useIsAdmin = () => {
  const { isAdmin } = useSession();
  return isAdmin;
};

export const useTermsAccepted = () => {
  const { termsAccepted } = useSession();
  return termsAccepted;
};
