'use client';
import { useAction } from 'convex/react';
import { ReactNode, useEffect, useState } from 'react';

import { TermsOfServiceModal } from '@/components/common/TermsOfServiceModal';

import { api } from '../../../convex/_generated/api';
import { useSession } from './SessionProvider';

interface TermsProviderProps {
  children: ReactNode;
}

export function TermsProvider({ children }: TermsProviderProps) {
  const { termsAccepted, updateTermsAccepted } = useSession();
  const acceptTermsAction = useAction(api.termsActions.acceptTermsInClerk);

  // Use a state to prevent flickering when data is loading
  const [showModal, setShowModal] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  // Update modal visibility based on terms acceptance from session
  useEffect(() => {
    if (termsAccepted === false) {
      setShowModal(true);
    }
  }, [termsAccepted]);

  const handleAccept = async () => {
    try {
      setIsAccepting(true);
      await acceptTermsAction({});
      
      // Update session state immediately for better UX
      updateTermsAccepted(true);
      setShowModal(false);
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
