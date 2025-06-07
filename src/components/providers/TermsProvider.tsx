'use client';
import { useAction } from 'convex/react';
import { ReactNode, useEffect, useState } from 'react';

import { TermsOfServiceModal } from '@/components/common/TermsOfServiceModal';

import { api } from '../../../convex/_generated/api';

interface TermsProviderProps {
  children: ReactNode;
  initialTermsAccepted: boolean;
}

export function TermsProvider({
  children,
  initialTermsAccepted,
}: TermsProviderProps) {
  const acceptTermsAction = useAction(api.termsActions.acceptTermsInClerk);

  // Use a state to prevent flickering when data is loading
  const [showModal, setShowModal] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  // Update modal visibility based on initial terms acceptance
  useEffect(() => {
    if (initialTermsAccepted === false) {
      setShowModal(true);
    }
  }, [initialTermsAccepted]);

  const handleAccept = async () => {
    try {
      setIsAccepting(true);
      await acceptTermsAction({});
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
