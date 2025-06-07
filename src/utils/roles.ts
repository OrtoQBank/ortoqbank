import { auth } from '@clerk/nextjs/server';

import { Roles } from '@/types/globals';

export const checkRole = async (role: Roles) => {
  const { sessionClaims } = await auth();
  return sessionClaims?.metadata.role === role;
};

export const checkTermsAccepted = async (): Promise<boolean> => {
  const { sessionClaims } = await auth();
  return sessionClaims?.metadata.termsAccepted === true;
};
