'use client';
import { useMutation } from 'convex/react';
import { ReactNode, useEffect, useState } from 'react';

import { TermsOfServiceModal } from '@/components/common/TermsOfServiceModal';

import { api } from '../../../convex/_generated/api';
import { useSession } from './SessionProvider';

interface TermsProviderProps {
  children: ReactNode;
}

export function TermsProvider({ children }: TermsProviderProps) {
  const { termsAccepted, isLoading } = useSession();
  const setTermsAccepted = useMutation(api.users.setTermsAccepted);

  // Use a state to prevent flickering when data is loading
  const [showModal, setShowModal] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  // Update modal visibility based on terms acceptance from session
  useEffect(() => {
    // Only show modal when we explicitly know terms are false (not during loading)
    if (!isLoading && termsAccepted === false) {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  }, [termsAccepted, isLoading]);

  const handleAccept = async () => {
    try {
      setIsAccepting(true);
      // Use the backend mutation to set terms acceptance
      await setTermsAccepted({ accepted: true });

      // Modal will close automatically when backend updates termsAccepted
    } catch (error) {
      console.error('Error accepting terms:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <>
      <TermsOfServiceModal
        open={showModal}
        onAccept={handleAccept}
        isLoading={isAccepting}
      />
      {children}
    </>
  );
}
